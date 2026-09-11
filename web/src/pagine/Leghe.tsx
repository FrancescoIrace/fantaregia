import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { supabase } from '../lib/supabase.ts'
import { leggiFileApp, preparaImport, type PacchettoImport, type Riepilogo } from '../data/importa-app.ts'
import { NOME_RUOLO, type RuoloMembro } from '../data/ruoli.ts'
import { Avviso, Bottone, Campo, Card, Suggerimento } from '../ui.tsx'

interface MiaLega { ruolo: RuoloMembro; lega: { id: string; nome: string; stagione: string } | null }

export default function Leghe({ utenteId }: { utenteId: string }) {
  const [leghe, setLeghe] = useState<MiaLega[] | null>(null)
  const [errore, setErrore] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('membri').select('ruolo, lega:leghe(id, nome, stagione)').eq('utente_id', utenteId)
      .then(({ data, error }) => {
        if (error) setErrore(error.message)
        else setLeghe(((data ?? []) as unknown as MiaLega[]).filter(x => x.lega))
      })
  }, [utenteId])

  return (
    <div className="space-y-6">
      <Card titolo="Le tue leghe">
        {errore && <Avviso tipo="errore">{errore}</Avviso>}
        {!leghe && !errore && <Suggerimento>Carico…</Suggerimento>}
        {leghe && !leghe.length && (
          <Suggerimento>Non sei ancora in nessuna lega. Creane una, importa quella che tenevi nell'app a file singolo, o entra con il codice che ti hanno mandato.</Suggerimento>
        )}
        {leghe && leghe.length > 0 && (
          <ul className="divide-y divide-line">
            {leghe.map(x => (
              <li key={x.lega!.id} className="flex items-center gap-3 py-2">
                <Link to={`/lega/${x.lega!.id}`} className="font-semibold hover:text-accent">{x.lega!.nome}</Link>
                <span className="font-mono text-[11px] text-muted">{x.lega!.stagione}</span>
                <span className="ml-auto rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-muted">{NOME_RUOLO[x.ruolo]}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <div className="grid gap-6 lg:grid-cols-3">
        <ImportaLega />
        <CreaLega />
        <EntraConCodice />
      </div>
    </div>
  )
}

function ImportaLega() {
  const vai = useNavigate()
  const [pronto, setPronto] = useState<{ nomeFile: string; origine: 'pagina' | 'backup'; pacchetto: PacchettoImport; riepilogo: Riepilogo } | null>(null)
  const [nome, setNome] = useState('')
  const [errore, setErrore] = useState<string | null>(null)
  const [invio, setInvio] = useState(false)

  async function scegli(f: File | undefined) {
    setErrore(null); setPronto(null)
    if (!f) return
    try {
      const file = leggiFileApp(await f.text())
      const { pacchetto, riepilogo } = preparaImport(file)
      setPronto({ nomeFile: f.name, origine: file.origine, pacchetto, riepilogo })
      setNome(file.shared.lega?.nome || 'La mia lega')
    } catch (e) { setErrore((e as Error).message) }
  }

  async function importa() {
    if (!pronto) return
    setInvio(true); setErrore(null)
    const { data, error } = await supabase.rpc('importa_lega', { p_nome: nome.trim(), p_dati: pronto.pacchetto })
    setInvio(false)
    if (error) return setErrore(error.message)
    vai(`/lega/${data as string}`)
  }

  const r = pronto?.riepilogo
  return (
    <Card titolo="Importa dall'app a file singolo">
      <div className="space-y-3">
        <Suggerimento>
          Scegli la pagina <b>Fantaregia.html</b> scaricata dall'app in uso (porta con sé listone, calendario, rigoristi e
          statistiche) oppure il <b>backup .json</b> di «Lega e dati» (solo la lega). Il file si legge qui nel browser e finisce
          solo nella tua lega, che vedono soltanto i suoi membri.
        </Suggerimento>
        <input type="file" accept=".html,.htm,.json" onChange={e => void scegli(e.target.files?.[0])}
          className="block w-full text-sm file:mr-3 file:rounded-[7px] file:border file:border-line-strong file:bg-surface file:px-3 file:py-1.5 file:text-[13px] file:font-medium" />
        {errore && <Avviso tipo="errore">{errore}</Avviso>}
        {pronto && r && (
          <>
            <Avviso tipo="ok">
              <b>{pronto.nomeFile}</b>: {r.squadre} squadre, {r.assegnazioni} giocatori in rosa, {r.giornate} giornate di voti,
              {' '}{r.movimenti} movimenti, {r.indisponibili} indisponibili.
              {pronto.origine === 'pagina' && <> Listone da {r.giocatori} giocatori{r.calendario ? ', calendario di serie A' : ''}
                {r.rigoristi ? `, ${r.rigoristi} rigoristi` : ''}{r.storico ? `, statistiche di ${r.storico} giocatori` : ''}
                {r.calendarioLega ? ', calendario di lega' : ''}.</>}
            </Avviso>
            {r.avvisi.map(a => <Avviso key={a} tipo="attenzione">{a}</Avviso>)}
            <Campo etichetta="Nome della lega" required value={nome} onChange={e => setNome(e.target.value)} />
            <Bottone variante="primario" disabled={invio || !nome.trim()} onClick={() => void importa()} className="w-full">
              {invio ? 'Importo…' : 'Importa come nuova lega'}
            </Bottone>
            <Suggerimento>Diventi admin della lega importata; gli altri li inviti dopo, dalla pagina della lega.</Suggerimento>
          </>
        )}
      </div>
    </Card>
  )
}

function CreaLega() {
  const vai = useNavigate()
  const [nome, setNome] = useState('')
  const [squadre, setSquadre] = useState('')
  const [budget, setBudget] = useState('500')
  const [errore, setErrore] = useState<string | null>(null)
  const [invio, setInvio] = useState(false)

  async function crea(e: FormEvent) {
    e.preventDefault()
    const elenco = squadre.split('\n').map(s => s.trim()).filter(Boolean)
    if (elenco.length < 2) return setErrore('Servono almeno due squadre, una per riga.')
    setInvio(true); setErrore(null)
    const { data, error } = await supabase.rpc('crea_lega', { p_nome: nome.trim(), p_squadre: elenco, p_budget: parseInt(budget) || 500 })
    setInvio(false)
    if (error) return setErrore(error.message)
    vai(`/lega/${data as string}`)
  }

  return (
    <Card titolo="Crea una lega nuova">
      <form onSubmit={crea} className="space-y-3">
        <Campo etichetta="Nome" required value={nome} onChange={e => setNome(e.target.value)} />
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold tracking-wider text-muted uppercase">Squadre, una per riga</span>
          <textarea rows={5} value={squadre} onChange={e => setSquadre(e.target.value)}
            className="w-full rounded-[7px] border border-line-strong bg-surface px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none" />
        </label>
        <Campo etichetta="Crediti per squadra" type="number" min={1} value={budget} onChange={e => setBudget(e.target.value)} />
        {errore && <Avviso tipo="errore">{errore}</Avviso>}
        <Bottone variante="primario" type="submit" disabled={invio || !nome.trim()} className="w-full">{invio ? 'Creo…' : 'Crea'}</Bottone>
      </form>
    </Card>
  )
}

function EntraConCodice() {
  const vai = useNavigate()
  const [codice, setCodice] = useState('')
  const [errore, setErrore] = useState<string | null>(null)

  async function entra(e: FormEvent) {
    e.preventDefault(); setErrore(null)
    const pulito = codice.trim().split('/').pop() ?? ''       // va bene anche il link intero
    const { data, error } = await supabase.rpc('unisciti', { p_codice: pulito })
    if (error) return setErrore(error.message)
    vai(`/lega/${data as string}`)
  }

  return (
    <Card titolo="Entra con un invito">
      <form onSubmit={entra} className="space-y-3">
        <Campo etichetta="Codice o link d'invito" required value={codice} onChange={e => setCodice(e.target.value)} />
        {errore && <Avviso tipo="errore">{errore}</Avviso>}
        <Bottone variante="primario" type="submit" className="w-full">Entra</Bottone>
        <Suggerimento>L'admin della lega lo crea dalla pagina della lega, con il ruolo che vuole darti.</Suggerimento>
      </form>
    </Card>
  )
}
