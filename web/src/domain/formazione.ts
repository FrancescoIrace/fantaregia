/* ══ La formazione di giornata ═══════════════════════════════════════
   Le operazioni di «Giornate» dell'app a file singolo (part5: lineup,
   emptyLine, putInSlot, syncBench, ordinaPanchina, frecce della panchina)
   senza DOM e senza mutare niente: ognuna prende una formazione e ne
   restituisce una nuova. La formazione di chi guarda è privata: si salva
   in preferenze.formazioni, {giornata: {mod, start, bench}}.          */
import { MODULI, ROLES } from './motore.ts'
import type { Giocatore, Ruolo } from './tipi.ts'

export interface Formazione {
  mod: string
  start: Record<Ruolo, (number | null)[]>
  bench: number[]
}

export const ordRuolo = (r: Ruolo | undefined) => r ? ({ P: 0, D: 1, C: 2, A: 3 } as const)[r] : 9

const bisogno = (mod: string): Record<Ruolo, number> => {
  const [d, c, a] = MODULI[mod]
  return { P: 1, D: d, C: c, A: a }
}

/** emptyLine: tutte le caselle vuote per quel modulo */
export function vuota(mod = '3-4-3'): Formazione {
  const n = bisogno(mod)
  return { mod, start: { P: Array(n.P).fill(null), D: Array(n.D).fill(null), C: Array(n.C).fill(null), A: Array(n.A).fill(null) }, bench: [] }
}

/** lineup: una formazione valida, con le caselle adeguate al suo modulo (si tengono le prime) */
export function normalizza(L?: Partial<Formazione> | null): Formazione {
  if (!L || !L.mod || !MODULI[L.mod]) return vuota('3-4-3')
  const n = bisogno(L.mod)
  const start = {} as Formazione['start']
  for (const r of ROLES) {
    const s = (L.start?.[r] ?? []).slice(0, n[r])
    while (s.length < n[r]) s.push(null)
    start[r] = s
  }
  return { mod: L.mod, start, bench: [...(L.bench ?? [])] }
}

export const conModulo = (L: Formazione, mod: string) => normalizza({ ...L, mod })

export function usati(L: Formazione) {
  const s = new Set<number>()
  for (const r of ROLES) for (const id of L.start[r]) if (id) s.add(id)
  return s
}

/** syncBench: in panchina tutti e soli quelli della rosa fuori dall'undici;
    chi manca va in coda, per reparto e poi per punteggio di giornata */
export function sincronizzaPanchina(L: Formazione, rosa: Giocatore[], punteggio: (p: Giocatore) => number) {
  const dentro = usati(L)
  const fuori = rosa.filter(p => !dentro.has(p.id))
  const ids = new Set(fuori.map(p => p.id))
  const bench = L.bench.filter(id => ids.has(id))
  for (const p of [...fuori].sort((x, y) => ordRuolo(x.r) - ordRuolo(y.r) || punteggio(y) - punteggio(x)))
    if (!bench.includes(p.id)) bench.push(p.id)
  return bench
}

/** putInSlot: se il giocatore era in un'altra casella dello stesso reparto, le due si scambiano */
export function metti(L: Formazione, r: Ruolo, i: number, pid: number): Formazione {
  const riga = [...L.start[r]]
  const j = riga.indexOf(pid)
  if (j >= 0 && j !== i) riga[j] = riga[i]
  riga[i] = pid
  return { ...L, start: { ...L.start, [r]: riga } }
}

/** le frecce della panchina */
export function sposta(bench: number[], i: number, d: number) {
  const j = i + d
  if (j < 0 || j >= bench.length) return bench
  const b = [...bench]; [b[i], b[j]] = [b[j], b[i]]
  return b
}

/** «Ordina per ruolo»: portieri, difensori, centrocampisti, attaccanti; dentro il reparto chi rende di più */
export function ordinaPerRuolo(bench: number[], ruoloDi: (id: number) => Ruolo | undefined, punteggio: (id: number) => number) {
  return [...bench].sort((a, b) => ordRuolo(ruoloDi(a)) - ordRuolo(ruoloDi(b)) || punteggio(b) - punteggio(a))
}

/* ══ Il generatore di formazione, con i vincoli di chi guarda ════════
   formazioneAutomatica() del motore resta com'è (port 1:1). Qui la stessa
   scelta — per reparto i disponibili in ordine di punteggio di giornata,
   la panchina per reparto e punteggio — con due vincoli: il modulo, e i
   titolari fissi, che entrano per primi. Senza fissi deve dare esattamente
   la formazione del motore: lo controlla web/test/formazione-auto.test.ts.

   Quello che non torna non si scarta in silenzio: finisce nelle note.  */
export type NotaFormazione =
  | { tipo: 'modulo-scoperto'; mod: string; manca: Partial<Record<Ruolo, number>>; proposto: string | null }
  | { tipo: 'fissi-troppi'; mod: string; r: Ruolo; fuori: number[] }
  | { tipo: 'fisso-indisponibile'; pid: number }

export function disponibiliPerRuolo(rosa: Giocatore[], indisponibile: (id: number) => boolean) {
  const n: Record<Ruolo, number> = { P: 0, D: 0, C: 0, A: 0 }
  for (const p of rosa) if (!indisponibile(p.id)) n[p.r]++
  return n
}

/** il modulo che i disponibili coprono, più vicino a quello chiesto:
    meno caselle spostate fra i reparti, a parità vince l'ordine di MODULI */
export function moduloVicino(disp: Record<Ruolo, number>, mod: string): string | null {
  if (disp.P < 1) return null
  const [d, c, a] = MODULI[mod]
  let meglio: string | null = null, distanza = Infinity
  for (const [k, [kd, kc, ka]] of Object.entries(MODULI)) {
    if (kd > disp.D || kc > disp.C || ka > disp.A) continue
    const x = Math.abs(kd - d) + Math.abs(kc - c) + Math.abs(ka - a)
    if (x < distanza) { distanza = x; meglio = k }
  }
  return meglio
}

export function generaFormazione(rosa: Giocatore[], mod: string, { punteggio, indisponibile, fissi = [] }: {
  punteggio: (p: Giocatore) => number
  indisponibile: (id: number) => boolean
  fissi?: number[]
}): { formazione: Formazione; note: NotaFormazione[] } {
  const need = bisogno(mod)
  const note: NotaFormazione[] = []

  const disp = disponibiliPerRuolo(rosa, indisponibile)
  const manca: Partial<Record<Ruolo, number>> = {}
  for (const r of ROLES) if (disp[r] < need[r]) manca[r] = need[r] - disp[r]
  if (Object.keys(manca).length) note.push({ tipo: 'modulo-scoperto', mod, manca, proposto: moduloVicino(disp, mod) })

  const inRosa = new Map(rosa.map(p => [p.id, p]))
  const presi = new Set<number>()
  const start = { P: [], D: [], C: [], A: [] } as Formazione['start']

  // prima i fissi, nell'ordine in cui sono stati fissati
  const fuori: Partial<Record<Ruolo, number[]>> = {}
  for (const id of fissi) {
    const p = inRosa.get(id)
    if (!p || presi.has(id)) continue                   // non è più in rosa: niente da schierare
    if (indisponibile(id)) { note.push({ tipo: 'fisso-indisponibile', pid: id }); continue }
    if (start[p.r].length < need[p.r]) { start[p.r].push(id); presi.add(id) }
    else (fuori[p.r] ??= []).push(id)
  }
  for (const r of ROLES) if (fuori[r]?.length) note.push({ tipo: 'fissi-troppi', mod, r, fuori: fuori[r]! })

  // poi il resto, per punteggio di giornata: la scelta di formazioneAutomatica()
  for (const r of ROLES) {
    const pool = rosa.filter(p => p.r === r && !indisponibile(p.id)).sort((x, y) => punteggio(y) - punteggio(x))
    while (start[r].length < need[r]) {
      const p = pool.find(z => !presi.has(z.id))
      if (p) { presi.add(p.id); start[r].push(p.id) } else start[r].push(null)
    }
  }
  const bench = rosa.filter(p => !presi.has(p.id))
    .sort((x, y) => ordRuolo(x.r) - ordRuolo(y.r) || punteggio(y) - punteggio(x)).map(p => p.id)
  return { formazione: { mod, start, bench }, note }
}

const NOMI_RUOLO: Record<Ruolo, [string, string]> = {
  P: ['portiere', 'portieri'], D: ['difensore', 'difensori'], C: ['centrocampista', 'centrocampisti'], A: ['attaccante', 'attaccanti'],
}
const NEL_REPARTO: Record<Ruolo, string> = { P: 'in porta', D: 'in difesa', C: 'a centrocampo', A: 'in attacco' }

/** la nota in una frase, con i nomi dei giocatori */
export function descriviNota(n: NotaFormazione, nome: (id: number) => string) {
  if (n.tipo === 'modulo-scoperto') {
    const voci = (Object.entries(n.manca) as [Ruolo, number][])
    const tot = voci.reduce((a, [, k]) => a + k, 0)
    const lista = voci.map(([r, k]) => `${k} ${NOMI_RUOLO[r][k === 1 ? 0 : 1]}`).join(' e ')
    return `Il ${n.mod} non si può schierare: ${tot === 1 ? 'manca' : 'mancano'} ${lista} disponibil${tot === 1 ? 'e' : 'i'}.`
      + (n.proposto ? ` Il modulo più vicino che la rosa copre è il ${n.proposto}.` : ' Nessun modulo è completo con i giocatori disponibili.')
  }
  if (n.tipo === 'fissi-troppi') {
    return `Troppi titolari fissi ${NEL_REPARTO[n.r]} per il ${n.mod}: ${n.fuori.map(nome).join(', ')} ${n.fuori.length === 1 ? 'resta' : 'restano'} fuori.`
  }
  return `${nome(n.pid)} è un titolare fisso, ma è segnato indisponibile: non l'ho schierato.`
}
