import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { supabase } from '../lib/supabase.ts'
import { Avviso, Bottone, Card, Suggerimento } from '../ui.tsx'
import Accesso from './Accesso.tsx'

/* Il link d'invito: chi non ha un account lo crea qui, poi accetta. */
export default function Invito({ haSessione }: { haSessione: boolean }) {
  const { codice = '' } = useParams()
  const vai = useNavigate()
  const [errore, setErrore] = useState<string | null>(null)
  const [invio, setInvio] = useState(false)

  if (!haSessione) return <Accesso motivo="Ti hanno invitato in una lega: entra, o crea un account, e poi accetti l'invito." />

  async function accetta() {
    setInvio(true); setErrore(null)
    const { data, error } = await supabase.rpc('unisciti', { p_codice: codice })
    setInvio(false)
    if (error) return setErrore(error.message)
    vai(`/lega/${data as string}`)
  }

  return (
    <div className="mx-auto max-w-sm">
      <Card titolo="Invito in una lega">
        <div className="space-y-3">
          <Suggerimento>Entrando vedrai la lega e i suoi dati, con il ruolo che ti ha dato chi ti ha invitato.</Suggerimento>
          {errore && <Avviso tipo="errore">{errore}</Avviso>}
          <Bottone variante="primario" disabled={invio} onClick={() => void accetta()} className="w-full">
            {invio ? 'Entro…' : 'Accetta ed entra'}
          </Bottone>
        </div>
      </Card>
    </div>
  )
}
