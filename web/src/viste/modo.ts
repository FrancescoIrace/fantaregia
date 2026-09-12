import type { Motore } from '../domain/motore.ts'

/* ══ Modalità asta: riordina il menu ═════════════════════════════════
   Port di part5 §"Modalità asta". Le stesse pagine, in un ordine
   diverso. Con l'asta accesa vengono prima quelle che servono a
   comprare, spenta quelle che servono a giocare le giornate. È una
   preferenza di chi guarda, quindi resta sul dispositivo: niente
   database, come l'ordine dell'infermeria e le rose chiuse.

   Le chiavi sono quelle dell'originale tradotte nelle rotte di qui:
   giornate → formazioni, lega → scontri. «Lega e dati» non c'è più come
   voce a sé (carica dati e rose ufficiali stanno nella Panoramica), e
   Mercato è nuova: nell'app a file singolo i movimenti stavano dentro
   «Lega e dati», quindi non aveva una posizione da rispettare. Le prime
   quattro di ogni modalità sono quelle dell'originale, invariate.     */
export type Modo = 'asta' | 'stagione'
export type Scheda = 'asta' | 'listone' | 'titolari' | 'rose' | 'calendario'
  | 'rendimento' | 'formazioni' | 'scontri' | 'infermeria' | 'mercato'

export const ORDINE: Record<Modo, Scheda[]> = {
  asta:     ['asta', 'listone', 'titolari', 'rose', 'calendario', 'rendimento', 'formazioni', 'scontri', 'infermeria', 'mercato'],
  stagione: ['formazioni', 'scontri', 'infermeria', 'titolari', 'mercato', 'rendimento', 'calendario', 'listone', 'rose', 'asta'],
}
export const PRIME = 4   // quante voci sono "quelle del momento"

/* alla prima apertura decide da sola: se l'asta non è finita, è modalità
   asta. Stesso conto di modoAsta() nell'originale. */
export function modoAuto(m: Motore): Modo {
  const presi = Object.keys(m.S.assign).length
  const servono = m.totalSlots() * m.S.teams.length
  return servono > 0 && presi >= servono ? 'stagione' : 'asta'
}

const chiave = (legaId: string) => `fantaregia:modo:${legaId}`

export function modoSalvato(legaId: string): Modo | null {
  try { const v = localStorage.getItem(chiave(legaId)); return v === 'asta' || v === 'stagione' ? v : null } catch { return null }
}

export function salvaModo(legaId: string, modo: Modo) {
  try { localStorage.setItem(chiave(legaId), modo) } catch { /* senza memoria locale vale per questa visita */ }
}
