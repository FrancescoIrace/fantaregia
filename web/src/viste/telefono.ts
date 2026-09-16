/* ══ Il punto di rottura ═════════════════════════════════════════════
   Uno solo, e struttura: sotto, il guscio del telefono, il campo in
   prospettiva e le liste al posto delle tabelle; sopra, esattamente
   l'app di prima. Le rifiniture già misurate dentro il mobile (620px:
   colonne secondarie del Listone, squadra di serie A in panchina)
   restano dove sono — sono decisioni di fantaregia-design.md prese su
   misure vere, non deroghe da togliere.

   Il numero vive qui e nei fogli di stile, e non c'è modo di averne uno
   solo: il CSS non legge le costanti di TypeScript. Quando si tocca,
   si tocca in tutti e due — cercare «899.98» li trova.

   899.98 e non 900: `max-width:900px` e `min-width:900px` sono veri
   tutti e due a 900px esatti, e su uno schermo largo così si vedevano
   per un istante le due navigazioni insieme.

   Il nome del gancio è in inglese come useLega e useSessione: React
   riconosce i ganci dal prefisso «use», e l'italiano resta per tutto
   il resto.                                                           */
import { useSyncExternalStore } from 'react'

export const TELEFONO = '(max-width: 899.98px)'

const ascolta = (cambiato: () => void) => {
  const mq = matchMedia(TELEFONO)
  mq.addEventListener('change', cambiato)
  return () => mq.removeEventListener('change', cambiato)
}

/* Con useSyncExternalStore il valore è giusto già al primo disegno: un
   useEffect farebbe partire la pagina da scrivania e la cambierebbe
   subito dopo, cioè un lampo di schede orizzontali a ogni apertura.
   Fuori dal browser (i test di resa con react-dom/server) vale «no»:
   quei test guardano le viste, non il guscio. */
export const useTelefono = () => useSyncExternalStore(
  ascolta,
  () => matchMedia(TELEFONO).matches,
  () => false,
)
