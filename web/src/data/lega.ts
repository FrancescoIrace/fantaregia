/* ══ Una lega, dal database ══════════════════════════════════════════
   Caricare tutto quello che il motore vuole in una volta sola, e poi
   restare in ascolto: il realtime di Supabase avvisa quando una riga della
   lega cambia (un'assegnazione, una giornata di voti, un indisponibile) e
   la vista si aggiorna senza ricaricare la pagina — che era il secondo
   limite della versione che ripubblicava sé stessa.

   Le letture passano dalle policy RLS: chi non è della lega riceve righe
   vuote, non un errore. Per questo caricaRighe() controlla che la lega ci sia. */
import { supabase } from '../lib/supabase.ts'
import type {
  RigaAssegnazione, RigaDataset, RigaIndisponibile, RigaLega, RigaLog, RigaMovimento, RigaPreferenze,
  RigaSqualificaAnnullata, RigaSquadra, RigaVoti, RigheLega,
} from './componi.ts'

type Risposta<T> = { data: T | null; error: { message: string; code?: string } | null }
function dati<T>(r: Risposta<T>, cosa: string): T {
  if (r.error) throw new Error(`${cosa}: ${r.error.message}`)
  return r.data as T
}

/* Le squadre, con il colore se il database ce l'ha. La colonna arriva con
   la migrazione colore_squadra: finché su un database non è applicata,
   chiederla fa fallire il caricamento dell'intera lega («column
   squadre.colore does not exist»). Allora si richiede senza: ogni squadra
   resta senza colore, il marchio usa l'ambra predefinita, e la Panoramica
   dice cosa manca invece di nasconderlo. Ogni altro errore resta un errore. */
const COLONNE_SQUADRE = 'id, nome, posizione, lega_idx'
export async function leggiSquadre(chiedi: (colonne: string) => PromiseLike<Risposta<RigaSquadra[]>>) {
  const r = await chiedi(`${COLONNE_SQUADRE}, colore`)
  const manca = !!r.error && (r.error.code === '42703' || /colore.*does not exist/i.test(r.error.message))
  if (!manca) return { squadre: dati(r, 'squadre'), coloreMancante: false }
  const senza = await chiedi(COLONNE_SQUADRE)
  return { squadre: dati(senza, 'squadre').map(s => ({ ...s, colore: null })), coloreMancante: true }
}

export async function caricaRighe(legaId: string, utenteId: string): Promise<RigheLega> {
  const [lega, sq, assegnazioni, log, movimenti, indisponibili, annullate, voti, dataset, preferenze] = await Promise.all([
    supabase.from('leghe').select('*').eq('id', legaId).maybeSingle(),
    // con le colonne in una variabile Supabase non conosce la forma delle righe: la si dichiara qui, al confine, come fa dati()
    leggiSquadre(colonne => supabase.from('squadre').select(colonne).eq('lega_id', legaId).order('posizione') as unknown as PromiseLike<Risposta<RigaSquadra[]>>),
    supabase.from('assegnazioni').select('giocatore_id, squadra_id, prezzo, snap').eq('lega_id', legaId),
    supabase.from('log_asta').select('giocatore_id, squadra_id, prezzo, registrata_il').eq('lega_id', legaId)
      .order('registrata_il', { ascending: false }).limit(500),
    supabase.from('movimenti').select('id, giornata, tipo, voci, agg, rimborso, costo, registrato_il').eq('lega_id', legaId),
    supabase.from('indisponibili').select('giocatore_id, motivo, da_giornata, segnato_il').eq('lega_id', legaId),
    supabase.from('squalifiche_annullate').select('giocatore_id, giornata').eq('lega_id', legaId),
    supabase.from('voti_giornata').select('giornata, voti').eq('lega_id', legaId),
    supabase.from('dataset').select('tipo, dati, meta').eq('lega_id', legaId),
    supabase.from('preferenze').select('mia_squadra, obiettivi, formazioni').eq('lega_id', legaId).eq('utente_id', utenteId).maybeSingle(),
  ])
  const l = dati<RigaLega | null>(lega, 'lega')
  if (!l) throw new Error('lega non trovata, o non ne fai parte')
  return {
    lega: l,
    squadre: sq.squadre,
    coloreMancante: sq.coloreMancante,
    assegnazioni: dati<RigaAssegnazione[]>(assegnazioni, 'assegnazioni'),
    log: dati<RigaLog[]>(log, 'registro d\'asta'),
    movimenti: dati<RigaMovimento[]>(movimenti, 'movimenti'),
    indisponibili: dati<RigaIndisponibile[]>(indisponibili, 'indisponibili'),
    squalificheAnnullate: dati<RigaSqualificaAnnullata[]>(annullate, 'squalifiche annullate'),
    voti: dati<RigaVoti[]>(voti, 'voti di giornata'),
    dataset: dati<RigaDataset[]>(dataset, 'file della lega'),
    preferenze: dati<RigaPreferenze | null>(preferenze, 'preferenze'),
  }
}

const TABELLE_DI_LEGA = ['squadre', 'assegnazioni', 'log_asta', 'movimenti', 'indisponibili',
  'squalifiche_annullate', 'voti_giornata', 'dataset', 'preferenze'] as const

/** avvisa a ogni riga cambiata della lega; restituisce la funzione per smettere */
export function ascoltaLega(legaId: string, cambiato: (tabella: string) => void) {
  let canale = supabase.channel(`lega:${legaId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'leghe', filter: `id=eq.${legaId}` }, () => cambiato('leghe'))
  for (const t of TABELLE_DI_LEGA)
    canale = canale.on('postgres_changes', { event: '*', schema: 'public', table: t, filter: `lega_id=eq.${legaId}` }, () => cambiato(t))
  canale.subscribe()
  return () => { void supabase.removeChannel(canale) }
}

/* ── le scritture d'asta passano dalle funzioni del database, che applicano
      le regole anche con più banditori (vedi la migrazione) ── */
export async function assegna(legaId: string, giocatoreId: number, squadraId: number, prezzo: number,
  snap: { id: number; r: string; n: string; s: string; q: number }) {
  const { data, error } = await supabase.rpc('assegna', {
    p_lega: legaId, p_giocatore: giocatoreId, p_squadra: squadraId, p_prezzo: prezzo, p_snap: snap,
  })
  if (error) throw new Error(error.message)
  return data
}

/* ── mercato: un movimento tocca registro, possesso e crediti insieme,
      quindi passa da una funzione del database (vedi la migrazione) ── */
export async function registraScambio(legaId: string, pidA: number, pidB: number, giornata: number) {
  const { error } = await supabase.rpc('registra_scambio', { p_lega: legaId, p_a: pidA, p_b: pidB, p_giornata: giornata })
  if (error) throw new Error(error.message)
}
export async function registraSvincolo(legaId: string, squadraId: number, fuori: number, dentro: number,
  rimborso: number, costo: number, giornata: number, snap: { id: number; r: string; n: string; s: string; q: number }) {
  const { error } = await supabase.rpc('registra_svincolo', {
    p_lega: legaId, p_squadra: squadraId, p_fuori: fuori, p_dentro: dentro,
    p_rimborso: rimborso, p_costo: costo, p_giornata: giornata, p_snap: snap,
  })
  if (error) throw new Error(error.message)
}
export async function annullaMovimento(legaId: string, id: number) {
  const { error } = await supabase.rpc('annulla_movimento', { p_lega: legaId, p_id: id })
  if (error) throw new Error(error.message)
}

/* ── rose ufficiali: il file della lega è la versione firmata ── */
export interface RigaAllinea { stato: string; pid: number; squadra: number; prezzo: number; snap?: unknown }
export async function allineaRose(legaId: string, righe: RigaAllinea[]) {
  const { data, error } = await supabase.rpc('allinea_rose', { p_lega: legaId, p_righe: righe })
  if (error) throw new Error(error.message)
  return data as { messi: number; tolti: number; corretti: number }
}
export async function salvaRoseMeta(legaId: string, meta: { nome: string; when: number; squadre: number; diverse: number }) {
  const { error } = await supabase.from('leghe').update({ rose_meta: meta }).eq('id', legaId)
  if (error) throw new Error(error.message)
}

/* ── infermeria: S.out, S.squalSalta, S.squalOn ── */
export async function segnaIndisponibile(legaId: string, giocatoreId: number, motivo: string, daGiornata: number) {
  const { error } = await supabase.from('indisponibili').upsert(
    { lega_id: legaId, giocatore_id: giocatoreId, motivo, da_giornata: daGiornata, segnato_il: new Date().toISOString() },
    { onConflict: 'lega_id,giocatore_id' },
  )
  if (error) throw new Error(error.message)
}
export async function togliIndisponibile(legaId: string, giocatoreId: number) {
  const { error } = await supabase.from('indisponibili').delete().eq('lega_id', legaId).eq('giocatore_id', giocatoreId)
  if (error) throw new Error(error.message)
}
/** la lega non applica questa squalifica: resta annotata e il motore la salta */
export async function annullaSqualifica(legaId: string, giocatoreId: number, giornata: number) {
  const { error } = await supabase.from('squalifiche_annullate').upsert(
    { lega_id: legaId, giocatore_id: giocatoreId, giornata }, { onConflict: 'lega_id,giocatore_id,giornata' },
  )
  if (error) throw new Error(error.message)
}
export async function impostaSqualifiche(legaId: string, attive: boolean) {
  const { error } = await supabase.from('leghe').update({ squal_on: attive }).eq('id', legaId)
  if (error) throw new Error(error.message)
}

/** «la mia squadra»: privata anche lei, in preferenze */
export async function salvaMiaSquadra(legaId: string, utenteId: string, squadraId: number | null) {
  const { error } = await supabase.from('preferenze').upsert(
    { lega_id: legaId, utente_id: utenteId, mia_squadra: squadraId, aggiornate_il: new Date().toISOString() },
    { onConflict: 'lega_id,utente_id' },
  )
  if (error) throw new Error(error.message)
}

/** quale nome del calendario di lega è questa squadra (S.legaMap): un nome
    appartiene a una squadra sola, chi lo aveva lo perde */
export async function salvaAbbinamento(legaId: string, squadraId: number, idx: number | null) {
  if (idx !== null) {
    const { error } = await supabase.from('squadre').update({ lega_idx: null }).eq('lega_id', legaId).eq('lega_idx', idx).neq('id', squadraId)
    if (error) throw new Error(error.message)
  }
  const { error } = await supabase.from('squadre').update({ lega_idx: idx }).eq('id', squadraId)
  if (error) throw new Error(error.message)
}

/** il colore di una squadra è un dato di lega: admin e banditori cambiano
    quello di tutte, ognuno quello della squadra che ha scelto come sua
    (vedi la migrazione colore_squadra). Si salva la tinta scelta, non
    quella corretta sul tema. */
export async function salvaColoreSquadra(legaId: string, squadraId: number, colore: string | null) {
  const { error } = await supabase.rpc('imposta_colore', { p_lega: legaId, p_squadra: squadraId, p_colore: colore })
  if (error) throw new Error(error.message)
}

/** gli obiettivi con il prezzo massimo sono privati come le formazioni */
export async function salvaObiettivi(legaId: string, utenteId: string, obiettivi: Record<string, { max?: number }>) {
  const { error } = await supabase.from('preferenze').upsert(
    { lega_id: legaId, utente_id: utenteId, obiettivi, aggiornate_il: new Date().toISOString() },
    { onConflict: 'lega_id,utente_id' },
  )
  if (error) throw new Error(error.message)
}

/** le formazioni sono private: stanno nella riga di preferenze di chi le fa */
export async function salvaFormazioni(legaId: string, utenteId: string, formazioni: Record<string, unknown>) {
  const { error } = await supabase.from('preferenze').upsert(
    { lega_id: legaId, utente_id: utenteId, formazioni, aggiornate_il: new Date().toISOString() },
    { onConflict: 'lega_id,utente_id' },
  )
  if (error) throw new Error(error.message)
}

export async function libera(legaId: string, giocatoreId: number) {
  const { error } = await supabase.rpc('libera', { p_lega: legaId, p_giocatore: giocatoreId })
  if (error) throw new Error(error.message)
}
