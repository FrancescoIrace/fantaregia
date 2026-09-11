import { useEffect, useState } from 'react'
import { Link, NavLink, Route, Routes, useParams } from 'react-router'
import { supabase } from '../lib/supabase.ts'
import { useLega } from '../data/useLega.ts'
import { ROLES, type Motore } from '../domain/motore.ts'
import type { RigheLega } from '../data/componi.ts'
import { NOME_RUOLO, type RuoloMembro } from '../data/ruoli.ts'
import { Avviso, Bottone, Card, Ruolo, Suggerimento } from '../ui.tsx'
import CaricaDati from './CaricaDati.tsx'
import Formazioni from './Formazioni.tsx'

interface Membro { utente_id: string; nome: string | null; ruolo: RuoloMembro }

/* La lega: intestazione, schede, e sotto la vista scelta. I dati si
   caricano una volta qui e le viste li ricevono già calcolati dal motore;
   il realtime li aggiorna per tutte insieme. */
export default function Lega({ utenteId }: { utenteId: string }) {
  const { id = '' } = useParams()
  const { righe, motore, errore, ricarica } = useLega(id, utenteId)
  const [membri, setMembri] = useState<Membro[]>([])

  useEffect(() => {
    supabase.from('membri').select('utente_id, nome, ruolo').eq('lega_id', id)
      .then(({ data }) => setMembri((data ?? []) as Membro[]))
  }, [id])

  if (errore) return <div className="space-y-3"><Avviso tipo="errore">{errore}</Avviso><Link to="/" className="text-accent">← Le tue leghe</Link></div>
  if (!righe || !motore) return <p className="text-muted">Carico la lega…</p>

  const io = membri.find(m => m.utente_id === utenteId)
  const scheda = ({ isActive }: { isActive: boolean }) =>
    `-mb-px border-b-2 px-3.5 py-2.5 text-sm font-semibold ${isActive ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-ink'}`

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline gap-3">
        <Link to="/" className="text-sm text-accent">← Le tue leghe</Link>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">{righe.lega.nome}</h1>
        <span className="font-mono text-[11px] text-muted">{righe.lega.stagione}</span>
        {io && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-muted">{NOME_RUOLO[io.ruolo]}</span>}
      </div>
      {/* link assoluti: dentro una rotta con /* i relativi si risolvono in modo ambiguo */}
      <nav className="flex gap-1 overflow-x-auto border-b border-line">
        <NavLink to={`/lega/${id}`} end className={scheda}>Panoramica</NavLink>
        <NavLink to={`/lega/${id}/formazioni`} className={scheda}>Formazioni</NavLink>
      </nav>
      <Routes>
        <Route index element={<Panoramica id={id} utenteId={utenteId} righe={righe} motore={motore} ricarica={ricarica} membri={membri} io={io} />} />
        <Route path="formazioni" element={<Formazioni legaId={id} utenteId={utenteId} righe={righe} motore={motore} />} />
      </Routes>
    </div>
  )
}

/* Il tabellone delle squadre calcolato dal motore sui dati veri, la
   squadra di chi guarda, i file della lega, chi c'è. */
function Panoramica({ id, utenteId, righe, motore, ricarica, membri, io }: {
  id: string; utenteId: string; righe: RigheLega; motore: Motore; ricarica: () => void; membri: Membro[]; io: Membro | undefined
}) {
  const mia = righe.preferenze?.mia_squadra ?? null
  const scegliSquadra = async (sq: string) => {
    await supabase.from('preferenze').upsert({ lega_id: id, utente_id: utenteId, mia_squadra: sq ? Number(sq) : null }, { onConflict: 'lega_id,utente_id' })
    ricarica()
  }
  const giornate = motore.giornateGiocate()

  return (
    <div className="space-y-6">
      {io?.ruolo === 'lettore' && <Avviso>Sei in sola lettura: vedi tutto aggiornarsi in tempo reale, ma non puoi scrivere.</Avviso>}

      <Card titolo="Squadre" azioni={
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted">La mia squadra</span>
          <select value={mia ?? ''} onChange={e => void scegliSquadra(e.target.value)}
            className="rounded-[7px] border border-line-strong bg-surface px-2 py-1 text-sm">
            <option value="">—</option>
            {motore.S.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
      }>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-[11px] tracking-wider text-muted uppercase">
                <th className="py-1.5 pr-3 font-semibold">Squadra</th>
                {ROLES.map(r => <th key={r} className="px-1.5 py-1.5 text-center"><Ruolo r={r} /></th>)}
                <th className="px-2 py-1.5 text-right font-semibold">Spesi</th>
                <th className="px-2 py-1.5 text-right font-semibold">Residuo</th>
                <th className="px-2 py-1.5 text-right font-semibold">Tetto</th>
                <th className="py-1.5 pl-2 text-right font-semibold">Giudizio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {motore.S.teams.map(t => {
                const st = motore.stats(t.id), g = motore.giudizio(t.id)
                return (
                  <tr key={t.id} className={t.id === mia ? 'bg-accent-soft' : ''}>
                    <td className="py-1.5 pr-3 font-semibold">{t.name}{t.id === mia && <span className="ml-2 text-[11px] text-accent">io</span>}</td>
                    {ROLES.map(r => (
                      <td key={r} className={`px-1.5 py-1.5 text-center font-mono text-[12.5px] ${st.perRole[r].count >= motore.S.slots[r] ? 'text-muted' : ''}`}>
                        {st.perRole[r].count}/{motore.S.slots[r]}
                      </td>
                    ))}
                    <td className="px-2 py-1.5 text-right font-mono">{st.spent}</td>
                    <td className="px-2 py-1.5 text-right font-mono font-semibold">{st.left}</td>
                    <td className={`px-2 py-1.5 text-right font-mono ${st.slotsLeft > 0 && st.max <= 2 ? 'text-crit' : ''}`}>{st.slotsLeft > 0 ? st.max : '—'}</td>
                    <td className={`py-1.5 pl-2 text-right font-mono font-semibold ${!g ? 'text-muted' : g.voto >= 70 ? 'text-ok' : g.voto >= 55 ? 'text-warn' : 'text-crit'}`}>{g ? g.voto : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3"><Suggerimento>Crediti, tetto e giudizio vengono dal motore dell'app a file singolo, sui dati di questa lega.</Suggerimento></div>
      </Card>

      {io && io.ruolo !== 'lettore' && <CaricaDati legaId={id} righe={righe} motore={motore} />}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card titolo="Cosa c'è">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-muted">Listone</dt><dd>{motore.PL.length ? `${motore.PL.length} giocatori` : 'non caricato'}</dd>
            <dt className="text-muted">Calendario di serie A</dt><dd>{motore.CAL.teams.length ? `${motore.CAL.teams.length} squadre` : 'non caricato'}</dd>
            <dt className="text-muted">Voti di giornata</dt><dd>{giornate.length ? `fino alla ${Math.max(...giornate)}ª (${giornate.length} giornate)` : 'nessuna'}</dd>
            <dt className="text-muted">Calendario di lega</dt><dd>{motore.legaOn() ? `${motore.legaGiornate()} giornate` : 'non caricato'}</dd>
            <dt className="text-muted">Mercato</dt><dd>{motore.moves().length} movimenti</dd>
            <dt className="text-muted">Infermeria</dt><dd>{Object.keys(motore.S.out).length} segnati, {motore.squalifiche().length} squalificati</dd>
            <dt className="text-muted">Oggi</dt><dd>{motore.giornataOggi()}ª giornata di serie A</dd>
          </dl>
        </Card>
        <Card titolo="Chi c'è">
          <ul className="space-y-1 text-sm">
            {membri.map(m => (
              <li key={m.utente_id} className="flex items-center gap-2">
                <span className="font-medium">{m.nome ?? 'utente'}</span>
                {m.utente_id === utenteId && <span className="text-[11px] text-muted">(tu)</span>}
                <span className="ml-auto text-[11px] font-semibold text-muted">{NOME_RUOLO[m.ruolo]}</span>
              </li>
            ))}
          </ul>
          {io?.ruolo === 'admin' && <div className="mt-4 border-t border-line pt-3"><Inviti legaId={id} /></div>}
        </Card>
      </div>
    </div>
  )
}

function Inviti({ legaId }: { legaId: string }) {
  const [link, setLink] = useState<{ ruolo: string; url: string } | null>(null)
  const [errore, setErrore] = useState<string | null>(null)
  const [copiato, setCopiato] = useState(false)

  async function crea(ruolo: 'banditore' | 'lettore') {
    setErrore(null); setCopiato(false)
    const { data, error } = await supabase.from('inviti').insert({ lega_id: legaId, ruolo }).select('codice').single()
    if (error) return setErrore(error.message)
    setLink({ ruolo, url: `${window.location.origin}/invito/${(data as { codice: string }).codice}` })
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Bottone piccolo onClick={() => void crea('banditore')}>Invita un banditore</Bottone>
        <Bottone piccolo onClick={() => void crea('lettore')}>Invita in sola lettura</Bottone>
      </div>
      {errore && <Avviso tipo="errore">{errore}</Avviso>}
      {link && (
        <div className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2">
          <code className="min-w-0 flex-1 truncate font-mono text-[12px]">{link.url}</code>
          <Bottone piccolo onClick={() => void navigator.clipboard.writeText(link.url).then(() => setCopiato(true))}>{copiato ? 'Copiato' : 'Copia'}</Bottone>
        </div>
      )}
      <Suggerimento>Il link vale 14 giorni e fino a 20 persone. Banditore: scrive asta, voti e impostazioni. Sola lettura: vede tutto e basta.</Suggerimento>
    </div>
  )
}
