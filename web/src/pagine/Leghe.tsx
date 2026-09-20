import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { supabase } from '../lib/supabase.ts'
import { leggiFileApp, preparaImport, type PacchettoImport, type Riepilogo } from '../data/importa-app.ts'
import { stagioneCorrente } from '../data/carica.ts'
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

/* Il pannello delle squadre: una riga per squadra invece di una textarea con i
   punti a capo. «Quante siete?» genera le righe, Invio apre la successiva e un
   elenco incollato si spalma; i doppioni si vedono mentre scrivi, perché il
   database li rifiuta e conviene saperlo prima di premere «Crea». */
const MINIME = 2
const MASSIME = 30

export function CreaLega() {
  const vai = useNavigate()
  const [nome, setNome] = useState('')
  const [squadre, setSquadre] = useState<string[]>(() => Array<string>(8).fill(''))
  const [stagione, setStagione] = useState(() => stagioneCorrente())
  const [budget, setBudget] = useState('500')
  const [errore, setErrore] = useState<string | null>(null)
  const [invio, setInvio] = useState(false)
  const campi = useRef<(HTMLInputElement | null)[]>([])
  const aFuoco = useRef<number | null>(null)

  // una riga appena nata non c'è ancora quando la si chiede: il fuoco si sposta dopo il disegno
  useEffect(() => {
    const i = aFuoco.current
    if (i === null) return
    aFuoco.current = null
    campi.current[i]?.focus()
  })

  const nomi = squadre.map(s => s.trim()).filter(Boolean)
  const quante = new Map<string, number>()
  for (const n of nomi) quante.set(n.toLowerCase(), (quante.get(n.toLowerCase()) ?? 0) + 1)
  const doppia = (v: string) => (quante.get(v.trim().toLowerCase()) ?? 0) > 1
  // il nome ripetuto si dice come lo si è scritto la prima volta, non nella forma che lo ha reso doppio
  const doppioni = nomi.filter((n, i) => doppia(n) && nomi.findIndex(x => x.toLowerCase() === n.toLowerCase()) === i)

  const scrivi = (i: number, v: string) => setSquadre(s => s.map((x, j) => (j === i ? v : x)))

  /* Alzando il numero nascono righe vuote; abbassandolo se ne tolgono solo di
     vuote in fondo — una riga con un nome dentro si cancella con la sua ✕. */
  function quanteSiete(n: number) {
    setSquadre(s => {
      if (n > s.length) return [...s, ...Array<string>(Math.min(n, MASSIME) - s.length).fill('')]
      let fine = s.length
      while (fine > n && fine > MINIME && !s[fine - 1].trim()) fine--
      return s.slice(0, fine)
    })
  }

  function aggiungi(dopo = squadre.length - 1) {
    if (squadre.length >= MASSIME) return
    setSquadre(s => [...s.slice(0, dopo + 1), '', ...s.slice(dopo + 1)])
    aFuoco.current = dopo + 1
  }

  const togli = (i: number) =>
    setSquadre(s => (s.length <= MINIME ? s.map((x, j) => (j === i ? '' : x)) : s.filter((_, j) => j !== i)))

  function tasto(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    e.preventDefault()                                       // dentro un form Invio manderebbe tutto
    if (i + 1 < squadre.length && !squadre[i + 1].trim()) campi.current[i + 1]?.focus()
    else aggiungi(i)
  }

  /* Chi ha i nomi in chat o in un foglio li incolla tutti insieme: è l'unica
     cosa che la textarea faceva bene, e qui si spalmano sulle righe. */
  function incolla(i: number, e: ClipboardEvent<HTMLInputElement>) {
    const testo = e.clipboardData.getData('text')
    if (!/[\n\r\t]/.test(testo)) return                      // un nome solo: incolla come sempre
    e.preventDefault()
    const arrivati = testo.split(/[\n\r\t]+/).map(x => x.trim()).filter(Boolean).slice(0, MASSIME - i)
    if (!arrivati.length) return
    setSquadre(s => {
      const nuove = [...s]
      arrivati.forEach((n, k) => { nuove[i + k] = n })
      return nuove
    })
    aFuoco.current = i + arrivati.length - 1
  }

  async function crea(e: FormEvent) {
    e.preventDefault()
    if (nomi.length < MINIME) return setErrore('Servono almeno due squadre con un nome.')
    if (doppioni.length) return setErrore(`Due squadre si chiamano «${doppioni[0]}»: dai a ognuna un nome diverso.`)
    if (!/^\d{4}\/\d{2}$/.test(stagione.trim())) return setErrore('La stagione si scrive come 2026/27.')
    setInvio(true); setErrore(null)
    const { data, error } = await supabase.rpc('crea_lega', {
      p_nome: nome.trim(), p_squadre: nomi, p_budget: parseInt(budget) || 500, p_stagione: stagione.trim(),
    })
    setInvio(false)
    if (error) return setErrore(error.message)
    vai(`/lega/${data as string}`)
  }

  const etichetta = 'mb-1 block text-[11px] font-semibold tracking-wider text-muted uppercase'
  const campo = 'w-full rounded-[7px] border bg-surface px-2.5 py-1.5 text-sm focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)] focus:outline-none'
  return (
    <Card titolo="Crea una lega nuova">
      <form onSubmit={crea} className="space-y-3">
        <Campo etichetta="Nome" required value={nome} onChange={e => setNome(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Campo etichetta="Stagione" required value={stagione} placeholder="2026/27" onChange={e => setStagione(e.target.value)} />
          <Campo etichetta="Crediti per squadra" type="number" min={1} value={budget} onChange={e => setBudget(e.target.value)} />
        </div>

        <div className="space-y-2">
          <div className="flex items-end justify-between gap-3">
            <label className="block">
              <span className={etichetta}>Quante siete?</span>
              <input type="number" min={MINIME} max={MASSIME} value={squadre.length} aria-label="Quante squadre"
                onChange={e => quanteSiete(parseInt(e.target.value) || MINIME)}
                className={`${campo} fr-num w-20 border-line-strong`} />
            </label>
            <span className="pb-1.5 text-xs text-muted">
              <b className="fr-num text-ink">{nomi.length}</b>
              {nomi.length === 1 ? ' nome scritto su ' : ' nomi scritti su '}
              <b className="fr-num text-ink">{squadre.length}</b>
            </span>
          </div>

          <ul className="space-y-1.5">
            {squadre.map((sq, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="fr-num w-5 shrink-0 text-right text-[11px] text-muted">{i + 1}</span>
                <input value={sq} placeholder={`Squadra ${i + 1}`} aria-label={`Squadra ${i + 1}`}
                  ref={el => { campi.current[i] = el }}
                  onChange={e => scrivi(i, e.target.value)}
                  onKeyDown={e => tasto(i, e)}
                  onPaste={e => incolla(i, e)}
                  className={`${campo} ${doppia(sq) ? 'border-dashed border-warn' : 'border-line-strong'}`} />
                <button type="button" onClick={() => togli(i)} title="Togli questa squadra" aria-label={`Togli la squadra ${i + 1}`}
                  className="x fr-bottone shrink-0 rounded-[7px] border border-line-strong px-2 py-1.5 text-sm text-muted">✕</button>
              </li>
            ))}
          </ul>

          <Bottone type="button" onClick={() => aggiungi()} disabled={squadre.length >= MASSIME} className="w-full">
            + aggiungi squadra
          </Bottone>
          <p className="text-[11px] text-muted">Invio apre la riga dopo; un elenco incollato riempie più righe insieme.</p>
        </div>

        {doppioni.length > 0 && (
          <Avviso tipo="attenzione">
            {doppioni.length === 1
              ? `Due squadre si chiamano «${doppioni[0]}». `
              : `Questi nomi sono ripetuti: ${doppioni.map(d => `«${d}»`).join(', ')}. `}
            Servono nomi diversi: la lega distingue le squadre solo da lì.
          </Avviso>
        )}
        {errore && <Avviso tipo="errore">{errore}</Avviso>}
        <Bottone variante="primario" type="submit" className="w-full"
          disabled={invio || !nome.trim() || nomi.length < MINIME || doppioni.length > 0}>{invio ? 'Creo…' : 'Crea'}</Bottone>
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
