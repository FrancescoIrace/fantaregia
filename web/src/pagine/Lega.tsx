import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Route, Routes, useParams } from 'react-router'
import { supabase } from '../lib/supabase.ts'
import { useLega } from '../data/useLega.ts'
import { creaMotore, ROLES, type Motore } from '../domain/motore.ts'
import { ingressoFinoA, miaSquadraDi, type RigheLega } from '../data/componi.ts'
import { salvaAllenatore } from '../data/lega.ts'
import { NOME_RUOLO, type RuoloMembro } from '../data/ruoli.ts'
import { Avviso, Bottone, Card, Ruolo, Suggerimento } from '../ui.tsx'
import CaricaDati from './CaricaDati.tsx'
import RoseUfficiali from './RoseUfficiali.tsx'
import Formazioni from './Formazioni.tsx'
import Scontri from './Scontri.tsx'
import Rendimento from './Rendimento.tsx'
import Titolari from './Titolari.tsx'
import Calendario from './Calendario.tsx'
import Infermeria from './Infermeria.tsx'
import Mercato from './Mercato.tsx'
import Listone from './Listone.tsx'
import Rose from './Rose.tsx'
import Asta from './Asta.tsx'
import { ORDINE, PRIME, modoAuto, modoSalvato, salvaModo, type Modo, type Scheda } from '../viste/modo.ts'
import { usaTinta } from '../viste/colore-squadra.ts'
import ColoreSquadra from './ColoreSquadra.tsx'

/* le schede, ognuna con la chiave che gli ordini di modo.ts usano per
   metterle in fila. La Panoramica sta fuori: è la casa della lega (la
   rotta index, e dentro ci sono carica dati e rose ufficiali), quindi
   resta prima e non va mai in secondo piano. */
const SCHEDE: Record<Scheda, { path: string; testo: string }> = {
  asta:       { path: 'asta',       testo: 'Asta live' },
  listone:    { path: 'listone',    testo: 'Listone' },
  rose:       { path: 'rose',       testo: 'Rose' },
  formazioni: { path: 'formazioni', testo: 'Formazioni' },
  scontri:    { path: 'scontri',    testo: 'Lega' },
  rendimento: { path: 'rendimento', testo: 'Rendimento' },
  titolari:   { path: 'titolari',   testo: 'Titolari' },
  calendario: { path: 'calendario', testo: 'Calendario' },
  infermeria: { path: 'infermeria', testo: 'Infermeria' },
  mercato:    { path: 'mercato',    testo: 'Mercato' },
}

interface Membro { utente_id: string; nome: string | null; ruolo: RuoloMembro }

/* La lega: intestazione, schede, e sotto la vista scelta. I dati si
   caricano una volta qui e le viste li ricevono già calcolati dal motore;
   il realtime li aggiorna per tutte insieme. */
export default function Lega({ utenteId }: { utenteId: string }) {
  const { id = '' } = useParams()
  const { righe, motore, errore, ricarica } = useLega(id, utenteId)
  const [membri, setMembri] = useState<Membro[]>([])
  // null: nessuna scelta su questo dispositivo, decide modoAuto() sui dati
  const [modoScelto, setModoScelto] = useState<Modo | null>(() => modoSalvato(id))

  useEffect(() => {
    supabase.from('membri').select('utente_id, nome, ruolo').eq('lega_id', id)
      .then(({ data }) => setMembri((data ?? []) as Membro[]))
  }, [id])

  /* Il marchio è il colore della propria squadra. Uscendo dalla lega torna
     quello predefinito: l'elenco delle leghe non è di nessuna squadra. */
  const miaSquadra = righe ? righe.squadre.find(s => s.id === miaSquadraDi(righe, utenteId)) ?? null : null
  const miaTinta = miaSquadra?.colore ?? null
  useEffect(() => {
    usaTinta(miaTinta)
    return () => { usaTinta(null) }
  }, [miaTinta])

  /* Il motore com'era prima di una giornata: gli stessi dati senza i voti da
     quella in poi, per chiedere al modello cosa avrebbe consigliato senza
     fargli vedere il risultato. Uno per giornata, ricordato finché i dati
     della lega non cambiano. */
  const motorePrima = useMemo(() => {
    if (!righe) return null
    const fatti = new Map<number, Motore>()
    return (g: number) => {
      if (!fatti.has(g)) fatti.set(g, creaMotore(ingressoFinoA(righe, g)))
      return fatti.get(g)!
    }
  }, [righe])

  if (errore) return <div className="space-y-3"><Avviso tipo="errore">{errore}</Avviso><Link to="/" className="text-accent">← Le tue leghe</Link></div>
  if (!righe || !motore) return <p className="text-muted">Carico la lega…</p>

  const io = membri.find(m => m.utente_id === utenteId)
  /* sec: la voce non appartiene alla modalità attiva, resta in secondo piano */
  const scheda = (sec: boolean) => ({ isActive }: { isActive: boolean }) =>
    `-mb-px shrink-0 border-b-2 px-3.5 py-2.5 text-sm font-semibold ${isActive ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-ink'}${sec && !isActive ? ' opacity-[.55] hover:opacity-90' : ''}`
  const modo: Modo = modoScelto ?? modoAuto(motore)
  const cambiaModo = (v: Modo) => { setModoScelto(v); salvaModo(id, v) }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline gap-3">
        <Link to="/" className="text-sm text-accent">← Le tue leghe</Link>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">{righe.lega.nome}</h1>
        <span className="font-mono text-[11px] text-muted">{righe.lega.stagione}</span>
        {io && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-muted">{NOME_RUOLO[io.ruolo]}</span>}
        {/* la propria squadra, con il gagliardetto se ha un colore: il marchio della pagina viene da lì */}
        {miaSquadra && (
          <span className="flex items-center gap-1.5 text-sm font-semibold">
            {miaSquadra.colore && <span className="gagliardetto" style={{ ['--tinta' as string]: miaSquadra.colore }} />}
            {miaSquadra.nome}
          </span>
        )}
        <button type="button" role="switch" aria-checked={modo === 'asta'}
          className={`modo${modo === 'asta' ? '' : ' off'}`}
          title="Riordina il menu: con l'asta accesa vengono prima le pagine che servono a comprare, spenta quelle che servono a giocare le giornate"
          onClick={() => cambiaModo(modo === 'asta' ? 'stagione' : 'asta')}>
          <span className="mlab">Modalità asta</span><span className="msw"><i /></span>
          <span className="mval">{modo === 'asta' ? 'ON' : 'OFF'}</span>
        </button>
      </div>
      {/* link assoluti: dentro una rotta con /* i relativi si risolvono in modo ambiguo */}
      <nav className="flex gap-1 overflow-x-auto border-b border-line">
        <NavLink to={`/lega/${id}`} end className={scheda(false)}>Panoramica</NavLink>
        {ORDINE[modo].map((k, i) => (
          <NavLink key={k} to={`/lega/${id}/${SCHEDE[k].path}`} className={scheda(i >= PRIME)}>{SCHEDE[k].testo}</NavLink>
        ))}
      </nav>
      <Routes>
        <Route index element={<Panoramica id={id} utenteId={utenteId} righe={righe} motore={motore} ricarica={ricarica} membri={membri} io={io} />} />
        <Route path="listone" element={<Listone legaId={id} utenteId={utenteId} righe={righe} motore={motore} ricarica={ricarica}
          puoScrivere={!!io && io.ruolo !== 'lettore'} />} />
        <Route path="asta" element={<Asta legaId={id} motore={motore} ricarica={ricarica}
          puoScrivere={!!io && io.ruolo !== 'lettore'} />} />
        <Route path="rose" element={<Rose legaId={id} motore={motore} ricarica={ricarica}
          puoScrivere={!!io && io.ruolo !== 'lettore'} />} />
        <Route path="formazioni" element={<Formazioni legaId={id} utenteId={utenteId} righe={righe} motore={motore} motorePrima={motorePrima ?? undefined} />} />
        <Route path="scontri" element={<Scontri legaId={id} utenteId={utenteId} motore={motore} ricarica={ricarica} motorePrima={motorePrima ?? undefined}
          puoScrivere={!!io && io.ruolo !== 'lettore'} />} />
        <Route path="rendimento" element={<Rendimento motore={motore} />} />
        <Route path="titolari" element={<Titolari motore={motore} />} />
        <Route path="calendario" element={<Calendario motore={motore} />} />
        <Route path="infermeria" element={<Infermeria legaId={id} motore={motore} ricarica={ricarica}
          puoScrivere={!!io && io.ruolo !== 'lettore'} />} />
        <Route path="mercato" element={<Mercato legaId={id} motore={motore} ricarica={ricarica}
          puoScrivere={!!io && io.ruolo !== 'lettore'} />} />
      </Routes>
    </div>
  )
}

/* Il tabellone delle squadre calcolato dal motore sui dati veri, la
   squadra di chi guarda, i file della lega, chi c'è. */
function Panoramica({ id, utenteId, righe, motore, ricarica, membri, io }: {
  id: string; utenteId: string; righe: RigheLega; motore: Motore; ricarica: () => void; membri: Membro[]; io: Membro | undefined
}) {
  const mia = miaSquadraDi(righe, utenteId)
  const scegliSquadra = async (sq: string) => {
    await supabase.from('preferenze').upsert({ lega_id: id, utente_id: utenteId, mia_squadra: sq ? Number(sq) : null }, { onConflict: 'lega_id,utente_id' })
    ricarica()
  }
  const giornate = motore.giornateGiocate()
  const colore = (tid: number) => righe.squadre.find(s => s.id === tid)?.colore ?? null

  /* «La mia squadra» qui sopra è una preferenza privata: serve a chi tiene la
     lega da solo e guarda le altre squadre. L'allenatore invece è pubblico —
     con due fantallenatori la lega deve sapere chi è chi. */
  const [erroreAll, setErroreAll] = useState<string | null>(null)
  const allenatore = (tid: number) => righe.squadre.find(s => s.id === tid)?.allenatore ?? null
  const nomeMembro = (uid: string) => membri.find(m => m.utente_id === uid)?.nome ?? 'un altro membro'
  const squadraDi = (uid: string) => righe.squadre.find(s => s.allenatore === uid) ?? null
  const puoAssegnare = !!io && io.ruolo !== 'lettore'
  const cambiaAllenatore = async (tid: number, uid: string | null) => {
    setErroreAll(null)
    try { await salvaAllenatore(id, tid, uid); ricarica() } catch (e) { setErroreAll((e as Error).message) }
  }

  return (
    <div className="space-y-6">
      {/* «sola lettura» diceva il falso: un lettore è un fantallenatore a tutti
          gli effetti — la sua squadra, il suo colore, i suoi obiettivi e le sue
          formazioni sono suoi (le preferenze hanno una policy per utente). */}
      {io?.ruolo === 'lettore' && (
        <Avviso>La tua squadra la gestisci tu: colore, obiettivi e formazioni sono tuoi e restano privati.
          L'asta, i file della lega e i dati condivisi li tiene chi ha i permessi di scrittura.</Avviso>
      )}
      {righe.allenatoreMancante && (
        <Avviso>Chi gioca quale squadra non è ancora nel database: manca la migrazione «allenatore».
          Fino ad allora ognuno vede solo la sua scelta privata qui sotto.</Avviso>
      )}
      {erroreAll && <Avviso tipo="errore">{erroreAll}</Avviso>}

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
                <th className="px-2 py-1.5 font-semibold">Allenatore</th>
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
                    <td className="py-1.5 pr-3 font-semibold">
                      {colore(t.id) && <span className="gagliardetto mr-2" style={{ ['--tinta' as string]: colore(t.id)! }} />}
                      {t.name}{t.id === mia && <span className="ml-2 text-[11px] text-accent">io</span>}
                    </td>
                    <td className="px-2 py-1.5 text-[12.5px]">
                      {righe.allenatoreMancante ? <span className="text-muted">—</span>
                        : puoAssegnare ? (
                          <select value={allenatore(t.id) ?? ''} onChange={e => void cambiaAllenatore(t.id, e.target.value || null)}
                            className="rounded-[7px] border border-line-strong bg-surface px-1.5 py-0.5 text-[12.5px]">
                            <option value="">libera</option>
                            {membri.map(m => <option key={m.utente_id} value={m.utente_id}>{m.nome ?? 'utente'}</option>)}
                          </select>
                        ) : allenatore(t.id) ? (
                          <span className={allenatore(t.id) === utenteId ? 'font-semibold' : 'text-muted'}>
                            {allenatore(t.id) === utenteId ? 'tu' : nomeMembro(allenatore(t.id)!)}
                          </span>
                        ) : <Bottone piccolo onClick={() => void cambiaAllenatore(t.id, utenteId)}>Prendila</Bottone>}
                    </td>
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
        <div className="mt-4 border-t border-line pt-3"><ColoreSquadra legaId={id} squadre={righe.squadre} mia={mia} mancante={righe.coloreMancante} admin={io?.ruolo === 'admin'} puoScrivere={!!io && io.ruolo !== 'lettore'} /></div>
      </Card>

      {io && io.ruolo !== 'lettore' && <CaricaDati legaId={id} righe={righe} motore={motore} />}
      {io && io.ruolo !== 'lettore' && <RoseUfficiali legaId={id} motore={motore} ricarica={ricarica} />}

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
                {squadraDi(m.utente_id) && <span className="text-[11px] text-muted">· {squadraDi(m.utente_id)!.nome}</span>}
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
        {/* «lettore» nel database è il fantallenatore: gestisce la sua squadra
            e legge il resto. Il bottone lo chiama col suo nome, invece di
            «sola lettura», che faceva sembrare l'invito una visita guidata. */}
        <Bottone piccolo onClick={() => void crea('lettore')}>Invita un allenatore</Bottone>
        <Bottone piccolo onClick={() => void crea('banditore')}>Invita un banditore</Bottone>
      </div>
      {errore && <Avviso tipo="errore">{errore}</Avviso>}
      {link && (
        <div className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2">
          <code className="min-w-0 flex-1 truncate font-mono text-[12px]">{link.url}</code>
          <Bottone piccolo onClick={() => void navigator.clipboard.writeText(link.url).then(() => setCopiato(true))}>{copiato ? 'Copiato' : 'Copia'}</Bottone>
        </div>
      )}
      <Suggerimento>Il link vale 14 giorni e fino a 20 persone. Allenatore: si prende la sua squadra e la gestisce — colore, obiettivi, formazioni, che restano privati — e vede tutto il resto aggiornarsi. Banditore: in più scrive asta, voti e impostazioni della lega.</Suggerimento>
    </div>
  )
}
