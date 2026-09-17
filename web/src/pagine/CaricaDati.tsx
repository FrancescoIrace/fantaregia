import { useState, type ReactNode } from 'react'
import type { Motore } from '../domain/motore.ts'
import {
  calendarioDaRighe, giornataDaTitolo, leggiVoti, parseCSV, righeInGiocatori, storicoDaRighe, unisciRimasti,
} from '../domain/importa.ts'
import type { Rigoristi, VotoRiga } from '../domain/tipi.ts'
import { parseCalLega, riallinea } from '../domain/calendario-lega.ts'
import { ingressoMotore, type RigheLega } from '../data/componi.ts'
import { leggiPagina } from '../data/importa-app.ts'
import {
  effettoVoti, salvaCalendarioLega, salvaDataset, salvaVoti, scaricaCalendario, squadreAsta, togliGiornata,
} from '../data/carica.ts'
import { apriCartella, righeDaFile } from '../lib/fogli.ts'
import { Avviso, Bottone, Card, Suggerimento } from '../ui.tsx'

type Esito = { tipo: 'ok' | 'errore' | 'attenzione'; testo: ReactNode } | null
const data = (t: unknown) => typeof t === 'number' || typeof t === 'string' ? new Date(t).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }) : null

/* «Carica dati»: la risposta prima delle domande, come «A che punto sei»
   nell'originale — cosa c'è, fino a quando, cosa manca — e accanto a
   ogni voce il modo di aggiornarla. */
export default function CaricaDati({ legaId, righe, motore }: { legaId: string; righe: RigheLega; motore: Motore }) {
  const meta = (t: string) => righe.dataset.find(d => d.tipo === t)?.meta ?? {}
  const gv = motore.giornateGiocate(), ultima = gv.length ? Math.max(...gv) : 0
  const attesa = Math.max(0, motore.giornataOggi() - 1)
  const squadreListone = [...new Set(motore.PL.map(p => p.s))].sort()

  /* Il calendario di lega porta con sé i risultati: se resta indietro, a
     restare indietro sono la classifica di lega e la verifica. */
  const CL = motore.S.lega, glv = motore.legaGiocate()
  const ultimaRis = glv.length ? Math.max(...glv) : 0
  const attesaRis = CL ? Math.max(0, motore.legaOggi() - 1) : 0
  const daAbbinare = CL ? CL.teams.length - Object.keys(motore.S.legaMap ?? {}).length : 0

  return (
    <Card titolo="Carica dati">
      <div className="divide-y divide-line">
        <Riga nome="Da una pagina Fantaregia.html" stato="listone, calendario, rigoristi e statistiche in un colpo"
          azione={esito => <FilePagina legaId={legaId} esito={esito} />} />
        <Riga nome="Listone" stato={motore.PL.length ? `${motore.PL.length} giocatori${data(meta('listone').when) ? ` · ${data(meta('listone').when)}` : ''}` : 'non caricato'}
          manca={!motore.PL.length}
          azione={esito => <FileListone legaId={legaId} righe={righe} calendario={motore.CAL.teams} esito={esito} />} />
        <Riga nome="Voti di giornata"
          stato={!gv.length ? 'nessuna giornata' : ultima >= attesa ? `fino alla ${ultima}ª · in pari` : attesa - ultima === 1 ? `fino alla ${ultima}ª · manca la ${attesa}ª` : `fino alla ${ultima}ª · mancano dalla ${ultima + 1}ª alla ${attesa}ª`}
          manca={!gv.length || ultima < attesa}
          azione={esito => <FileVoti legaId={legaId} righe={righe} motore={motore} esito={esito} />} />
        <Riga nome="Calendario di serie A" stato={motore.CAL.teams.length ? `${motore.CAL.teams.length} squadre${meta('calendario').fonte ? ` · da ${String(meta('calendario').fonte)}` : ''}` : 'non caricato'}
          manca={!motore.CAL.teams.length}
          azione={esito => <FileCalendario legaId={legaId} stagione={righe.lega.stagione} squadre={squadreListone} esito={esito} />} />
        <Riga nome="Calendario di lega e risultati"
          stato={!CL ? 'non caricato · senza questo non ci sono classifica di lega né verifica'
            : `${CL.teams.length} squadre · ${CL.gior.length} giornate`
              + (!ultimaRis ? ' · nessun risultato'
                : ultimaRis >= attesaRis ? ` · risultati fino alla ${ultimaRis}ª · in pari`
                : attesaRis - ultimaRis === 1 ? ` · risultati fino alla ${ultimaRis}ª · manca la ${attesaRis}ª`
                : ` · risultati fino alla ${ultimaRis}ª · mancano dalla ${ultimaRis + 1}ª alla ${attesaRis}ª`)
              + (daAbbinare > 0 ? ` · ${daAbbinare} da abbinare` : '')}
          manca={!CL || ultimaRis < attesaRis}
          azione={esito => <FileCalLega legaId={legaId} motore={motore} esito={esito} />} />
        <Riga nome="Statistiche della stagione scorsa" stato={Object.keys(righe.dataset.find(d => d.tipo === 'storico')?.dati ?? {}).length ? 'caricate' : 'non caricate'}
          azione={esito => <FileSemplice etichetta="xlsx" accetta=".xlsx,.xls,.csv" esito={esito}
            carica={async f => { const h = storicoDaRighe(await righeDaFile(f, false)); await salvaDataset(legaId, 'storico', h, { name: f.name, when: Date.now() }); return `${Object.keys(h).length} giocatori con statistiche` }} />} />
        <Riga nome="Rigoristi" stato={Object.keys(righe.dataset.find(d => d.tipo === 'rigoristi')?.dati ?? {}).length ? `${Object.keys(righe.dataset.find(d => d.tipo === 'rigoristi')!.dati as object).length} rigoristi` : 'non caricati'}
          azione={esito => <FileSemplice etichetta="json" accetta=".json" esito={esito}
            carica={async f => { const r = leggiRigoristi(await f.text()); await salvaDataset(legaId, 'rigoristi', r, { name: f.name, when: Date.now() }); return `${Object.keys(r).length} rigoristi` }} />} />
      </div>
      <div className="mt-3">
        <Suggerimento>
          Listone, voti e statistiche li scarichi tu con il tuo account e restano dentro questa lega: non vengono
          ripubblicati da nessuna parte. Il calendario invece si può prendere da openfootball, che è un dataset aperto.
        </Suggerimento>
      </div>
    </Card>
  )
}

function Riga({ nome, stato, manca, azione }: { nome: string; stato: string; manca?: boolean; azione: (esito: (e: Esito) => void) => ReactNode }) {
  const [esito, setEsito] = useState<Esito>(null)
  return (
    <div className="py-3">
      <div className="cd-riga flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className={`h-2 w-2 flex-none rounded-full ${manca ? 'border-2 border-ink bg-transparent' : 'bg-ok'}`} />
        <span className="cd-nome w-56 font-semibold">{nome}</span>
        <span className="cd-stato min-w-0 flex-1 text-sm text-muted">{stato}</span>
        <div className="cd-azioni flex flex-wrap items-center gap-2">{azione(setEsito)}</div>
      </div>
      {esito && <div className="mt-2"><Avviso tipo={esito.tipo}>{esito.testo}</Avviso></div>}
    </div>
  )
}

function SceltaFile({ etichetta, accetta, multipli, onFile, disabled }: { etichetta: string; accetta: string; multipli?: boolean; onFile: (f: File[]) => void; disabled?: boolean }) {
  return (
    <label className={`cursor-pointer rounded-[7px] border border-line-strong bg-surface px-2.5 py-1 text-[12.5px] font-medium hover:border-accent hover:text-accent ${disabled ? 'pointer-events-none opacity-50' : ''}`}>
      {etichetta}
      <input type="file" className="hidden" accept={accetta} multiple={multipli}
        onChange={e => { const f = [...(e.target.files ?? [])]; e.target.value = ''; if (f.length) onFile(f) }} />
    </label>
  )
}

function FileSemplice({ etichetta, accetta, carica, esito }: { etichetta: string; accetta: string; carica: (f: File) => Promise<string>; esito: (e: Esito) => void }) {
  const [invio, setInvio] = useState(false)
  return <SceltaFile etichetta={invio ? 'Carico…' : etichetta} accetta={accetta} disabled={invio} onFile={async ([f]) => {
    setInvio(true); esito(null)
    try { esito({ tipo: 'ok', testo: `${f.name}: ${await carica(f)}.` }) } catch (e) { esito({ tipo: 'errore', testo: (e as Error).message }) }
    setInvio(false)
  }} />
}

function leggiRigoristi(testo: string): Rigoristi {
  const o = JSON.parse(testo) as Record<string, unknown>
  const ok = Object.entries(o).filter(([id, v]) => +id > 0 && Array.isArray(v) && typeof v[0] === 'number')
  if (!ok.length) throw new Error('il file non è nel formato dei rigoristi: { "id": [gerarchia, confermato] }')
  return Object.fromEntries(ok.map(([id, v]) => [id, [(v as number[])[0], (v as number[])[1] ? 1 : 0]])) as Rigoristi
}

function FilePagina({ legaId, esito }: { legaId: string; esito: (e: Esito) => void }) {
  return <FileSemplice etichetta="html" accetta=".html,.htm" esito={esito} carica={async f => {
    const p = leggiPagina(await f.text())
    const fatti: string[] = []
    if (p.players.length) { await salvaDataset(legaId, 'listone', p.players, { ...(p.meta ?? {}), name: p.meta?.name ?? f.name }); fatti.push(`listone da ${p.players.length} giocatori`) }
    if (p.cal) { await salvaDataset(legaId, 'calendario', p.cal, { fonte: 'pagina', when: Date.now() }); fatti.push(`calendario di ${p.cal.teams.length} squadre`) }
    if (p.rig) { await salvaDataset(legaId, 'rigoristi', p.rig, { when: Date.now() }); fatti.push(`${Object.keys(p.rig).length} rigoristi`) }
    if (p.hist) { await salvaDataset(legaId, 'storico', p.hist, { when: Date.now() }); fatti.push(`statistiche di ${Object.keys(p.hist).length} giocatori`) }
    if (!fatti.length) throw new Error('nella pagina non c\'è niente da caricare')
    return `caricati ${fatti.join(', ')}${p.shared ? ' (la lega dentro la pagina non viene toccata: per quella c\'è l\'import)' : ''}`
  }} />
}

function FileListone({ legaId, righe, calendario, esito }: { legaId: string; righe: RigheLega; calendario: string[]; esito: (e: Esito) => void }) {
  return <FileSemplice etichetta="xlsx o csv" accetta=".xlsx,.xls,.csv,.txt" esito={esito} carica={async f => {
    const nuovo = righeInGiocatori(await righeDaFile(f))
    const { players, rimasti } = unisciRimasti(nuovo, righe.assegnazioni.map(a => a.snap))
    await salvaDataset(legaId, 'listone', players, { name: f.name, when: Date.now(), count: players.length })
    const fuori = calendario.length ? [...new Set(nuovo.map(p => p[4]))].filter(t => !calendario.includes(t)) : []
    return `${nuovo.length} giocatori` + (rimasti ? `; ${rimasti} già in rosa non sono più in lista e restano segnati a parte` : '')
      + (fuori.length ? `; attenzione: ${fuori.join(', ')} non ${fuori.length > 1 ? 'compaiono' : 'compare'} nel calendario` : '')
  }} />
}

function FileCalendario({ legaId, stagione, squadre, esito }: { legaId: string; stagione: string; squadre: string[]; esito: (e: Esito) => void }) {
  const [invio, setInvio] = useState(false)
  async function scarica() {
    setInvio(true); esito(null)
    try {
      const { cal, ignote } = await scaricaCalendario(stagione, squadre)
      await salvaDataset(legaId, 'calendario', cal, { fonte: 'openfootball', when: Date.now() })
      esito(ignote.length
        ? { tipo: 'attenzione', testo: `Calendario scaricato, ma ${ignote.join(', ')} non si ${ignote.length > 1 ? 'abbinano' : 'abbina'} a nessuna squadra del listone.` }
        : { tipo: 'ok', testo: `Calendario ${stagione} scaricato da openfootball: ${cal.teams.length} squadre, ${cal.fix[0]?.length ?? 0} giornate.` })
    } catch (e) { esito({ tipo: 'errore', testo: (e as Error).message }) }
    setInvio(false)
  }
  return (
    <>
      <Bottone piccolo disabled={invio} onClick={() => void scarica()}>{invio ? 'Scarico…' : 'Da openfootball'}</Bottone>
      <FileSemplice etichetta="csv" accetta=".csv,.txt" esito={esito} carica={async f => {
        const cal = calendarioDaRighe(parseCSV(await f.text()))
        await salvaDataset(legaId, 'calendario', cal, { fonte: f.name, when: Date.now() })
        return `${cal.teams.length} squadre, ${cal.fix[0]?.length ?? 0} giornate`
      }} />
    </>
  )
}

/* Il file di leghe.fantacalcio.it: incroci, fantapunti e risultato in gol
   di ogni scontro. Si ricarica a ogni giornata — è così che entrano i
   risultati nuovi, che l'app non sa e non può calcolare da sé. Gli
   abbinamenti con le squadre dell'asta si riallineano da soli, perché
   ricaricando il file i nomi possono essere cambiati. */
function FileCalLega({ legaId, motore, esito }: { legaId: string; motore: Motore; esito: (e: Esito) => void }) {
  const [invio, setInvio] = useState(false)
  return <SceltaFile etichetta={invio ? 'Carico…' : 'xlsx o csv'} accetta=".xlsx,.xls,.csv,.txt" disabled={invio}
    onFile={async ([f]) => {
      setInvio(true); esito(null)
      try {
        const { cal, giocate, offMisto, avvisi } = parseCalLega(await righeDaFile(f, false))
        const r = riallinea(motore.S.lega, motore.S.legaMap ?? {}, cal, squadreAsta(motore))
        await salvaCalendarioLega(legaId, { ...cal, nome: f.name }, r.map, { name: f.name, when: Date.now(), giocate })

        const n = Object.keys(r.map).length, manca = cal.teams.length - n
        const coda = manca > 0 ? ` ${manca === 1 ? 'Ne resta una' : `Ne restano ${manca}`} da abbinare, in «Abbinamenti».` : ''
        const note: ReactNode[] = []
        if (r.rinominate.length) note.push(<div key="rin"><b>Qualcuno ha cambiato nome</b> — {r.rinominate.join('; ')} — ma gli incroci sono identici, quindi gli abbinamenti restano validi.</div>)
        if (r.rifatto) note.push(<div key="rif"><b>Gli incroci sono diversi da quelli di prima</b>: ho tenuto <b>{r.tenuti}</b> abbinamenti riconoscendo i nomi{r.persi.length ? <>, ma <b>{r.persi.join(', ')}</b> {r.persi.length === 1 ? 'non c\'è più' : 'non ci sono più'}</> : null}. Ricontrollali in «Abbinamenti».</div>)
        if (offMisto) note.push(<div key="off"><b>L'aggancio alla serie A non è costante in tutto il file</b>: ho preso il valore più frequente.</div>)
        if (avvisi.length) note.push(<div key="avv">{avvisi.join('; ')}.</div>)

        esito({ tipo: note.length ? 'attenzione' : 'ok', testo: (
          <div className="space-y-1">
            <div>
              Calendario caricato: <b>{cal.teams.length} squadre</b>, <b>{cal.gior.length} giornate</b>.
              {' '}La 1ª di lega è la {Math.max(1, Math.min(38, 1 + cal.off))}ª di serie A.
              {' '}{giocate ? <>Con i risultati di <b>{giocate === 1 ? 'una giornata' : `${giocate} giornate`}</b>.</> : 'Nessuna giornata ancora giocata.'}
            </div>
            <div>
              {!n ? 'Ora abbina i nomi in «Abbinamenti», nella scheda Lega: lo fa uno solo e vale per tutti.'
                : r.aveva ? <>I <b>{n}</b> abbinamenti che avevi restano al loro posto.{coda}</>
                : <>Ne ho abbinate <b>{n}</b> da solo, per somiglianza del nome o per il giocatore simbolo in rosa: <b>controllale</b>, perché indovinare i soprannomi non è una scienza.{coda}</>}
            </div>
            {note}
          </div>
        ) })
      } catch (e) { esito({ tipo: 'errore', testo: `Non sono riuscito a leggere il file: ${(e as Error).message}.` }) }
      setInvio(false)
    }} />
}

/* Un file solo: giornata letta dal titolo (o da indicare) e foglio a scelta.
   Più file insieme: giornata dal titolo di ognuno, a parità vince l'ultimo. */
function FileVoti({ legaId, righe, motore, esito }: { legaId: string; righe: RigheLega; motore: Motore; esito: (e: Esito) => void }) {
  const [pronti, setPronti] = useState<{ nome: string; g: number | null; righe: (f: string) => unknown[][]; fogli: string[] }[] | null>(null)
  const [foglio, setFoglio] = useState('')
  const [invio, setInvio] = useState(false)

  async function leggi(files: File[]) {
    esito(null); setPronti(null)
    try {
      const letti = await Promise.all(files.map(async f => {
        const c = await apriCartella(f)
        return { nome: f.name, fogli: c.fogli, righe: (s: string) => c.righe(s), g: giornataDaTitolo(c.fogli.map(s => c.righe(s, false).slice(0, 4))) }
      }))
      const pref = righe.lega.voti_meta?.sheet || 'Fantacalcio'
      setFoglio(letti[0].fogli.includes(pref) ? pref : letti[0].fogli[0])
      setPronti(letti)
    } catch (e) { esito({ tipo: 'errore', testo: `Non sono riuscito a leggere: ${(e as Error).message}` }) }
  }

  async function applica() {
    if (!pronti) return
    setInvio(true)
    const giornate: { g: number; voti: Record<string, VotoRiga> }[] = [], note: string[] = []
    const perG = new Map<number, typeof pronti[number]>()
    for (const x of pronti) {
      const g = x.g ?? (pronti.length === 1 ? Number(prompt(`Di che giornata è ${x.nome}?`)) : NaN)
      if (!(g >= 1 && g <= 38)) { note.push(`${x.nome}: non riesco a leggere la giornata dal titolo, caricalo da solo`); continue }
      perG.set(g, x)                                  // a parità di giornata vince l'ultimo
    }
    for (const [g, x] of [...perG].sort((a, b) => a[0] - b[0])) {
      try {
        const r = leggiVoti(x.righe(foglio))
        const fuori = Object.keys(r.voti).filter(id => !motore.byId.has(+id)).length
        giornate.push({ g, voti: r.voti })
        note.push(`${g}ª — ${r.righe} con voto, ${r.righe - fuori} nel listone${motore.S.stats[g] ? ', sostituisce quella già caricata' : ''}${r.rfSospetto ? `, ${r.rfSospetto} righe con più rigori che gol: controlla i bonus` : ''}`)
      } catch (e) { note.push(`${g}ª — non caricata: ${(e as Error).message}`) }
    }
    try {
      if (!giornate.length) throw new Error(note.join(' · ') || 'nessuna giornata da caricare')
      const eff = effettoVoti(ingressoMotore(righe), Object.fromEntries(giornate.map(x => [x.g, x.voti])))
      await salvaVoti(legaId, giornate, foglio, eff.rientri.map(r => ({ giocatore_id: r.pid, nota: `ha giocato la ${r.g}ª giornata` })))
      esito({ tipo: 'ok', testo: (
        <div className="space-y-1">
          <div>Caricate dal foglio <b>{foglio}</b>:</div>
          <ul className="ml-4 list-disc">{note.map(n => <li key={n}>{n}</li>)}</ul>
          {eff.squalifiche.length > 0 && <div><b>Squalificati:</b> {eff.squalifiche.map(s => `${eff.nome(s.pid)} (${s.n}ª ammonizione, salta la ${s.g}ª)`).join(' · ')}</div>}
          {eff.rossi.length > 0 && <div><b>Espulsi:</b> {eff.rossi.map(r => eff.nome(r.pid)).join(' · ')} — quante giornate lo decide il giudice sportivo</div>}
          {eff.rientri.length > 0 && <div><b>Rientrati:</b> {eff.rientri.map(r => `${eff.nome(r.pid)} (ha giocato la ${r.g}ª)`).join(' · ')} — tolti dall'infermeria</div>}
          {eff.diffidati.length > 0 && <div><b>Diffidati:</b> {eff.diffidati.slice(0, 8).map(d => `${eff.nome(d.pid)} (${d.amm})`).join(' · ')}{eff.diffidati.length > 8 ? ` e altri ${eff.diffidati.length - 8}` : ''}</div>}
        </div>
      ) })
      setPronti(null)
    } catch (e) { esito({ tipo: 'errore', testo: (e as Error).message }) }
    setInvio(false)
  }

  const gv = motore.giornateGiocate()
  return (
    <>
      <SceltaFile etichetta="xlsx, anche più file" accetta=".xlsx,.xls" multipli onFile={f => void leggi(f)} />
      {pronti && (
        <>
          <select value={foglio} onChange={e => setFoglio(e.target.value)} className="rounded-[7px] border border-line-strong bg-surface px-2 py-1 text-[12.5px]">
            {pronti[0].fogli.map(s => <option key={s}>{s}</option>)}
          </select>
          <Bottone piccolo variante="primario" disabled={invio} onClick={() => void applica()}>
            {invio ? 'Carico…' : `Carica ${pronti.length === 1 ? (pronti[0].g ? `la ${pronti[0].g}ª` : 'la giornata') : `${pronti.length} file`}`}
          </Bottone>
        </>
      )}
      {!pronti && gv.length > 0 && (
        <Bottone piccolo variante="pericolo" onClick={() => {
          const g = Math.max(...gv)
          if (confirm(`Togliere i voti della ${g}ª giornata?`)) void togliGiornata(legaId, g).then(() => esito({ tipo: 'ok', testo: `Giornata ${g} tolta.` }), e => esito({ tipo: 'errore', testo: (e as Error).message }))
        }}>Togli l'ultima</Bottone>
      )}
    </>
  )
}
