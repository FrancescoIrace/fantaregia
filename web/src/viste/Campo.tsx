/* ══ Il campo in prospettiva ═════════════════════════════════════════
   Sul telefono la formazione si guarda com'è in campo: la propria porta
   in basso e larga, quella avversaria in alto e stretta. Da scrivania
   restano le caselle (CasellaCampo in Formazioni.tsx), che hanno lo
   spazio per frase, statistiche e «c'è di meglio».

   Una sola funzione, `proietta(u, t)`, porta ogni punto sul disegno:
   u è la posizione trasversale (0 fascia sinistra, 1 fascia destra), t la
   profondità (0 la propria linea di fondo, 1 quella avversaria). Ci
   passano righe, aree, cerchio di centrocampo e giocatori, così la
   prospettiva è la stessa per tutto. I dischi rimpiccioliscono salendo.

   Le posizioni sono NEUTRE: vengono dal modulo, non dai ruoli Mantra che
   il listone porta. Ogni reparto si allarga secondo quanti sono, e chi
   sta all'esterno della linea avanza di un passo rispetto ai centrali, in
   modo simmetrico.                                                     */
import type { KeyboardEvent } from 'react'
import { ROLES, type Motore } from '../domain/motore.ts'
import type { Formazione } from '../domain/formazione.ts'
import type { Giocatore, Ruolo } from '../domain/tipi.ts'
import { appetCol } from './colori.ts'
import { ALTO, CX, LARGO, posizioni, proietta, scala } from './prospettiva.ts'

/* ── il disegno ── */
const NOME_REPARTO: Record<Ruolo, string> = { P: 'porta', D: 'difesa', C: 'centrocampo', A: 'attacco' }

function quad(t1: number, t2: number, u1: number, u2: number) {
  return [proietta(u1, t1), proietta(u2, t1), proietta(u2, t2), proietta(u1, t2)].map(p => `${p.x},${p.y}`).join(' ')
}

function Erba() {
  const riga = { fill: 'none', stroke: 'var(--fr-erba-linea)', strokeWidth: 1.4 }
  const meta = proietta(0.5, 0.5)
  return (
    <g aria-hidden="true">
      {/* strisce di erba tagliata, alternate */}
      {Array.from({ length: 8 }, (_, i) => (
        <polygon key={i} points={quad(i / 8, (i + 1) / 8, 0, 1)} fill={i % 2 ? 'var(--fr-erba-2)' : 'var(--fr-erba)'} />
      ))}
      <polygon points={quad(0, 1, 0, 1)} {...riga} />
      <line x1={proietta(0, 0.5).x} y1={meta.y} x2={proietta(1, 0.5).x} y2={meta.y} {...riga} />
      {/* il cerchio di centrocampo, schiacciato come lo schiaccia la prospettiva */}
      <ellipse cx={meta.x} cy={meta.y} rx={46} ry={15} {...riga} />
      <polygon points={quad(0, 0.155, 0.20, 0.80)} {...riga} />
      <polygon points={quad(0, 0.055, 0.34, 0.66)} {...riga} />
      <polygon points={quad(0.845, 1, 0.20, 0.80)} {...riga} />
      <polygon points={quad(0.945, 1, 0.34, 0.66)} {...riga} />
      <polygon points={quad(-0.022, 0, 0.41, 0.59)} {...riga} fill="var(--fr-erba-linea)" fillOpacity={0.4} />
      <polygon points={quad(1, 1.02, 0.41, 0.59)} {...riga} fill="var(--fr-erba-linea)" fillOpacity={0.4} />
      <ellipse cx={CX} cy={proietta(0.5, 0.105).y} rx={2} ry={1.2} fill="var(--fr-erba-linea)" />
      <ellipse cx={CX} cy={proietta(0.5, 0.895).y} rx={1.6} ry={1} fill="var(--fr-erba-linea)" />
    </g>
  )
}

export interface CampoProps {
  m: Motore
  g: number
  L: Formazione
  giocatore: (id: number) => Giocatore | null
  sc: (p: Giocatore) => number
  fissi: number[]
  /** i disponibili dello stesso reparto fuori dall'undici: servono a dire «c'è di meglio» */
  alternative: (r: Ruolo) => Giocatore[]
  onApri: (r: Ruolo, i: number) => void
}

export default function Campo({ m, g, L, giocatore, sc, fissi, alternative, onApri }: CampoProps) {
  /* Dal fondo del campo verso la propria porta: i dischi vicini si
     disegnano per ultimi e stanno sopra quelli lontani. */
  const reparti = [...ROLES].reverse()
  return (
    <svg className="m-campo-svg" viewBox={`0 0 ${LARGO} ${ALTO}`} role="group" aria-label={`Il campo, modulo ${L.mod}`}>
      <Erba />
      {reparti.map(r => posizioni(r, L.start[r].length).map((pos, i) => {
        const id = L.start[r][i]
        const p = id ? giocatore(id) : null
        return <Disco key={`${r}${i}`} m={m} g={g} r={r} i={i} p={p} pos={pos} sc={sc}
          fisso={!!id && fissi.includes(id)} alternative={alternative(r)} onApri={onApri} />
      }))}
    </svg>
  )
}

function Disco({ m, g, r, i, p, pos, sc, fisso, alternative, onApri }: {
  m: Motore; g: number; r: Ruolo; i: number; p: Giocatore | null; pos: { u: number; t: number }
  sc: (p: Giocatore) => number; fisso: boolean; alternative: Giocatore[]; onApri: (r: Ruolo, i: number) => void
}) {
  const { x, y } = proietta(pos.u, pos.t), k = scala(pos.t), raggio = 15 * k
  const apri = () => onApri(r, i)
  const tasto = (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); apri() } }
  const ombra = <ellipse cx={x} cy={y + raggio * 0.9} rx={raggio * 0.82} ry={raggio * 0.3} fill="var(--fr-incasso)" fillOpacity={0.55} />

  if (!p) return (
    <g className="m-disco vuoto" role="button" tabIndex={0} aria-label={`Casella vuota in ${NOME_REPARTO[r]}: scegli chi schierare`}
      onClick={apri} onKeyDown={tasto}>
      {ombra}
      <circle cx={x} cy={y} r={raggio} fill="var(--fr-incasso)" fillOpacity={0.5} stroke="var(--fr-erba-linea)" strokeWidth={2} strokeDasharray="3 3" />
      <text x={x} y={y + 4.5 * k} fontSize={14 * k} className="m-disco-num" fill="var(--fr-ink)">+</text>
    </g>
  )

  const s = sc(p), ko = m.isOut(p.id)
  // la stessa regola della casella da scrivania: in panchina c'è chi fa più di quattro punti meglio
  const meglio = alternative.some(a => sc(a) > s + 4)
  const partita = m.fixtures(p.s, g, 1)[0]
  const dove = !partita ? 'riposa' : partita.home ? 'in casa' : 'fuori'
  const nome = p.n.length > 11 ? p.n.slice(0, 10) + '.' : p.n
  const etichetta = `${p.n}, ${NOME_REPARTO[r]}, punteggio ${ko ? 'nessuno, indisponibile' : s}, ${dove}`
    + (fisso ? ', titolare fisso' : '') + (meglio && !ko ? ', in panchina c\'è di meglio' : '')

  return (
    <g className={`m-disco${ko ? ' ko' : ''}`} role="button" tabIndex={0} aria-label={etichetta} onClick={apri} onKeyDown={tasto}>
      {ombra}
      {/* il bordo è il ruolo — un filo, come nelle righe — o il rosso di chi non può giocare */}
      <circle cx={x} cy={y} r={raggio} fill="var(--fr-pan)"
        stroke={ko ? 'var(--fr-giu)' : `var(--fr-ruolo-${r.toLowerCase()})`} strokeWidth={ko ? 3 : 2.2} />
      <text x={x} y={y + 4.6 * k} fontSize={14 * k} className="m-disco-num" fill={ko ? 'var(--fr-giu)' : appetCol(s)}>{ko ? '—' : s}</text>
      {/* fisso: il puntino in alto a destra, del marchio come la casella bloccata da scrivania */}
      {fisso && <circle cx={x + raggio * 0.78} cy={y - raggio * 0.78} r={3.4 * k} fill="var(--fr-marchio)" stroke="var(--fr-pan)" strokeWidth={1} />}
      {/* c'è di meglio: una freccia d'inchiostro in alto a sinistra, una forma e non un colore */}
      {meglio && !ko && (
        <g aria-hidden="true">
          <circle cx={x - raggio * 0.78} cy={y - raggio * 0.78} r={5 * k} fill="var(--fr-ink)" />
          <text x={x - raggio * 0.78} y={y - raggio * 0.78 + 2.6 * k} fontSize={7.5 * k} className="m-disco-num" fill="var(--fr-pan)">↑</text>
        </g>
      )}
      <text x={x} y={y + raggio + 11 * k} fontSize={10.5 * k} className="m-disco-nome">{nome}</text>
      <text x={x} y={y + raggio + 20 * k} fontSize={8.5 * k} className="m-disco-dove">{dove}</text>
    </g>
  )
}
