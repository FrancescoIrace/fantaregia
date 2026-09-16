/* ══ Cambiando pagina si riparte dall'alto ════════════════════════════
   L'app è una pagina sola: passando da una scheda all'altra il browser non
   ricarica niente, e lo scorrimento resta dov'era. Sul telefono, dove scorre
   la pagina intera (niente liste che scorrono per conto loro), si apriva
   Formazioni già a metà, all'altezza a cui si era lasciato il Listone.

   Conta il percorso, non l'indirizzo intero: una ricerca o un'ancora che
   cambiano dentro la stessa pagina non la fanno saltare in cima. */
import { useEffect } from 'react'
import { useLocation } from 'react-router'

export default function InCima() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}
