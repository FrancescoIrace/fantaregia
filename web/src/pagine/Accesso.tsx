import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase.ts'
import { erroreAuth } from '../lib/sessione.ts'
import { Avviso, Bottone, Campo, Card, Suggerimento } from '../ui.tsx'

/* Email e password: niente link magici da configurare, e la conferma
   dell'indirizzo funziona anche prima di aver messo online l'app. */
export default function Accesso({ motivo }: { motivo?: string }) {
  const [modo, setModo] = useState<'entra' | 'registrati'>('entra')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [invio, setInvio] = useState(false)
  const [esito, setEsito] = useState<{ tipo: 'ok' | 'errore'; testo: string } | null>(null)

  async function invia(e: FormEvent) {
    e.preventDefault()
    setInvio(true); setEsito(null)
    const r = modo === 'entra'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.href } })
    setInvio(false)
    if (r.error) return setEsito({ tipo: 'errore', testo: erroreAuth(r.error.message) })
    if (modo === 'registrati' && !r.data.session)
      setEsito({ tipo: 'ok', testo: 'Account creato. Ti è arrivata una mail di conferma: aprila, poi torna qui ed entra.' })
  }

  return (
    <div className="mx-auto max-w-sm">
      <Card titolo={modo === 'entra' ? 'Entra' : 'Crea un account'}>
        {motivo && <div className="mb-3"><Avviso>{motivo}</Avviso></div>}
        <form onSubmit={invia} className="space-y-3">
          <Campo etichetta="Email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
          <Campo etichetta="Password" type="password" autoComplete={modo === 'entra' ? 'current-password' : 'new-password'}
            required minLength={6} value={password} onChange={e => setPassword(e.target.value)} />
          {esito && <Avviso tipo={esito.tipo}>{esito.testo}</Avviso>}
          <Bottone variante="primario" type="submit" disabled={invio} className="w-full">
            {invio ? 'Un attimo…' : modo === 'entra' ? 'Entra' : 'Registrati'}
          </Bottone>
        </form>
        <div className="mt-4 border-t border-line pt-3">
          <Suggerimento>
            {modo === 'entra' ? 'Prima volta qui? ' : 'Hai già un account? '}
            <button type="button" className="font-semibold text-accent hover:underline"
              onClick={() => { setModo(modo === 'entra' ? 'registrati' : 'entra'); setEsito(null) }}>
              {modo === 'entra' ? 'Crea un account' : 'Entra'}
            </button>
          </Suggerimento>
        </div>
      </Card>
    </div>
  )
}
