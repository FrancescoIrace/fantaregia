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

/* La barra del browser sul telefono non legge i token: senza questo resta
   chiara sopra il tema notte, e sembra la striscia di un'altra app appiccicata
   in cima. Il valore è --fr-pan, cioè quello che sta appena sotto la barra —
   la testata, che è pannello sia nel guscio del telefono sia da scrivania.

   Come la tinta, si legge DOPO aver scritto l'attributo: il valore viene dai
   token del tema corrente, e leggerlo prima darebbe quello che si sta
   lasciando. Il meta lo crea se non c'è, così vale anche fuori da index.html. */
function scriviColoreTema(radice: HTMLElement) {
  const fondo = getComputedStyle(radice).getPropertyValue('--fr-pan').trim()
  if (!fondo) return
  let meta = document.head.querySelector('meta[name="theme-color"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.setAttribute('name', 'theme-color')
    document.head.appendChild(meta)
  }
  meta.setAttribute('content', fondo)
}

export function applicaTema(tema: Tema | null) {
  const radice = document.documentElement
  if (tema) radice.dataset.tema = tema
  else delete radice.dataset.tema
  scriviColoreTema(radice)
  riapplicaTinta()
}

export function scegliTema(tema: Tema | null) {
  try {
    if (tema) localStorage.setItem(CHIAVE, tema)
    else localStorage.removeItem(CHIAVE)
  } catch { /* senza memoria locale vale per questa visita */ }
  applicaTema(tema)
}
