/* I piccoli segni che l'app a file singolo mette accanto ai nomi:
   titolarità, rigorista, indisponibile, la striscia delle partite. */
import { MENTNAME, type Motore } from '../domain/motore.ts'
import type { Giocatore, Ruolo } from '../domain/tipi.ts'
import { ABBR } from './colori.ts'

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
