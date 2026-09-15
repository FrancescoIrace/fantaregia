/* I piccoli segni che l'app a file singolo mette accanto ai nomi:
   titolarità, rigorista, indisponibile, la striscia delle partite. */
import { MENTNAME, type Motore, type VoceSerie } from '../domain/motore.ts'
import type { Giocatore, Ruolo } from '../domain/tipi.ts'
import { ABBR } from './colori.ts'
import { scriviDelta, verso } from './delta.ts'

export function TitDot({ m, p }: { m: Motore; p: Giocatore }) {
  const t = m.titStato(p)
  return <span className={`tdot t${t.liv}${t.dati ? ' reale' : ''}`} title={t.nota} />
}

export function RigBadge({ m, p }: { m: Motore; p: Giocatore }) {
  const e = m.rigOf(p)
  if (!e) return null
  const [rank, both] = e
  return (
    <span className={`rig${rank === 1 ? ' first' : ''}${both ? '' : ' soft'}`}
      title={`${rank}º rigorista${both ? ', confermato da entrambe le fonti' : ', indicato da una sola fonte'}`}>
      R{rank > 1 ? rank : ''}
    </span>
  )
}

export function OutBadge({ m, p }: { m: Motore; p: Giocatore }) {
  if (!m.isOut(p.id)) return null
  const sq = m.squalificatoA(p.id, m.nextG())
  return <span className={`outb${sq ? ' squal' : ''}`} title={sq ? 'Squalificato per la prossima giornata' : 'Segnato indisponibile'}>{sq ? 'SQU' : 'OUT'}</span>
}

/** le ultime dieci giornate in piccolo: alta verde sopra il 7, rossa sotto il 5 */
export function Spark({ serie }: { serie: (VoceSerie | null)[] }) {
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

/** mentalità: una parola al posto delle sigle Mantra, misurata dentro il ruolo */
export function MentChip({ m, p }: { m: Motore; p: Giocatore }) {
  const l = m.mentLabel(p)
  if (!l) return null
  const codici = (p.rm || '').split(';').map(x => x.trim()).filter(x => x in MENTNAME).map(x => MENTNAME[x])
  return <span className={`ment ${l.k}`} title={codici.join(', ') || l.t}>{l.t}</span>
}

/** le prossime partite: colore = difficoltà 1…5, minuscolo = in trasferta */
export function FixStrip({ m, team, r, from, span }: { m: Motore; team: string; r: Ruolo; from: number; span: number }) {
  const off = m.isOff(r)
  return (
    <span className="fixstrip">
      {m.fixtures(team, from, span).map(f => (
        <span key={f.g} className={`fix d${Math.round(m.fixDiff(f.opp, off, f.home))}${f.home ? '' : ' away'}`}
          title={`Giornata ${f.g} — ${f.home ? 'in casa contro' : 'in trasferta a'} ${f.opp}`}>{ABBR(f.opp)}</span>
      ))}
    </span>
  )
}

/** La variazione accanto al valore, sempre con il verso. Senza un confronto
    non scrive niente ma tiene lo spazio, così le colonne non ballano. */
export function Delta({ ora, prima, soglia = 3, decimali = 0, titolo = 'rispetto alla giornata prima' }: {
  ora: number; prima: number | null | undefined; soglia?: number; decimali?: number; titolo?: string
}) {
  if (prima === null || prima === undefined) return <span className="fr-delta" aria-hidden="true" />
  const d = ora - prima, testo = scriviDelta(d, decimali)
  return <span className="fr-delta" data-verso={verso(d, soglia)} title={`${testo} ${titolo}`}>{testo}</span>
}
