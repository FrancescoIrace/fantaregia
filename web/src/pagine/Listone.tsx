import { useRef, useState } from 'react'
import type { Motore } from '../domain/motore.ts'
import type { Giocatore, Obiettivo, Ruolo } from '../domain/tipi.ts'
import type { RigheLega } from '../data/componi.ts'
import { salvaObiettivi } from '../data/lega.ts'
import { appetCol, fmCol } from '../viste/colori.ts'
import { FixStrip, MentChip, OutBadge, RigBadge, TitDot } from '../viste/segni.tsx'
import { Card } from '../ui.tsx'
import Scheda from './Scheda.tsx'

type Chiave = 'star' | 'r' | 'n' | 'q' | 'f' | 'att' | 'v' | 'app' | 'fm' | 'cal' | 'max'
const ORDINE_RUOLO: Record<Ruolo, number> = { P: 0, D: 1, C: 2, A: 3 }
const scoreCol = (s: number) => s >= 3.4 ? 'var(--ok)' : s <= 2.75 ? 'var(--crit)' : 'var(--muted)'

/* ══ Listone ═════════════════════════════════════════════════════════
   renderList() dell'app a file singolo: 518 giocatori con prezzo atteso,
   convenienza, appetibilità, fantamedia e prossime partite. Gli obiettivi
   con il prezzo massimo sono privati: li vede solo chi li segna.       */
export default function Listone({ legaId, utenteId, righe, motore: m, puoScrivere, ricarica }: {
  legaId: string; utenteId: string; righe: RigheLega; motore: Motore; puoScrivere: boolean; ricarica: () => void
}) {
  const [ruolo, setRuolo] = useState<Ruolo | ''>('')
  const [q, setQ] = useState('')
  const [squadra, setSquadra] = useState('')
  const [qmin, setQmin] = useState('')
  const [qmax, setQmax] = useState('')
  const [from, setFrom] = useState(() => m.giornataOggi())
  const [span, setSpan] = useState(5)
  const [soloLiberi, setSoloLiberi] = useState(false)
  const [soloObiettivi, setSoloObiettivi] = useState(false)
  const [soloMiei, setSoloMiei] = useState(false)
  const [ordine, setOrdine] = useState<{ k: Chiave; dir: 1 | -1 }>({ k: 'q', dir: -1 })
  const [aperto, setAperto] = useState<number | null>(null)
  const [obiettivi, setObiettivi] = useState<Record<string, Obiettivo>>(() => righe.preferenze?.obiettivi ?? {})
  const attesa = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  function cambiaObiettivi(nuovi: Record<string, Obiettivo>) {
    setObiettivi(nuovi)
    clearTimeout(attesa.current)
    attesa.current = setTimeout(() => { void salvaObiettivi(legaId, utenteId, nuovi) }, 700)
  }
  const segna = (pid: number, o: Obiettivo | null) => {
    const nuovi = { ...obiettivi }
    if (o) nuovi[pid] = o; else delete nuovi[pid]
    cambiaObiettivi(nuovi)
  }

  const me = m.meId(), cerca = q.trim().toLowerCase()
  const mn = parseInt(qmin) || 0, mx = parseInt(qmax) || 999
  const f = Math.max(1, Math.min(38, from)), sp = Math.max(1, Math.min(38, span))
  const righeVis = m.PL.filter(p => {
    if (ruolo && p.r !== ruolo) return false
    if (squadra && p.s !== squadra) return false
    if (p.q < mn || p.q > mx) return false
    if (cerca && !(p.n.toLowerCase().includes(cerca) || p.s.toLowerCase().includes(cerca))) return false
    const a = m.S.assign[p.id]
    if (soloLiberi && a) return false
    if (soloObiettivi && !obiettivi[p.id]) return false
    if (soloMiei && !(a && a.team === me)) return false
    return true
  })
  const valore = (p: Giocatore): number => {
    switch (ordine.k) {
      case 'star': return obiettivi[p.id] ? 1 : 0
      case 'r': return ORDINE_RUOLO[p.r]
      case 'max': return obiettivi[p.id]?.max || 0
      case 'cal': return m.calScore(p.s, p.r, f, sp) || 0
      case 'app': return m.appet(p, f, sp)
      case 'fm': return m.statFor(p.id)?.fm ?? -1
      case 'att': return m.attesaOra(p.id) || m.attesa(p.id)
      case 'v': return p.v ?? 0
      case 'f': return p.f ?? 0
      default: return p.q
    }
  }
  righeVis.sort((a, b) => ordine.k === 'n'
    ? ordine.dir * a.n.localeCompare(b.n)
    : ordine.dir * (valore(a) - valore(b)) || a.n.localeCompare(b.n))
  const conVoti = m.giornateGiocate().length > 0

  const ordinaPer = (k: Chiave) => setOrdine(o => o.k === k ? { k, dir: o.dir === 1 ? -1 : 1 } : { k, dir: -1 })
  const th = (k: Chiave, lab: string, cls = '', titolo?: string) => (
    <th key={k} className={`${cls} cursor-pointer select-none`} title={titolo} onClick={() => ordinaPer(k)}>
      {lab}{ordine.k === k && <span className="ar"> {ordine.dir > 0 ? '▲' : '▼'}</span>}
    </th>
  )

  if (!m.PL.length) return <Card><div className="empty">Il listone non è caricato: fallo da <b>Carica dati</b>, in Panoramica.</div></Card>

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <span className="fl">Ruolo</span>
          <div className="roleseg">
            {(['', 'P', 'D', 'C', 'A'] as const).map(r => (
              <button key={r} type="button" aria-pressed={ruolo === r} onClick={() => setRuolo(r)}>{r || 'Tutti'}</button>
            ))}
          </div>
        </div>
        <label className="block min-w-[180px] flex-1">
          <span className="fl">Cerca</span>
          <input type="text" value={q} onChange={e => setQ(e.target.value)} placeholder="Nome giocatore…" autoComplete="off"
            className="w-full rounded-[7px] border border-line-strong bg-surface px-2.5 py-1.5 text-sm" />
        </label>
        <label className="block">
          <span className="fl">Squadra</span>
          <select value={squadra} onChange={e => setSquadra(e.target.value)} className="rounded-[7px] border border-line-strong bg-surface px-2 py-1.5 text-sm">
            <option value="">Tutte</option>
            {[...new Set(m.PL.map(p => p.s))].sort().map(t => <option key={t}>{t}</option>)}
          </select>
        </label>
        {([['Qt. min', qmin, setQmin, '0'], ['Qt. max', qmax, setQmax, '36']] as const).map(([lab, v, set, ph]) => (
          <label key={lab} className="block w-[92px]">
            <span className="fl">{lab}</span>
            <input type="number" min={0} value={v} placeholder={ph} onChange={e => set(e.target.value)}
              className="w-full rounded-[7px] border border-line-strong bg-surface px-2.5 py-1.5 text-sm" />
          </label>
        ))}
        {([['Da giornata', f, setFrom], ['Per quante', sp, setSpan]] as const).map(([lab, v, set]) => (
          <label key={lab} className="block w-[106px]">
            <span className="fl">{lab}</span>
            <input type="number" min={1} max={38} value={v} onChange={e => set(parseInt(e.target.value) || 1)}
              className="w-full rounded-[7px] border border-line-strong bg-surface px-2.5 py-1.5 text-sm" />
          </label>
        ))}
      </div>
      <div className="toggles">
        <label><input type="checkbox" checked={soloLiberi} onChange={e => setSoloLiberi(e.target.checked)} /> Solo svincolati</label>
        <label><input type="checkbox" checked={soloObiettivi} onChange={e => setSoloObiettivi(e.target.checked)} /> Solo obiettivi</label>
        <label><input type="checkbox" checked={soloMiei} onChange={e => setSoloMiei(e.target.checked)} /> Solo la mia rosa</label>
        <span className="hint">{righeVis.length > 400 ? `${righeVis.length} giocatori — mostrati i primi 400` : `${righeVis.length} giocatori`}</span>
      </div>

      <div className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
        <div className="max-h-[68vh] overflow-auto">
          <table className={`list${conVoti ? ' stats' : ''}`}>
            <thead><tr>
              {th('star', '★', 'w-[30px]')}{th('r', 'R', 'w-[38px]')}{th('n', 'Giocatore')}
              {th('q', 'Qt.A', 'num w-[70px]')}{th('f', 'FVM', 'num w-[70px]')}
              {th('att', 'Atteso', 'num w-[84px]', 'Quanto dovrebbe costare in questa lega')}
              {th('v', 'Convenienza', 'num w-[136px] col-secondaria')}{th('app', 'Appetibilità', 'num w-[112px]')}
              {th('fm', 'FM', 'num colfm w-[84px]')}{th('cal', 'Prossime partite', 'w-[216px] col-secondaria')}
              {th('max', 'Max mio', 'num w-[72px]')}
              <th>Stato</th>
            </tr></thead>
            <tbody>
              {righeVis.slice(0, 400).map(p => {
                const a = m.S.assign[p.id], t = obiettivi[p.id]
                const cs = m.calScore(p.s, p.r, f, sp), st = m.statFor(p.id)
                const base = m.attesa(p.id), ora = m.attesaOra(p.id)
                const d = ora !== null && base ? ora / base - 1 : 0
                const conv = p.v ?? 1
                return (
                  <tr key={p.id} className={`${a ? (a.team === me ? 'mine' : 'taken') : ''}${m.isOut(p.id) ? ' fuori' : ''}`}>
                    <td className="cella-filo">
                      <span className="fr-filo-ruolo" data-ruolo={p.r} aria-hidden="true" />
                      <button type="button" className={`starbtn${t ? ' on' : ''}`} title="Segna come obiettivo"
                        onClick={() => segna(p.id, t ? null : { max: p.q })}>{t ? '★' : '☆'}</button>
                    </td>
                    <td><span className="ruolo-lettera">{p.r}</span></td>
                    <td>
                      <div className="namewrap">
                        <button type="button" className="pname clic" onClick={() => setAperto(p.id)}>{p.n}</button>
                        <TitDot m={m} p={p} /><RigBadge m={m} p={p} /><OutBadge m={m} p={p} />
                      </div>
                      <div className="pteam">{p.s} <span className="rm">{p.rm || ''}</span> <MentChip m={m} p={p} /></div>
                    </td>
                    <td className="num fr-num">{p.q}</td>
                    <td className="num fr-num text-muted">{p.f}</td>
                    <td className="num">
                      {a ? <span className="text-line-strong">—</span>
                        : ora === null ? <span className="attv fr-num">{base}</span>
                          : <>
                            <span className="attv fr-num" style={{ color: Math.abs(d) < 0.1 ? 'inherit' : d > 0 ? 'var(--warn)' : 'var(--ok)' }}>{ora}</span>
                            {Math.abs(d) >= 0.1 && <div className="subline text-right">listino {base}</div>}
                          </>}
                    </td>
                    <td className="num col-secondaria">
                      <div className="meter">
                        <div className="bar"><span style={{
                          background: conv >= 1.15 ? 'var(--ok)' : conv <= 0.85 ? 'var(--crit)' : 'var(--muted)',
                          ...barra(conv),
                        }} /></div>
                        <span className={`n fr-num ${conv >= 1.15 ? 'v-hi' : conv <= 0.85 ? 'v-lo' : 'v-mid'}`}>{conv.toFixed(2)}</span>
                      </div>
                    </td>
                    <td className="num">
                      <div className="app">
                        <div className="abar"><span style={{ width: `${m.appet(p, f, sp)}%`, background: appetCol(m.appet(p, f, sp)) }} /></div>
                        <span className="an fr-num" style={{ color: appetCol(m.appet(p, f, sp)) }}>{m.appet(p, f, sp)}</span>
                      </div>
                    </td>
                    <td className="num colfm">
                      {st && st.pres
                        ? <><span className="fmv fr-num" style={{ color: fmCol(st.fm!) }}>{st.fm!.toFixed(2)}</span>
                          <div className="subline text-right">{st.pres}/{st.su} pres</div></>
                        : <span className="text-line-strong">—</span>}
                    </td>
                    <td className="col-secondaria">
                      {cs !== null && (
                        <div className="flex items-center gap-[7px]">
                          <FixStrip m={m} team={p.s} r={p.r} from={f} span={sp} />
                          <span className="calscore fr-num" style={{ color: scoreCol(cs) }}>{cs.toFixed(1)}</span>
                        </div>
                      )}
                    </td>
                    <td className="num">
                      <input className="tmax fr-num" type="number" min={0} placeholder="—" value={t?.max ?? ''}
                        onChange={e => segna(p.id, { max: parseInt(e.target.value) || 0 })} />
                    </td>
                    <td>
                      {a ? <span className="takenby" style={{ color: a.team === me ? 'var(--accent)' : 'var(--muted)' }}>{m.teamName(a.team)} · <span className="fr-num">{a.price}</span></span>
                        : <span className="tag ok">libero</span>}
                    </td>
                  </tr>
                )
              })}
              {!righeVis.length && <tr><td colSpan={12} className="empty">Nessun giocatore con questi filtri.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {aperto !== null && (
        <Scheda m={m} id={aperto} legaId={legaId} puoScrivere={puoScrivere} finestra={{ from: f, span: sp }}
          obiettivo={obiettivi[aperto]} onObiettivo={o => segna(aperto, o)}
          onChiudi={() => setAperto(null)} ricarica={ricarica} />
      )}
    </div>
  )
}

/* la barra della convenienza parte dal centro: a destra chi rende più di quanto costa */
function barra(v: number) {
  const d = Math.max(-1, Math.min(1, (v - 1) / 0.8)), w = Math.max(1.5, Math.abs(d) * 26)
  return d >= 0 ? { left: 26, width: w } : { left: 26 - w, width: w }
}
