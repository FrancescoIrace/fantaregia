/* ══ Preferenze della formazione: modulo preferito e titolari fissi ══
   Di chi guarda e di questo dispositivo, come la modalità asta: niente
   database. Una chiave per lega, perché ogni lega ha la sua rosa. Un
   valore rovinato in memoria vale come «nessuna preferenza».          */
import { MODULI } from '../domain/motore.ts'

const chiave = (cosa: 'modulo' | 'fissi', legaId: string) => `fantaregia:${cosa}:${legaId}`

export function moduloPreferito(legaId: string): string | null {
  try {
    const v = localStorage.getItem(chiave('modulo', legaId))
    return v && Object.hasOwn(MODULI, v) ? v : null
  } catch { return null }
}

export function salvaModuloPreferito(legaId: string, mod: string | null) {
  try {
    if (mod) localStorage.setItem(chiave('modulo', legaId), mod)
    else localStorage.removeItem(chiave('modulo', legaId))
  } catch { /* senza memoria locale vale per questa visita */ }
}

/** nell'ordine in cui sono stati fissati: se sono troppi per il reparto, entrano i primi */
export function titolariFissi(legaId: string): number[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(chiave('fissi', legaId)) ?? '[]')
    return Array.isArray(v) ? [...new Set(v.filter((x): x is number => Number.isInteger(x) && x > 0))] : []
  } catch { return [] }
}

export function salvaTitolariFissi(legaId: string, ids: number[]) {
  try { localStorage.setItem(chiave('fissi', legaId), JSON.stringify(ids)) } catch { /* senza memoria locale vale per questa visita */ }
}
