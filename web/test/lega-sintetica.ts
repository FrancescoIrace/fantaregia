/* Una lega di prova completa, generata con un seme fisso sui giocatori
   INVENTATI di esempi/: asta, dieci giornate di voti coerenti col
   calendario, rigoristi, stagione scorsa, infermeria, calendario di lega
   con risultati. Nessun dato reale. */
import { ROLES } from '../src/domain/motore.ts'
import type { calendarioDaRighe } from '../src/domain/importa.ts'
import type { CalendarioLega, GiocatoreGrezzo, Movimento, Rigoristi, Ruolo, StatoLega, Storico, VotoRiga } from '../src/domain/tipi.ts'

export function mulberry32(a: number) {
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0
    let t = Math.imul(a ^ a >>> 15, 1 | a)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

export function costruisciLega(players: GiocatoreGrezzo[], cal: ReturnType<typeof calendarioDaRighe>) {
  const rnd = mulberry32(2627)
  const per = (s: string, r: Ruolo) => players.filter(p => p[4] === s && p[1] === r).sort((a, b) => b[5] - a[5])

  /* rigoristi: il primo attaccante di ogni squadra, il secondo per metà di loro */
  const rig: Rigoristi = {}
  cal.teams.forEach((t, i) => {
    const att = per(t, 'A')
    if (att[0]) rig[att[0][0]] = [1, rnd() < 0.7 ? 1 : 0]
    if (att[1] && i % 2) rig[att[1][0]] = [2, 1]
  })

  /* stagione scorsa per circa due giocatori su tre */
  const hist: Storico = {}
  for (const p of players) {
    if (rnd() > 0.65) continue
    const pv = Math.floor(rnd() * 38), mv = Math.round((5.5 + rnd() * 1.3) * 100) / 100
    const fm = Math.round((mv + (p[1] === 'A' ? rnd() * 1.5 : rnd() * 0.6)) * 100) / 100
    const n = (k: number) => Math.floor(rnd() * k)
    hist[p[0]] = [pv, mv, fm, n(p[1] === 'A' ? 18 : 5), p[1] === 'P' ? n(50) : 0, p[1] === 'P' ? n(3) : 0, n(3), n(3), n(2), n(8), n(9), n(2), n(2), p[4]]
  }

  /* l'asta: dieci squadre, rose piene al 70% circa */
  const teams = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, name: `Squadra ${i + 1}` }))
  const slots = { P: 3, D: 8, C: 8, A: 6 }
  const assign: StatoLega['assign'] = {}
  const spesa = new Map<number, number>(teams.map(t => [t.id, 0]))
  const presi = new Map<number, number>(teams.map(t => [t.id, 0]))
  for (const r of ROLES) {
    const liberi = players.filter(p => p[1] === r).sort((a, b) => b[5] - a[5])
    let k = 0
    for (let giro = 0; giro < Math.round(slots[r] * 0.7); giro++) for (const t of teams) {
      while (k < liberi.length && rnd() < 0.25) k++                  // qualcuno resta libero
      const p = liberi[k++]; if (!p) continue
      const restano = 25 - presi.get(t.id)! - 1
      let price = Math.max(1, Math.round(p[5] * (0.6 + rnd() * 1.2)))
      if (spesa.get(t.id)! + price > 500 - restano) price = 1
      assign[p[0]] = { team: t.id, price, snap: { id: p[0], r: p[1], n: p[3], s: p[4], q: p[5] } }
      spesa.set(t.id, spesa.get(t.id)! + price); presi.set(t.id, presi.get(t.id)! + 1)
    }
  }
  // uno che è in rosa ma non è più nel listone: vive solo della sua fotografia
  assign[999999] = { team: 2, price: 14, snap: { id: 999999, r: 'C', n: 'Fantasma X.', s: cal.teams[0], q: 12 } }

  /* dieci giornate di voti, coerenti col calendario: gol, assist, autogol,
     portieri che subiscono, cartellini (con qualche «cattivo» che arriva
     alla squalifica), spezzoni senza voto */
  const cattivi = new Set(players.filter(() => rnd() < 0.04).map(p => p[0]))
  const stats: StatoLega['stats'] = {}
  for (let g = 1; g <= 10; g++) {
    const V: Record<string, VotoRiga> = {}
    cal.teams.forEach((casa, i) => {
      const c = cal.fix[i][g - 1]; if (!(c > 0)) return
      const osp = cal.teams[c - 1]
      const gol = [Math.floor(rnd() * rnd() * 5), Math.floor(rnd() * rnd() * 4)]
      const undici = (s: string) => [...per(s, 'P').slice(0, 1), ...per(s, 'D').slice(0, 4), ...per(s, 'C').slice(0, 4), ...per(s, 'A').slice(0, 2)]
        .filter(() => rnd() > 0.08)
      const xi = [undici(casa), undici(osp)]
      xi.forEach((l, lato) => {
        for (const p of l) {
          const amm = rnd() < (cattivi.has(p[0]) ? 0.6 : 0.1) ? 1 : 0
          const esp = rnd() < 0.02 ? 1 : 0
          V[p[0]] = [5 + 0.5 * Math.floor(rnd() * 6), 0, 0, p[1] === 'P' ? gol[1 - lato] : 0, 0, 0, 0, amm, esp, 0]
        }
        // spezzoni senza voto dalla panchina
        for (const p of [...per(lato ? osp : casa, 'C').slice(4, 6), ...per(lato ? osp : casa, 'A').slice(2, 3)])
          if (rnd() < 0.5) V[p[0]] = [6, 1, 0, 0, 0, 0, 0, 0, 0, 0]
      })
      gol.forEach((n, lato) => {
        const miei = xi[lato].filter(p => p[1] !== 'P'), loro = xi[1 - lato].filter(p => p[1] === 'D')
        for (let k = 0; k < n; k++) {
          if (rnd() < 0.1 && loro.length) { V[loro[Math.floor(rnd() * loro.length)][0]][6]++; continue }
          const pesati = miei.flatMap(p => p[1] === 'A' ? [p, p, p] : p[1] === 'C' ? [p, p] : [p])
          if (!pesati.length) continue
          V[pesati[Math.floor(rnd() * pesati.length)][0]][2]++
          const altri = miei.filter(() => rnd() < 0.3)
          if (altri.length) V[altri[0][0]][9]++
        }
      })
      if (rnd() < 0.08) { const pc = per(casa, 'P')[0]; if (pc && V[pc[0]]) V[pc[0]][4] = 1 }
      if (rnd() < 0.05) { const a = per(osp, 'A')[0]; if (a && V[a[0]]) V[a[0]][5] = 1 }
    })
    stats[g] = V
  }

  /* infermeria: il vecchio 1, un infortunio che poi rigioca, uno recente */
  const ids = Object.keys(assign).map(Number).filter(id => id !== 999999)
  const out: StatoLega['out'] = { [ids[5]]: 1, [ids[17]]: { motivo: 'infortunio', da: 4, ts: 0 }, [ids[40]]: { motivo: 'infortunio', da: 11, ts: 0 } }

  /* calendario di lega: dieci squadre, girone all'italiana andata e ritorno,
     risultati per le prime quattro (una partita senza gol, solo fantapunti) */
  const N = 10, giri: [number, number][][] = []
  const ruota = Array.from({ length: N }, (_, i) => i)
  for (let r = 0; r < N - 1; r++) {
    const g: [number, number][] = []
    for (let i = 0; i < N / 2; i++) g.push(r % 2 ? [ruota[N - 1 - i], ruota[i]] : [ruota[i], ruota[N - 1 - i]])
    giri.push(g)
    ruota.splice(1, 0, ruota.pop()!)
  }
  const gior = [...giri, ...giri.map(g => g.map(([a, b]) => [b, a] as [number, number]))]
  const golDa = (pt: number) => pt < 66 ? 0 : Math.floor((pt - 66) / 6) + 1
  const ris = gior.slice(0, 4).map((g, gi) => g.map((_, k) => {
    const pa = Math.round((60 + rnd() * 20) * 2) / 2, pb = Math.round((60 + rnd() * 20) * 2) / 2
    return gi === 2 && k === 0 ? { pa, pb, ga: null, gb: null } : { pa, pb, ga: golDa(pa), gb: golDa(pb) }
  }))
  const lega: CalendarioLega = { nome: 'Lega di prova', teams: Array.from({ length: N }, (_, i) => `Fanta ${String.fromCharCode(65 + i)}`), off: 2, gior, ris }
  const ordine = [4, 0, 7, 2, 9, 1, 5, 8, 3]                          // la squadra 10 resta senza abbinamento
  const legaMap = Object.fromEntries(ordine.map((idx, i) => [String(i + 1), idx]))

  const shared: Partial<StatoLega> = {
    teams, budget: 500, slots, plan: { P: 7, D: 19, C: 32, A: 42 },
    assign, log: [], rev: 1, stats, votiMeta: {}, out, lega, legaMap, squalSalta: {},
  }
  return { rig, hist, shared }
}

/* La stessa lega, con quello che l'app scrive nel corso della stagione: il
   registro delle chiamate, uno scambio e uno svincolo nella forma esatta di
   registraScambio()/registraSvincolo(), una squalifica annullata a mano. */
export function completa(shared: Partial<StatoLega>, players: GiocatoreGrezzo[]): Partial<StatoLega> {
  const S = structuredClone(shared) as StatoLega
  const ids = Object.keys(S.assign).map(Number).filter(id => id !== 999999)
  S.log = ids.slice(0, 30).map((pid, i) => ({ pid, team: S.assign[pid].team, price: S.assign[pid].price, t: 1787000000000 + (30 - i) * 60000 }))
  const snap = (pid: number) => S.assign[pid].snap!
  const di = (tid: number, r: Ruolo) => ids.filter(pid => S.assign[pid]?.team === tid && snap(pid).r === r)

  const [a] = di(1, 'D'), [, b] = di(6, 'D')
  const pa = S.assign[a].price, pb = S.assign[b].price
  const scambio: Movimento = { id: 1787100000000, g: 6, tipo: 'scambio', ts: 1787100000000,
    voci: [{ pid: a, da: 1, a: 6, prezzo: pa, snap: snap(a) }, { pid: b, da: 6, a: 1, prezzo: pb, snap: snap(b) }],
    agg: { 1: pb - pa, 6: pa - pb } }
  S.assign[a].team = 6; S.assign[b].team = 1

  const [f] = di(4, 'C')
  const d = players.find(p => p[1] === 'C' && !S.assign[p[0]])!
  const pf = S.assign[f].price, snapD = { id: d[0], r: d[1], n: d[3], s: d[4], q: d[5] }
  const svincolo: Movimento = { id: 1787200000000, g: 8, tipo: 'svincolo', ts: 1787200000000,
    voci: [{ pid: f, da: 4, a: null, prezzo: pf, snap: snap(f) }, { pid: d[0], da: null, a: 4, prezzo: 7, snap: snapD }],
    rimborso: 10, costo: 7, agg: { 4: 10 - pf } }
  delete S.assign[f]
  S.assign[d[0]] = { team: 4, price: 7, snap: snapD }

  S.moves = [scambio, svincolo]
  S.squalSalta = { [`${ids[3]}-7`]: 1 }
  return S
}
