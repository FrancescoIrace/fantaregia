import { useState } from 'react'
import type { Motore } from '../domain/motore.ts'
import type { Giocatore } from '../domain/tipi.ts'
import { MentChip, OutBadge, RigBadge } from '../viste/segni.tsx'
import { Card } from '../ui.tsx'

const TITLAB: Record<number, string> = { 1: 'titolare', 2: 'ballottaggio', 3: 'panchina' }
const ordina = (a: Giocatore, b: Giocatore) => ('PDCA'.indexOf(a.r) - 'PDCA'.indexOf(b.r)) || b.q - a.q

/* ══ Titolari e rigoristi ════════════════════════════════════════════
   renderTitolari() dell'app a file singolo: per ogni squadra chi gioca,
   chi è in ballottaggio, chi parte dietro, e chi è fuori. «dal campo»
   vuol dire che il livello viene dai voti veri e non più dalle quotazioni. */
export default function Titolari({ motore: m }: { motore: Motore }) {
  const [q, setQ] = useState('')
  const [soloRig, setSoloRig] = useState(false)
  const cerca = q.trim().toLowerCase()

  const schede = [...new Set(m.PL.map(p => p.s))].sort().map(t => {
    let rosa = m.PL.filter(p => p.s === t)
    if (soloRig) rosa = rosa.filter(p => m.rigOf(p))
    if (cerca && !t.toLowerCase().includes(cerca)) rosa = rosa.filter(p => p.n.toLowerCase().includes(cerca))
    if (!rosa.length) return null
    const rig = rosa.filter(p => m.rigOf(p)).sort((a, b) => m.rigOf(a)![0] - m.rigOf(b)![0])
    const fuori = rosa.filter(p => m.isOut(p.id)).sort(ordina)
    const dentro = rosa.filter(p => !m.isOut(p.id))
    const riga = (p: Giocatore) => (
      <div key={p.id} className="tp">
        <span className="fr-filo-ruolo" data-ruolo={p.r} aria-hidden="true" />
        <span className="ruolo-lettera">{p.r}</span>
        <span className="nm">{p.n}</span><RigBadge m={m} p={p} /><OutBadge m={m} p={p} /><MentChip m={m} p={p} />
        <span className="qz fr-num">{p.q}</span>
      </div>
    )
    return (
      <div key={t} className="rounded-card border border-line bg-surface shadow-card">
        <div className="tithead"><h3>{t}</h3><span className="hint mono">{rosa.length} in lista</span></div>
        {rig.length > 0 && (
          <div className="rigrow">
            <span className="font-semibold text-muted">Rigori:</span>
            {rig.map(p => <span key={p.id} className="inline-flex items-center gap-[5px]"><RigBadge m={m} p={p} />{p.n}</span>)}
          </div>
        )}
        {[1, 2, 3].map(lv => {
          const l = dentro.filter(p => m.titStato(p).liv === lv).sort(ordina)
          if (!l.length) return null
          const dalCampo = l.every(p => m.titStato(p).dati)
          return (
            <div key={lv} className="titsec">
              <div className="sh">{TITLAB[lv]} · {l.length}{dalCampo && <span className="tsrc">dal campo</span>}</div>
              {l.map(riga)}
            </div>
          )
        })}
        {fuori.length > 0 && <div className="titsec"><div className="sh">indisponibili · {fuori.length}</div>{fuori.map(riga)}</div>}
      </div>
    )
  }).filter(Boolean)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <label className="block min-w-[220px] flex-1">
          <span className="mb-1 block text-[11px] font-semibold tracking-wider text-muted uppercase">Cerca squadra o giocatore</span>
          <input type="text" value={q} onChange={e => setQ(e.target.value)} placeholder="Napoli, Orsolini…" autoComplete="off"
            className="w-full rounded-[7px] border border-line-strong bg-surface px-2.5 py-1.5 text-sm" />
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" checked={soloRig} onChange={e => setSoloRig(e.target.checked)} /> Solo rigoristi</label>
      </div>
      {m.PL.length === 0
        ? <Card><div className="empty">Il listone non è caricato: fallo da <b>Carica dati</b> in Panoramica.</div></Card>
        : schede.length ? <div className="titgrid">{schede}</div>
          : <Card><div className="empty">Nessuna squadra con questi filtri.</div></Card>}
      <Card titolo="Da dove vengono questi dati">
        {/* la legenda mostra i badge veri, con le stesse classi delle righe:
            descriveva ancora «pieno/sbiadito», che era il disegno di prima */}
        <p className="hint max-w-[76ch]">I <b>rigoristi</b> sono quelli caricati nella lega.
          Il badge pieno <span className="rig first">R</span> è il primo rigorista, quello vuoto <span className="rig">R2</span> il secondo;
          il bordo tratteggiato <span className="rig soft">R2</span> vuol dire che a indicarlo è una sola delle due fonti.</p>
        <p className="hint mt-2.5 max-w-[76ch]">La <b>titolarità</b> non viene da una lista di probabili formazioni, che dopo una giornata è ancora
          ballerina: è dedotta dalle quotazioni stesse, cioè da quanto il mercato si aspetta che uno giochi. Dentro ogni squadra e ruolo, chi è
          quotato di più è dato titolare; alla controprova, 17 dei 18 primi rigoristi risultano titolari. Man mano che arrivano i voti passa ai
          fatti, e alla sesta giornata le quotazioni di agosto non contano più.</p>
      </Card>
    </div>
  )
}
