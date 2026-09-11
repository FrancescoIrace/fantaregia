/* ══ Caricare i file della lega ══════════════════════════════════════
   Listone, calendario, rigoristi e statistiche sono «dataset»: si
   sostituiscono interi. I voti sono una riga per giornata. Scrivono admin
   e banditori (RLS); il realtime avvisa tutti gli altri.

   Niente di questo viene scaricato da solo da siti terzi: i file li porta
   chi li ha scaricati con il proprio account. L'unica fonte automatica è il
   calendario di openfootball, che è un dataset aperto di fatti.       */
import { supabase } from '../lib/supabase.ts'
import { creaMotore, type IngressoMotore } from '../domain/motore.ts'
import { calendarioDaOpenfootball, type PartitaAperta } from '../domain/importa.ts'
import type { VotoRiga } from '../domain/tipi.ts'
import type { TipoDataset } from './componi.ts'

export async function salvaDataset(legaId: string, tipo: TipoDataset, dati: unknown, meta: Record<string, unknown> = {}) {
  const { error } = await supabase.from('dataset').upsert(
    { lega_id: legaId, tipo, dati, meta, aggiornato_il: new Date().toISOString() },
    { onConflict: 'lega_id,tipo' },
  )
  if (error) throw new Error(error.message)
}

/* ── calendario da openfootball ── */
export function urlOpenfootball(stagione: string) {
  const [a, b] = stagione.split('/')            // «2026/27» → 2026-27
  return `https://raw.githubusercontent.com/openfootball/football.json/master/${a}-${b}/it.1.json`
}
export async function scaricaCalendario(stagione: string, squadreListone: string[]) {
  const r = await fetch(urlOpenfootball(stagione))
  if (!r.ok) throw new Error(`openfootball non ha ancora la stagione ${stagione} (${r.status})`)
  const j = await r.json() as { matches?: PartitaAperta[] }
  return calendarioDaOpenfootball(j.matches ?? [], squadreListone)
}

/* ── voti di giornata e i loro effetti sull'infermeria ──────────────
   Si calcola PRIMA di scrivere, confrontando il motore con e senza le
   giornate nuove: chi ha rigiocato esce dall'infermeria (rientri), chi
   arriva alla soglia dei gialli è squalificato. Nell'originale il
   confronto delle squalifiche avveniva dopo aver già messo i voti nuovi,
   e il messaggio non poteva mai comparire: qui è fra prima e dopo.   */
export function effettoVoti(ingresso: IngressoMotore, nuove: Record<number, Record<string, VotoRiga>>) {
  const prima = creaMotore(ingresso)
  const dopo = creaMotore({ ...ingresso, stato: { ...prima.S, stats: { ...prima.S.stats, ...nuove } } })
  const gia = new Set(prima.squalifiche().map(s => `${s.pid}-${s.g}`))
  return {
    rientri: dopo.rientri(),
    squalifiche: dopo.squalifiche().filter(s => !gia.has(`${s.pid}-${s.g}`)),
    rossi: dopo.rossiDaVedere(),
    diffidati: dopo.diffidati(),
    nome: (pid: number) => dopo.giocatoreDi(pid)?.n ?? `#${pid}`,
  }
}

export async function salvaVoti(legaId: string, giornate: { g: number; voti: Record<string, VotoRiga> }[], foglio: string, rientri: number[]) {
  const { error } = await supabase.from('voti_giornata').upsert(
    giornate.map(x => ({ lega_id: legaId, giornata: x.g, voti: x.voti, foglio, caricata_il: new Date().toISOString() })),
    { onConflict: 'lega_id,giornata' },
  )
  if (error) throw new Error(error.message)
  // il foglio scelto resta come preferenza della lega, come votiMeta.sheet
  await supabase.from('leghe').update({ voti_meta: { sheet: foglio } }).eq('id', legaId)
  if (rientri.length) {
    const { error: e2 } = await supabase.from('indisponibili').delete().eq('lega_id', legaId).in('giocatore_id', rientri)
    if (e2) throw new Error(`voti salvati, ma non sono riuscito a togliere i rientrati dall'infermeria: ${e2.message}`)
  }
}

export async function togliGiornata(legaId: string, g: number) {
  const { error } = await supabase.from('voti_giornata').delete().eq('lega_id', legaId).eq('giornata', g)
  if (error) throw new Error(error.message)
}
