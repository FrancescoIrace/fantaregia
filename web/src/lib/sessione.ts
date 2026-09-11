import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase.ts'

/** la sessione di Supabase Auth, e se si sa già se c'è o no */
export function useSessione() {
  const [sessione, setSessione] = useState<Session | null>(null)
  const [pronto, setPronto] = useState(false)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSessione(data.session); setPronto(true) })
    const { data } = supabase.auth.onAuthStateChange((_evento, s) => setSessione(s))
    return () => data.subscription.unsubscribe()
  }, [])
  return { sessione, pronto }
}

/* gli errori di Supabase Auth arrivano in inglese: quelli che capitano davvero, in italiano */
export function erroreAuth(msg: string) {
  const m = msg.toLowerCase()
  if (m.includes('invalid login credentials')) return 'Email o password sbagliate.'
  if (m.includes('email not confirmed')) return 'Prima devi confermare l\'email: cerca il messaggio di Supabase nella posta.'
  if (m.includes('already registered')) return 'Esiste già un account con questa email: entra invece di registrarti.'
  if (m.includes('password should be at least')) return 'La password è troppo corta: almeno 6 caratteri.'
  if (m.includes('rate limit')) return 'Troppe email in poco tempo: riprova fra qualche minuto.'
  if (m.includes('unable to validate email')) return 'L\'indirizzo email non sembra valido.'
  return msg
}
