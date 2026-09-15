/* Il tema vale per tutta l'app, su questo dispositivo. «Come il sistema»
   è la scelta di partenza e resta sempre disponibile. */
import { useState } from 'react'
import { scegliTema, temaSalvato, type Tema } from './tema.ts'

export default function SceltaTema() {
  const [tema, setTema] = useState<Tema | null>(temaSalvato)
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted">Tema</span>
      <select value={tema ?? ''} className="rounded-[7px] border border-line-strong bg-surface px-2 py-1 text-sm"
        onChange={e => {
          const t = (e.target.value || null) as Tema | null
          setTema(t)
          scegliTema(t)
        }}>
        <option value="">come il sistema</option>
        <option value="notte">notte</option>
        <option value="giorno">giorno</option>
      </select>
    </label>
  )
}
