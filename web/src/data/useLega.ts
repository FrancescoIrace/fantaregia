import { useEffect, useMemo, useState } from 'react'
import { creaMotore } from '../domain/motore.ts'
import { ingressoMotore, type RigheLega } from './componi.ts'
import { ascoltaLega, caricaRighe } from './lega.ts'

/* Una lega viva: si carica, e a ogni riga cambiata da chiunque (realtime)
   si ricarica e il motore si ricalcola. La pagina non si ricarica mai e
   quello che si sta facendo — una ricerca, un prezzo digitato — resta lì. */
export function useLega(legaId: string, utenteId: string) {
  const [righe, setRighe] = useState<RigheLega | null>(null)
  const [errore, setErrore] = useState<string | null>(null)
  const [giro, setGiro] = useState(0)

  useEffect(() => {
    let vivo = true
    caricaRighe(legaId, utenteId).then(
      r => { if (vivo) { setRighe(r); setErrore(null) } },
      (e: Error) => { if (vivo) setErrore(e.message) },
    )
    return () => { vivo = false }
  }, [legaId, utenteId, giro])

  useEffect(() => {
    // più righe cambiate insieme (un import, una giornata di voti) sono un giro solo
    let attesa: ReturnType<typeof setTimeout> | undefined
    const smetti = ascoltaLega(legaId, () => {
      clearTimeout(attesa)
      attesa = setTimeout(() => setGiro(g => g + 1), 250)
    })
    return () => { clearTimeout(attesa); smetti() }
  }, [legaId])

  const motore = useMemo(() => {
    if (!righe) return null
    const ingresso = ingressoMotore(righe)
    // la finestra di giornate parte da oggi, come faceva allineaGiornate()
    const oggi = creaMotore(ingresso).giornataOggi()
    return creaMotore({ ...ingresso, finestra: { from: oggi, span: 5 } })
  }, [righe])

  return { righe, motore, errore, ricarica: () => setGiro(g => g + 1) }
}
