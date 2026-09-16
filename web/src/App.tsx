import { lazy, Suspense } from 'react'
import { Link, Route, Routes, useLocation } from 'react-router'
import { supabase, supabaseConfigurato } from './lib/supabase.ts'
import { useSessione } from './lib/sessione.ts'
import Accesso from './pagine/Accesso.tsx'
import Invito from './pagine/Invito.tsx'
import Leghe from './pagine/Leghe.tsx'
import { Avviso } from './ui.tsx'
import SceltaTema from './viste/SceltaTema.tsx'
import { useTelefono } from './viste/telefono.ts'
import InCima from './viste/InCima.tsx'

// la pagina della lega porta con sé motore e caricamenti: si scarica quando serve
const Lega = lazy(() => import('./pagine/Lega.tsx'))

export default function App() {
  const { sessione, pronto } = useSessione()
  const { pathname } = useLocation()
  const telefono = useTelefono()
  /* Dentro una lega, sul telefono, la testata la fa il guscio: una riga
     sola invece di tre. Email, tema ed Esci non spariscono — stanno nel
     suo cassetto. Fuori dalla lega (le tue leghe, accesso, invito) e da
     scrivania questa resta la testata dell'app. */
  const nelGuscio = telefono && !!sessione && pathname.startsWith('/lega/')
  return (
    <div className="min-h-screen">
      <InCima />
      {/* il filo in cima è il marchio: dentro una lega il colore della propria squadra, fuori l'ambra */}
      {!nelGuscio && <header className="sticky top-0 z-40 border-t-[3px] border-b border-t-accent border-b-line bg-surface">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-3 px-5 py-3">
          <Link to="/" className="font-display text-xl font-extrabold tracking-tight">Fantaregia</Link>
          <span className="font-mono text-[11px] tracking-wider text-muted">asta e stagione</span>
          <div className="ml-auto flex flex-wrap items-center gap-3 text-sm">
            <SceltaTema />
            {sessione && (
              <>
                <span className="text-muted">{sessione.user.email}</span>
                <button type="button" className="font-semibold text-accent hover:underline" onClick={() => void supabase.auth.signOut()}>Esci</button>
              </>
            )}
          </div>
        </div>
      </header>}
      {/* nel guscio il contenuto arriva ai bordi: le righe di una lista
          toccate col pollice non hanno un margine che le stacca dal vetro,
          e la spaziatura la mette il guscio (.g-corpo). */}
      <main className={nelGuscio ? '' : 'mx-auto max-w-[1280px] px-5 py-6'}>
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
              <Route path="/lega/:id/*" element={sessione ? <Lega utenteId={sessione.user.id} email={sessione.user.email} /> : <Accesso />} />
              <Route path="*" element={sessione ? <Leghe utenteId={sessione.user.id} /> : <Accesso />} />
            </Routes>
          </Suspense>
        )}
      </main>
    </div>
  )
}
