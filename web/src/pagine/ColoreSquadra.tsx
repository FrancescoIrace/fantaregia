/* Il colore della propria squadra: dieci tinte pronte e una libera. Si
   salva subito, come «La mia squadra»; gli avvisi arrivano dopo e non
   bloccano niente — la tinta resta di chi l'ha scelta. */
import { useState } from 'react'
import type { RigaSquadra } from '../data/componi.ts'
import { salvaColoreSquadra } from '../data/lega.ts'
import { TINTA_PREDEFINITA, TINTE_PRONTE, statoScelta } from '../viste/colore-squadra.ts'
import { Avviso, Bottone } from '../ui.tsx'

const uguale = (a?: string | null, b?: string | null) => !!a && !!b && a.toUpperCase() === b.toUpperCase()
const nomeDi = (hex: string) => TINTE_PRONTE.find(([h]) => uguale(h, hex))?.[1] ?? hex.toUpperCase()

export default function ColoreSquadra({ legaId, squadre, mia, mancante, admin }: {
  legaId: string; squadre: RigaSquadra[]; mia: number | null; mancante?: boolean; admin?: boolean
}) {
  const [errore, setErrore] = useState<string | null>(null)
  const [invio, setInvio] = useState(false)
  /* database senza la colonna del colore: si dice cosa manca, e a chi può
     rimediare anche come. Intanto per tutti vale l'ambra predefinita. */
  if (mancante) return (
    <p className="hint">
      Il colore delle squadre non è ancora attivo in questa lega: per ora vale l'ambra per tutti.
      {admin && <> Manca la migrazione <code className="font-mono">colore_squadra</code> sul database: dalla cartella <code className="font-mono">web</code> lancia <code className="font-mono">npx supabase db push</code>.</>}
    </p>
  )
  if (mia === null) return <p className="hint">Scegli la tua squadra qui sopra, e potrai darle un colore.</p>

  const tid = mia
  const propria = squadre.find(s => s.id === tid)
  const { avvisi, proposta, prese } = statoScelta(squadre, tid)
  const scegli = async (hex: string) => {
    setInvio(true); setErrore(null)
    try { await salvaColoreSquadra(legaId, tid, hex) } catch (e) { setErrore((e as Error).message) }
    setInvio(false)
  }
  /* il selettore libero salva quando la scelta è fatta (evento change),
     non a ogni passo del trascinamento (evento input, che è l'onChange di React) */
  const agganciaLibera = (el: HTMLInputElement | null) => {
    if (!el) return
    const fatto = () => void scegli(el.value)
    el.addEventListener('change', fatto)
    return () => el.removeEventListener('change', fatto)
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm text-muted">Il colore di {propria?.nome}</span>
        {TINTE_PRONTE.map(([hex, nome]) => {
          const di = prese.get(hex), scelta = uguale(propria?.colore, hex)
          return (
            <button key={hex} type="button" disabled={invio} onClick={() => void scegli(hex)}
              title={di ? `${nome} · già di ${di}` : nome} aria-label={di ? `${nome}, già di ${di}` : nome} aria-pressed={scelta}
              className={`tinta${scelta ? ' scelta' : ''}${di ? ' presa' : ''}`}
              style={{ ['--tinta' as string]: hex }} />
          )
        })}
        <label className={`tinta libera${propria?.colore && !TINTE_PRONTE.some(([h]) => uguale(h, propria.colore)) ? ' scelta' : ''}`} title="Un altro colore">
          <input type="color" ref={agganciaLibera} disabled={invio} aria-label="Un altro colore"
            defaultValue={(propria?.colore ?? TINTA_PREDEFINITA).toLowerCase()} />
        </label>
      </div>
      {avvisi.length > 0 && (
        <Avviso tipo="attenzione">
          {avvisi.map(a => <div key={a.cosa}><b>{a.titolo}.</b> {a.dettaglio}</div>)}
          {proposta && !uguale(proposta, propria?.colore) && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span>La scelta resta tua. Se vuoi un'alternativa:</span>
              <Bottone piccolo disabled={invio} onClick={() => void scegli(proposta)}>
                <span className="gagliardetto mr-1.5" style={{ ['--tinta' as string]: proposta }} />prova {nomeDi(proposta)}
              </Bottone>
            </div>
          )}
        </Avviso>
      )}
      {errore && <Avviso tipo="errore">{errore}</Avviso>}
    </div>
  )
}
