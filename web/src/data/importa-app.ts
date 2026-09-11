/* ══ Importare una lega dall'app a file singolo ═════════════════════
   Due file possibili:
   · la pagina Fantaregia.html (o SalaAsta-Fantacalcio.html) scaricata
     dall'artifact: dentro c'è tutto — listone, calendario, rigoristi,
     statistiche della stagione scorsa e lo stato della lega;
   · il backup .json esportato da «Lega e dati»: solo lo stato della lega.

   Il file si legge nel browser e non va da nessuna parte se non nella
   lega privata di chi importa (RLS). Il JavaScript della pagina non viene
   mai eseguito: si leggono solo i dati del blocco <script id="fa-data">,
   che sono JSON.                                                       */
import { DEF } from '../domain/motore.ts'
import type { Calendario, GiocatoreGrezzo, Rigoristi, StatoLega, Storico } from '../domain/tipi.ts'
import type { TipoDataset } from './componi.ts'

export interface FileApp {
  origine: 'pagina' | 'backup'
  players: GiocatoreGrezzo[]
  cal: Calendario | null
  rig: Rigoristi | null
  hist: Storico | null
  shared: Partial<StatoLega>
  meta: { name?: string; when?: number | null; count?: number } | null
}

const APERTURA = '<script id="fa-data">'

/* I valori stanno uno dopo l'altro: window.PLAYERS=[…];window.CAL={…};…
   Ognuno finisce dove comincia il successivo. Se un testo contenesse per
   caso «window.X=», il pezzo non sarebbe JSON valido e si allunga fino al
   prossimo punto buono. */
function leggiBlocco(blocco: string): Record<string, unknown> {
  const re = /window\.([A-Z]+)=/g
  const punti: { nome: string; inizio: number; da: number }[] = []
  for (let m; (m = re.exec(blocco));) punti.push({ nome: m[1], inizio: m.index, da: m.index + m[0].length })
  const out: Record<string, unknown> = {}
  for (let k = 0; k < punti.length;) {
    let fine = k + 1, fatto = false
    for (; fine <= punti.length && !fatto; fine++) {
      let s = blocco.slice(punti[k].da, fine < punti.length ? punti[fine].inizio : blocco.length).trim()
      if (s.endsWith(';')) s = s.slice(0, -1)
      try { out[punti[k].nome] = JSON.parse(s); fatto = true } catch { /* si allunga */ }
    }
    if (!fatto) throw new Error(`non riesco a leggere window.${punti[k].nome} nella pagina`)
    k = fine - 1
  }
  return out
}

export function leggiFileApp(testo: string): FileApp {
  const t = testo.trimStart()
  if (t.startsWith('{')) {
    const d = JSON.parse(t) as { shared?: Partial<StatoLega>; meta?: FileApp['meta'] } & Partial<StatoLega>
    const sh = d.shared || d
    if (!sh.teams || !sh.assign) throw new Error('non è un backup di Fantaregia')
    return { origine: 'backup', players: [], cal: null, rig: null, hist: null, shared: sh, meta: d.meta ?? null }
  }
  const i = testo.indexOf(APERTURA)
  if (i < 0) throw new Error('non trovo i dati: il file non sembra una pagina di Fantaregia')
  const fine = testo.indexOf('</script>', i)
  const v = leggiBlocco(testo.slice(i + APERTURA.length, fine < 0 ? undefined : fine))
  const sh = v.SHARED as Partial<StatoLega> | null
  if (!sh || !sh.teams || !sh.assign)
    throw new Error('la pagina non contiene una lega: è una build vuota, non quella scaricata dall\'app in uso')
  const cal = v.CAL as Calendario | undefined
  return {
    origine: 'pagina',
    players: (v.PLAYERS as GiocatoreGrezzo[] | undefined) ?? [],
    cal: cal && cal.teams && cal.teams.length ? cal : null,
    rig: (v.RIG as Rigoristi | undefined) ?? null,
    hist: (v.HIST as Storico | undefined) ?? null,
    shared: sh,
    meta: (v.LISTMETA as FileApp['meta']) ?? null,
  }
}

/* ── il pacchetto che importa_lega() si aspetta ── */
export interface PacchettoImport {
  lega: { budget: number; slots: StatoLega['slots']; plan: StatoLega['plan']; squal_on: boolean; voti_meta: StatoLega['votiMeta']; rose_meta: StatoLega['roseMeta'] | null }
  squadre: { vecchio_id: number; nome: string; posizione: number; lega_idx: number | null }[]
  assegnazioni: { giocatore_id: number; squadra: number; prezzo: number; snap: unknown }[]
  log: { giocatore_id: number; squadra: number; prezzo: number; quando: string | null }[]
  movimenti: { giornata: number; tipo: string; voci: unknown; agg: Record<string, number>; rimborso: number | null; costo: number | null; quando: string | null }[]
  indisponibili: { giocatore_id: number; motivo: string | null; da_giornata: number | null; quando: string | null }[]
  squalifiche_annullate: { giocatore_id: number; giornata: number }[]
  voti: { giornata: number; voti: unknown }[]
  dataset: { tipo: TipoDataset; dati: unknown; meta: Record<string, unknown> }[]
}
export interface Riepilogo {
  squadre: number; assegnazioni: number; giornate: number; movimenti: number; indisponibili: number
  giocatori: number; calendario: boolean; rigoristi: number; storico: number; calendarioLega: boolean
  avvisi: string[]
}

const iso = (t: unknown) => typeof t === 'number' && Number.isFinite(t) ? new Date(t).toISOString() : null
const giornata = (g: unknown) => typeof g === 'number' && g >= 1 && g <= 38

export function preparaImport(f: FileApp): { pacchetto: PacchettoImport; riepilogo: Riepilogo } {
  // stessa fusione di applyBackup(): quello che manca prende il valore di partenza
  const S: StatoLega = Object.assign(structuredClone(DEF), f.shared)
  const avvisi: string[] = []
  const squadra = new Set(S.teams.map(t => t.id))

  const assegnazioni = Object.entries(S.assign)
    .filter(([pid, a]) => {
      if (squadra.has(a.team)) return true
      avvisi.push(`il giocatore ${a.snap?.n ?? '#' + pid} era assegnato a una squadra che non esiste più: lasciato fuori`)
      return false
    })
    .map(([pid, a]) => ({ giocatore_id: +pid, squadra: a.team, prezzo: a.price || 0, snap: a.snap ?? null }))

  const indisponibili = Object.entries(S.out || {}).filter(([, v]) => v).map(([pid, v]) =>
    typeof v === 'object'
      ? { giocatore_id: +pid, motivo: v.motivo ?? null, da_giornata: giornata(v.da) ? v.da! : null, quando: iso(v.ts) }
      : { giocatore_id: +pid, motivo: null, da_giornata: null, quando: null })

  const voti = Object.entries(S.stats || {}).filter(([g]) => giornata(+g)).map(([g, v]) => ({ giornata: +g, voti: v }))

  const dataset: PacchettoImport['dataset'] = []
  if (f.players.length) dataset.push({ tipo: 'listone', dati: f.players, meta: f.meta ? { ...f.meta } : {} })
  if (f.cal) dataset.push({ tipo: 'calendario', dati: f.cal, meta: {} })
  if (f.rig && Object.keys(f.rig).length) dataset.push({ tipo: 'rigoristi', dati: f.rig, meta: {} })
  if (f.hist && Object.keys(f.hist).length) dataset.push({ tipo: 'storico', dati: f.hist, meta: {} })
  if (S.lega && S.lega.gior && S.lega.gior.length) dataset.push({ tipo: 'calendario_lega', dati: S.lega, meta: {} })

  const pacchetto: PacchettoImport = {
    lega: { budget: S.budget, slots: S.slots, plan: S.plan, squal_on: S.squalOn !== false, voti_meta: S.votiMeta || {}, rose_meta: S.roseMeta ?? null },
    squadre: S.teams.map((t, i) => {
      const idx = S.legaMap?.[t.id]
      return { vecchio_id: t.id, nome: t.name, posizione: i + 1, lega_idx: typeof idx === 'number' && idx >= 0 ? idx : null }
    }),
    assegnazioni,
    log: (S.log || []).filter(l => squadra.has(l.team))
      .map(l => ({ giocatore_id: l.pid, squadra: l.team, prezzo: l.price, quando: iso(l.t) })),
    movimenti: (Array.isArray(S.moves) ? S.moves : []).filter(m => giornata(m.g))
      .map(m => ({ giornata: m.g, tipo: m.tipo, voci: m.voci, agg: m.agg || {}, rimborso: m.rimborso ?? null, costo: m.costo ?? null, quando: iso(m.ts) })),
    indisponibili,
    squalifiche_annullate: Object.keys(S.squalSalta || {}).map(k => k.split('-').map(Number))
      .filter(([pid, g]) => pid > 0 && giornata(g)).map(([pid, g]) => ({ giocatore_id: pid, giornata: g })),
    voti,
    dataset,
  }
  if (!f.players.length) avvisi.push('il file non ha il listone: gli indici restano spenti finché non ne carichi uno')
  if (!f.cal) avvisi.push('il file non ha il calendario di serie A: niente indice calendario né prossime partite')

  return {
    pacchetto,
    riepilogo: {
      squadre: pacchetto.squadre.length, assegnazioni: assegnazioni.length, giornate: voti.length,
      movimenti: pacchetto.movimenti.length, indisponibili: indisponibili.length,
      giocatori: f.players.length, calendario: !!f.cal, rigoristi: f.rig ? Object.keys(f.rig).length : 0,
      storico: f.hist ? Object.keys(f.hist).length : 0, calendarioLega: dataset.some(d => d.tipo === 'calendario_lega'),
      avvisi,
    },
  }
}
