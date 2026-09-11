import { Route, Routes } from 'react-router'
import { supabaseConfigurato } from './lib/supabase.ts'

export default function App() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[1280px] items-center gap-3 px-5 py-3">
          <h1 className="font-display text-xl font-extrabold tracking-tight">Fantaregia</h1>
          <span className="font-mono text-[11px] tracking-wider text-muted">asta e stagione · online</span>
        </div>
      </header>
      <main className="mx-auto max-w-[1280px] px-5 py-6">
        <Routes>
          <Route path="*" element={<Cantiere />} />
        </Routes>
      </main>
    </div>
  )
}

function Cantiere() {
  return (
    <section className="rounded-card border border-line bg-surface p-5 shadow-card">
      <h2 className="font-display text-base font-semibold">Versione online in costruzione</h2>
      <p className="mt-2 text-sm text-muted">
        Il motore degli indici è già portato in <code className="font-mono">src/domain</code> e
        verificato contro l'app a file singolo. Le viste arrivano una alla volta.
      </p>
      {!supabaseConfigurato && (
        <p className="mt-3 rounded-lg border border-warn bg-warn-soft px-3 py-2 text-sm text-warn">
          Supabase non è configurato: copia <code className="font-mono">.env.example</code> in{' '}
          <code className="font-mono">.env.local</code> e compila URL e chiave anon.
        </p>
      )}
    </section>
  )
}
