/* ══ I disegni delle pagine ══════════════════════════════════════════
   Un tracciato per pagina, condiviso fra la barra del telefono, il suo
   cassetto e i bottoni della dashboard «Oggi»: la stessa pagina si
   riconosce dallo stesso segno ovunque la si tocchi. Sono tratti, non
   riempimenti, così seguono il colore di chi li contiene.            */
import type { Scheda } from './modo.ts'

export const ICONE: Record<Scheda, string> = {
  scontri:    'M4 6h16v14H4zM4 10h16M9 3v4M15 3v4M8 15h3',
  formazioni: 'M9 4l3 2 3-2 4 3-2 3v8H7v-8L5 7z',
  infermeria: 'M12 8v8M8 12h8M5 5h14v14H5z',
  titolari:   'M12 3a4 4 0 100 8 4 4 0 000-8zM4 21a8 8 0 0116 0',
  asta:       'M5 19h9M8 4l6 6M11 3l4 4-5 5-4-4zM13 11l5 5',
  listone:    'M4 7h16M4 12h16M4 17h10',
  rose:       'M4 6h16v12H4zM4 10h16M10 10v8',
  calendario: 'M4 6h16v14H4zM4 10h16M9 3v4M15 3v4',
  rendimento: 'M3 17l5-6 4 3 5-7 4 4',
  mercato:    'M4 8h12l-3-3M20 16H8l3 3',
}
export const ICONA_OGGI = 'M4 11l8-7 8 7M6 9.5V20h12V9.5M10 20v-5h4v5'
export const ICONA_PANORAMICA = 'M4 13h7V4H4zM13 20h7v-9h-7zM4 20h7v-4H4zM13 8h7V4h-7z'
export const ICONA_LUNA = 'M20 14a8 8 0 01-10-10 8 8 0 1010 10z'
export const ICONA_MENU = 'M4 7h16M4 12h16M4 17h16'
export const ICONA_LEGHE = 'M4 6h16M4 12h16M4 18h10'
export const ICONA_ESCI = 'M10 17l5-5-5-5M15 12H3M13 4h6v16h-6'
