import { lazy, Suspense } from 'react'
import { Link, Route, Routes } from 'react-router'
import { supabase, supabaseConfigurato } from './lib/supabase.ts'
import { useSessione } from './lib/sessione.ts'
import Accesso from './pagine/Accesso.tsx'
import Invito from './pagine/Invito.tsx'
import Leghe from './pagine/Leghe.tsx'
import { Avviso } from './ui.tsx'

// la pagina della lega porta con sé motore e caricamenti: si scarica quando serve
const Lega = lazy(() => import('./pagine/Lega.tsx'))

export default function App() {
  const { sessione, pronto } = useSessione()
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-3 px-5 py-3">
          <Link to="/" className="font-display text-xl font-extrabold tracking-tight">Fantaregia</Link>
          <span className="font-mono text-[11px] tracking-wider text-muted">asta e stagione</span>
          {sessione && (
            <div className="ml-auto flex items-center gap-3 text-sm">
              <span className="text-muted">{sessione.user.email}</span>
              <button type="button" className="font-semibold text-accent hover:underline" onClick={() => void supabase.auth.signOut()}>Esci</button>
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-[1280px] px-5 py-6">
        {!supabaseConfigurato ? (
          <Avviso tipo="attenzione">
            Supabase non è configurato: in <code className="font-mono">web/.env.local</code> servono l'URL del progetto e la chiave pubblica.
          </Avviso>
        ) : !pronto ? (
          <p className="text-muted">Un attimo…</p>
        ) : (
          <Suspense fallback={<p className="text-muted">Un attimo…</p>}>
            <Routes>
              <Route path="/invito/:codice" element={<Invito haSessione={!!sessione} />} />
              <Route path="/lega/:id" element={sessione ? <Lega utenteId={sessione.user.id} /> : <Accesso />} />
              <Route path="*" element={sessione ? <Leghe utenteId={sessione.user.id} /> : <Accesso />} />
            </Routes>
          </Suspense>
        )}
      </main>
    </div>
  )
}
