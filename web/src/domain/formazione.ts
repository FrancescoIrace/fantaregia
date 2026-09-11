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
