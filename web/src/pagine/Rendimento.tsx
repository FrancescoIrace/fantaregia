import { useState } from 'react'
import type { Motore, VoceSerie } from '../domain/motore.ts'
import type { Ruolo } from '../domain/tipi.ts'
import { deltaCol, fmCol } from '../viste/colori.ts'
import { RigBadge } from '../viste/segni.tsx'
import { Card, Ruolo as ChipRuolo } from '../ui.tsx'

type Chiave = 'pres' | 'mv' | 'fm' | 'gf' | 'ass' | 'forma' | 'q'

/* ══ Rendimento ══════════════════════════════════════════════════════
   renderRendimento() dell'app a file singolo: presenze, medie, gol e
   assist dalle giornate caricate, le ultime dieci in piccolo, la forma. */
export default function Rendimento({ motore: m }: { motore: Motore }) {
  const [ruolo, setRuolo] = useState<Ruolo | ''>('')
  const [q, setQ] = useState('')
  const [soloMiei, setSoloMiei] = useState(false)
  const [ordine, setOrdine] = useState<{ k: Chiave; dir: 1 | -1 }>({ k: 'fm', dir: -1 })

  const gs = m.giornateGiocate()
  if (!gs.length) return (
    <Card><div className="empty">Nessuna giornata caricata.<br />Carica i voti da <b>Carica dati</b> in Panoramica: qui compariranno
      presenze, medie, gol e assist.</div></Card>
  )

  const cerca = q.trim().toLowerCase(), me = m.meId()
  const righe = m.PL.map(p => ({ p, st: m.statFor(p.id) })).filter(x => {
    if (!x.st || !x.st.pres) return false
    if (ruolo && x.p.r !== ruolo) return false
    if (cerca && !(x.p.n.toLowerCase().includes(cerca) || x.p.s.toLowerCase().includes(cerca))) return false
    if (soloMiei) { const a = m.S.assign[x.p.id]; if (!a || a.team !== me) return false }
    return true
  }).map(x => ({ ...x, st: x.st! }))
  const valore = (x: typeof righe[number]) => ({
    fm: x.st.fm, mv: x.st.mv || 0, pres: x.st.pres, gf: x.st.gf, ass: x.st.ass, q: x.p.q, forma: m.formaOf(x.p.id)?.delta || 0,
  })[ordine.k]
  righe.sort((a, b) => ordine.dir * ((valore(a) || 0) - (valore(b) || 0)) || a.p.n.localeCompare(b.p.n))
  const ordinaPer = (k: Chiave) => setOrdine(o => o.k === k ? { k, dir: o.dir === 1 ? -1 : 1 } : { k, dir: -1 })
  const th = (k: Chiave, lab: string) => (
    <th key={k} className="num cursor-pointer select-none" onClick={() => ordinaPer(k)}>
      {lab}{ordine.k === k && <span className="ar"> {ordine.dir > 0 ? '▲' : '▼'}</span>}
    </th>
  )

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <span className="mb-1 block text-[11px] font-semibold tracking-wider text-muted uppercase">Ruolo</span>
          <div className="roleseg">
            {(['', 'P', 'D', 'C', 'A'] as const).map(r => (
              <button key={r} type="button" aria-pressed={ruolo === r} onClick={() => setRuolo(r)}>{r || 'Tutti'}</button>
            ))}
          </div>
        </div>
        <label className="block min-w-[200px] flex-1">
          <span className="mb-1 block text-[11px] font-semibold tracking-wider text-muted uppercase">Cerca</span>
          <input type="text" value={q} onChange={e => setQ(e.target.value)} placeholder="Nome o squadra…" autoComplete="off"
            className="w-full rounded-[7px] border border-line-strong bg-surface px-2.5 py-1.5 text-sm" />
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" checked={soloMiei} onChange={e => setSoloMiei(e.target.checked)} /> Solo la mia rosa</label>
        <span className="hint pb-2">{righe.length} giocatori · giornate {gs.join(', ')}{m.S.votiMeta?.sheet ? ` · voti ${m.S.votiMeta.sheet}` : ''}</span>
      </div>

      <div className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
        <div className="max-h-[68vh] overflow-auto">
          <table className="list">
            <thead><tr>
              <th className="w-[38px]">R</th><th>Giocatore</th>
              {th('pres', 'Pres.')}{th('mv', 'Media voto')}{th('fm', 'Fantamedia')}
              {th('gf', 'Gol')}{th('ass', 'Assist')}
              <th className="w-[74px]">Ultime</th>{th('forma', 'Forma')}{th('q', 'Qt.A')}
            </tr></thead>
            <tbody>
              {righe.slice(0, 400).map(({ p, st }) => {
                const f = m.formaOf(p.id)
                return (
                  <tr key={p.id}>
                    <td><ChipRuolo r={p.r} /></td>
                    <td>
                      <div className="namewrap"><span className="pname">{p.n}</span><RigBadge m={m} p={p} /></div>
                      <div className="pteam">{p.s}{st.sv ? <span className="subline"> {st.sv} s.v.</span> : null}
                        {st.amm || st.esp ? <span className="subline"> {st.amm ? `${st.amm}×⚠` : ''}{st.esp ? ` ${st.esp}×⛔` : ''}</span> : null}</div>
                    </td>
                    <td className="num">{st.pres}<span className="text-muted">/{st.su}</span></td>
                    <td className="num">{st.mv === null || st.mv === undefined ? '—' : st.mv.toFixed(2)}</td>
                    <td className="num"><span className="fmv" style={{ color: fmCol(st.fm!) }}>{st.fm!.toFixed(2)}</span></td>
                    <td className="num">{st.gf || '—'}</td>
                    <td className="num">{st.ass || '—'}</td>
                    <td><Spark serie={st.serie} /></td>
                    <td className="num">{f ? <span className="delta" style={{ color: deltaCol(f.delta) }}>{f.delta >= 0 ? '+' : ''}{f.delta.toFixed(1)}</span> : '—'}</td>
                    <td className="num text-muted">{p.q}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="hint max-w-[76ch]">La <b>fantamedia</b> applica gol +3, assist +1, rigore parato +3, rigore sbagliato −3, autogol −2,
        ammonizione −0,5, espulsione −1, gol subito −1. I voti con asterisco valgono 6 e contano come presenza, ma restano fuori dalla media
        voto. La <b>forma</b> confronta la fantamedia delle ultime tre presenze con quella di tutta la stagione: sopra zero sta rendendo più
        del suo standard.</p>
    </div>
  )
}

/* le ultime dieci giornate in piccolo: alta verde sopra il 7, rossa sotto il 5 */
function Spark({ serie }: { serie: (VoceSerie | null)[] }) {
  const vals = serie.filter((x): x is VoceSerie => !!x).map(x => x.fv)
  if (!vals.length) return null
  const lo = Math.min(4, ...vals), hi = Math.max(10, ...vals)
  return (
    <div className="spark">
      {serie.slice(-10).map((x, i) => x
        ? <i key={i} className={x.fv >= 7 ? 'up' : x.fv <= 5 ? 'dn' : ''} style={{ height: Math.max(3, Math.round((x.fv - lo) / ((hi - lo) || 1) * 20)) }}
          title={`Giornata ${x.g}: voto ${x.v.toFixed(1)}${x.sv ? ' (s.v.)' : ''}, fantavoto ${x.fv.toFixed(1)}`} />
        : <i key={i} className="no" title="non ha giocato" />)}
    </div>
  )
}
