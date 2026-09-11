/* I mattoni grafici, con le classi dell'app a file singolo tradotte in
   Tailwind: card, pulsanti, campi, avvisi, etichette di ruolo. */
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'

export function Card({ titolo, azioni, children, denso }: { titolo?: ReactNode; azioni?: ReactNode; children: ReactNode; denso?: boolean }) {
  return (
    <section className="rounded-card border border-line bg-surface shadow-card">
      {(titolo || azioni) && (
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
          {titolo && <h2 className="font-display text-[15px] font-semibold tracking-tight">{titolo}</h2>}
          {azioni && <div className="ml-auto flex items-center gap-2">{azioni}</div>}
        </div>
      )}
      <div className={denso ? '' : 'p-4'}>{children}</div>
    </section>
  )
}

type Variante = 'normale' | 'primario' | 'pericolo'
export function Bottone({ variante = 'normale', piccolo, className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; piccolo?: boolean }) {
  const stile = {
    normale: 'border-line-strong bg-surface hover:border-accent hover:text-accent',
    primario: 'border-accent bg-accent text-accent-ink hover:brightness-110',
    pericolo: 'border-line-strong bg-surface hover:border-crit hover:text-crit',
  }[variante]
  return (
    <button
      {...p}
      className={`rounded-[7px] border font-medium disabled:cursor-not-allowed disabled:opacity-50 ${piccolo ? 'px-2.5 py-1 text-[12.5px]' : 'px-3.5 py-1.5 text-[13.5px]'} ${stile} ${className}`}
    />
  )
}

export function Campo({ etichetta, ...p }: InputHTMLAttributes<HTMLInputElement> & { etichetta: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold tracking-wider text-muted uppercase">{etichetta}</span>
      <input
        {...p}
        className="w-full rounded-[7px] border border-line-strong bg-surface px-2.5 py-1.5 text-sm focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)] focus:outline-none"
      />
    </label>
  )
}

export function Avviso({ tipo = 'info', children }: { tipo?: 'info' | 'ok' | 'errore' | 'attenzione'; children: ReactNode }) {
  const stile = {
    info: 'border-accent-line bg-accent-soft text-accent',
    ok: 'border-ok bg-ok-soft text-ok',
    errore: 'border-crit bg-crit-soft text-crit',
    attenzione: 'border-warn bg-warn-soft text-warn',
  }[tipo]
  return <div className={`rounded-lg border px-3 py-2 text-sm ${stile}`}>{children}</div>
}

export function Suggerimento({ children }: { children: ReactNode }) {
  return <p className="text-[12.5px] text-muted">{children}</p>
}

const COLORE_RUOLO = { P: 'bg-r-p-soft text-r-p', D: 'bg-r-d-soft text-r-d', C: 'bg-r-c-soft text-r-c', A: 'bg-r-a-soft text-r-a' }
export function Ruolo({ r }: { r: 'P' | 'D' | 'C' | 'A' }) {
  return <span className={`inline-flex h-[21px] w-[21px] flex-none items-center justify-center rounded-[5px] font-mono text-[11.5px] font-semibold ${COLORE_RUOLO[r]}`}>{r}</span>
}
