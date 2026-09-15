/* ══ Testa a testa ═══════════════════════════════════════════════════
   Due rose della lega e una giornata di serie A, affiancate. Per tutte e
   due la formazione che consiglierebbe il modello, interrogato com'era
   prima della giornata: non le formazioni vere degli altri, che restano
   private (scelta (b) di Francesco, 15/09/2026). Se la giornata ha i voti i
   fantapunti sono veri, con la regola dei cambi di previsione.ts; se no
   sono attesi, come il punteggio atteso della scheda Lega.            */
import { useState } from 'react'
import { ROLES, type Motore } from '../domain/motore.ts'
import { formazioneModello, puntiFormazione } from '../domain/previsione.ts'
import type { Giocatore } from '../domain/tipi.ts'
import { Delta } from '../viste/segni.tsx'

const CAMPO = 'w-full rounded-[7px] border border-line-strong bg-surface px-2.5 py-1.5 text-sm'
const ETICHETTA = 'mb-1 block text-[11px] font-semibold tracking-wider text-muted uppercase'

export default function TestaATesta({ m, motorePrima, a, b, ga }: {
  m: Motore; motorePrima: (g: number) => Motore; a?: number | null; b?: number | null; ga?: number
}) {
  const squadre = m.S.teams
  const primaA = a ?? squadre[0]?.id ?? 0
  const [sa, setSa] = useState(primaA)
  const [sb, setSb] = useState(b ?? squadre.find(t => t.id !== primaA)?.id ?? primaA)
  const [g, setG] = useState(Math.max(1, Math.min(38, ga ?? m.giornataOggi())))
  if (squadre.length < 2) return <p className="hint">Per un testa a testa servono almeno due squadre.</p>

  const mp = motorePrima(g)
  const giocata = !!m.S.stats[g]
  const voto = (id: number) => { const v = m.S.stats[g]?.[id]; return v ? m.fvOf(v) : null }
  const ruoloDi = (id: number) => m.giocatoreDi(id)?.r
  const lato = (tid: number) => {
    const R = mp.rosterAt(tid, g)
    const rosa = ROLES.flatMap(r => R[r].map(x => x.p))
    const F = formazioneModello(rosa, { punteggio: p => mp.dayScore(p, g), indisponibile: id => mp.isOut(id) })
    const xi = ROLES.flatMap(r => F.start[r]).filter((x): x is number => !!x)
      .map(id => mp.giocatoreDi(id)).filter((p): p is Giocatore => !!p)
    const totale = giocata
      ? puntiFormazione(F, voto, ruoloDi).totale
      : xi.reduce((t, p) => { const x = mp.attesoGiocatore(p, g); return t + (x ? x.fv * Math.max(0.15, x.gioca) : 0) }, 0)
    return { tid, F, xi, totale }
  }
  const lati = [lato(sa), lato(sb)]
  const numero = (p: Giocatore) => {
    if (!giocata) return String(mp.dayScore(p, g))
    const v = voto(p.id)
    return v === null ? 's.v.' : v.toFixed(1)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block w-[190px]">
          <span className={ETICHETTA}>Prima rosa</span>
          <select value={sa} onChange={e => setSa(Number(e.target.value))} className={CAMPO}>
            {squadre.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        <label className="block w-[190px]">
          <span className={ETICHETTA}>Seconda rosa</span>
          <select value={sb} onChange={e => setSb(Number(e.target.value))} className={CAMPO}>
            {squadre.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        <label className="block w-[120px]">
          <span className={ETICHETTA}>Giornata</span>
          <input type="number" min={1} max={38} value={g} className={CAMPO}
            onChange={e => setG(Math.max(1, Math.min(38, parseInt(e.target.value) || 1)))} />
        </label>
        <span className="hint ml-auto text-right">
          {giocata ? 'giornata con i voti: fantapunti veri, con i cambi dalla panchina' : 'giornata senza voti: fantapunti attesi'}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {lati.map((L, i) => (
          <div key={i} className="min-w-0">
            <div className="flex items-baseline gap-2">
              <b className="truncate">{m.teamName(L.tid)}</b>
              <span className="hint">{L.F.mod}</span>
              <span className="fr-num tat-totale ml-auto">{L.totale.toFixed(1)}</span>
              {i === 1 && <Delta ora={L.totale} prima={lati[0].totale} soglia={1} decimali={1} titolo={`rispetto a ${m.teamName(lati[0].tid)}`} />}
            </div>
            <ul className="tat-xi">
              {L.xi.map(p => (
                <li key={p.id}>
                  <span className="fr-filo-ruolo" data-ruolo={p.r} aria-hidden="true" />
                  <span className="ruolo-lettera">{p.r}</span>
                  <span className="min-w-0 truncate">{p.n}</span>
                  <span className="pteam">{p.s}</span>
                  <span className="fr-num ml-auto">{numero(p)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="hint max-w-[80ch]">
        Sono le formazioni che il modello consiglierebbe a tutte e due, calcolate com'era prima della giornata: non quelle vere, che
        restano private. {giocata ? 'Accanto a ogni nome c\'è il fantavoto.' : 'Accanto a ogni nome c\'è il punteggio di giornata.'}
      </p>
    </div>
  )
}
