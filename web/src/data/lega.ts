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

type Risposta<T> = { data: T | null; error: { message: string } | null }
function dati<T>(r: Risposta<T>, cosa: string): T {
  if (r.error) throw new Error(`${cosa}: ${r.error.message}`)
  return r.data as T
}

export async function caricaRighe(legaId: string, utenteId: string): Promise<RigheLega> {
  const [lega, squadre, assegnazioni, log, movimenti, indisponibili, annullate, voti, dataset, preferenze] = await Promise.all([
    supabase.from('leghe').select('*').eq('id', legaId).maybeSingle(),
    supabase.from('squadre').select('id, nome, posizione, lega_idx').eq('lega_id', legaId).order('posizione'),
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
    squadre: dati<RigaSquadra[]>(squadre, 'squadre'),
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
