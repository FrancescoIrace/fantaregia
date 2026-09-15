/* ══ Il tema: notte, giorno, o quello del sistema ════════════════════
   Preferenza di chi guarda, quindi resta sul dispositivo come la modalità
   asta: niente database. null vuol dire «come il sistema», ed è anche il
   valore di partenza — i token lo gestiscono con :root:not([data-tema]).

   L'ordine conta: prima l'attributo, poi la tinta. La correzione del
   marchio legge il fondo del pannello, e riapplicandola prima correggerebbe
   la tinta sul tema che si sta lasciando.                               */
import { riapplicaTinta } from './colore-squadra.ts'

export type Tema = 'notte' | 'giorno'
const CHIAVE = 'fantaregia:tema'

export function temaSalvato(): Tema | null {
  try { const v = localStorage.getItem(CHIAVE); return v === 'notte' || v === 'giorno' ? v : null } catch { return null }
}

export function applicaTema(tema: Tema | null) {
  const radice = document.documentElement
  if (tema) radice.dataset.tema = tema
  else delete radice.dataset.tema
  riapplicaTinta()
}

export function scegliTema(tema: Tema | null) {
  try {
    if (tema) localStorage.setItem(CHIAVE, tema)
    else localStorage.removeItem(CHIAVE)
  } catch { /* senza memoria locale vale per questa visita */ }
  applicaTema(tema)
}
