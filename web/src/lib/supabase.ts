import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** false finché .env.local non è compilato: l'app lo dice invece di rompersi */
export const supabaseConfigurato = Boolean(supabaseUrl && supabaseKey)

export const supabase = createClient(
  supabaseUrl ?? 'http://127.0.0.1:54321',
  supabaseKey ?? 'chiave-mancante',
)
