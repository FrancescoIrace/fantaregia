/* ══ La barra azione ═════════════════════════════════════════════════
   Sul telefono, sopra la navigazione, una fascia con l'azione principale
   della pagina: su Formazioni «Schiera la migliore» con modulo e
   punteggio, in Asta «Assegna» col giocatore chiamato e il prezzo, nel
   Listone «Filtri». Una pagina senza un'azione principale non ha fascia.

   La pagina dice qual è la sua azione con useAzione(); la disegna il
   guscio (Guscio.tsx), che è l'unico a fornire il contesto. Da scrivania
   il guscio non c'è, il contesto nemmeno, e useAzione() non fa niente:
   le pagine lo chiamano sempre, senza chiedersi dove sono.            */
import { createContext, useContext, useEffect, useRef } from 'react'

export interface Azione {
  titolo: string
  sotto?: string
  etichetta: string
  fai: () => void
  disabilitata?: boolean
}

export const ContestoAzione = createContext<((a: Azione | null) => void) | null>(null)

export function useAzione(azione: Azione | null) {
  const imposta = useContext(ContestoAzione)
  /* L'azione cambia a ogni disegno (fai è una funzione nuova ogni volta):
     al guscio si manda di nuovo solo quando cambia quello che si VEDE, e il
     pulsante chiama sempre l'ultima versione di fai, tenuta in un ref. */
  const ultima = useRef(azione)
  useEffect(() => { ultima.current = azione })
  const vista = azione ? `${azione.titolo}\n${azione.sotto ?? ''}\n${azione.etichetta}\n${!!azione.disabilitata}` : ''
  useEffect(() => {
    if (!imposta) return
    const a = ultima.current
    imposta(vista && a ? { ...a, fai: () => ultima.current?.fai() } : null)
  }, [imposta, vista])
  // la pagina se ne va: la sua fascia pure
  useEffect(() => () => { imposta?.(null) }, [imposta])
}
