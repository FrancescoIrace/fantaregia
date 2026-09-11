/* ══ Il port dà gli stessi numeri dell'originale? ═════════════════════
   Stessi dati in ingresso ai due motori — l'app a file singolo in jsdom e
   src/domain/motore.ts — e confronto di tutto quello che il motore sa dire:
   prezzi, indici, giudizi, previsioni, infermeria, formazioni, confronto
   con le rose ufficiali. Il confronto è esatto, non a tolleranza: il port
   fa le stesse operazioni nello stesso ordine.

   I dati sono il listone e il calendario INVENTATI di esempi/, più una lega
   sintetica generata qui con un generatore deterministico. Nessun dato
   reale: questo test può stare nel repo pubblico.                       */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { avviaLegacy, type Legacy } from './legacy.ts'
import { creaMotore, parseRoseLega, ROLES, type Motore } from '../src/domain/motore.ts'
import { calendarioDaRighe, parseCSV, righeInGiocatori } from '../src/domain/importa.ts'
import type { CalendarioLega, GiocatoreGrezzo, Rigoristi, Ruolo, StatoLega, Storico, VotoRiga } from '../src/domain/tipi.ts'

const ESEMPI = fileURLToPath(new URL('../../esempi/', import.meta.url))
const FIN = { from: 3, span: 5 }
const ME = { myTeam: 3, targets: {} }

/* ── generatore deterministico: stesso seme, stessa lega ── */
function mulberry32(a: number) {
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0
    let t = Math.imul(a ^ a >>> 15, 1 | a)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

function costruisciLega(players: GiocatoreGrezzo[], cal: ReturnType<typeof calendarioDaRighe>) {
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

/* ── confronto: i giocatori diventano il loro id, Map e Infinity si leggono ── */
function norm(x: unknown): unknown {
  return JSON.parse(JSON.stringify(x, (_k, v) => {
    if (v && typeof v === 'object' && !Array.isArray(v) && typeof v.id === 'number' && typeof v.n === 'string' && typeof v.r === 'string') return '#' + v.id
    if (v instanceof Map) return Object.fromEntries(v)
    if (v instanceof Set) return [...v]
    if (typeof v === 'number' && !Number.isFinite(v)) return String(v)
    return v
  }))
}
const uguale = (ts: unknown, old: unknown) => expect(norm(ts)).toEqual(norm(old))

let L: Awaited<ReturnType<typeof avviaLegacy>>
let fa: Legacy
let m: Motore
let players: GiocatoreGrezzo[]

beforeAll(async () => {
  players = righeInGiocatori(parseCSV(readFileSync(ESEMPI + 'listone-esempio.csv', 'utf8')))
  const cal = calendarioDaRighe(parseCSV(readFileSync(ESEMPI + 'calendario-esempio.csv', 'utf8')))
  const { rig, hist, shared } = costruisciLega(players, cal)
  L = await avviaLegacy({ players, cal, rig, hist, shared, me: ME })
  fa = L.fa

  /* uno scambio e uno svincolo, registrati dall'app originale: così i
     movimenti hanno esattamente la forma che l'app scrive davvero */
  const S0 = fa.S
  const perRuolo = (tid: number, r: Ruolo) => Object.keys(S0.assign).map(Number)
    .filter(pid => S0.assign[pid].team === tid && fa.giocatoreDi(pid)?.r === r && pid !== 999999)
  fa.registraScambio(perRuolo(1, 'D')[0], perRuolo(6, 'D')[1], 6)
  const libero = fa.PL.find((p: { id: number; r: string }) => p.r === 'C' && !S0.assign[p.id])
  fa.registraSvincolo(4, perRuolo(4, 'C')[0], libero.id, 10, 7, 8)
  fa.persist()
  L.finestra(FIN.from, FIN.span)

  const stato = JSON.parse(JSON.stringify(fa.S)) as StatoLega
  m = creaMotore({ players, cal, rig, hist, stato, me: ME, finestra: FIN })
})
afterAll(() => L?.chiudi())

const vecchio = (id: number) => fa.PL.find((p: { id: number }) => p.id === id)

describe('il motore portato dà gli stessi numeri dell\'app a file singolo', () => {
  it("l'app originale si avvia senza errori", () => {
    expect(L.errori).toEqual([])
    expect(fa.PL.length).toBe(players.length)
    expect(Object.keys(fa.S.assign).length).toBeGreaterThan(150)
    expect(fa.moves().length).toBe(2)
  })

  it('derivate del listone: convenienza, titolarità, mentalità, valore', () => {
    for (const p of m.PL) {
      const o = vecchio(p.id)
      uguale([p.v, p.rank, p.tit, p.off, p.mn, p.val], [o.v, o.rank, o.tit, o.off, o.mn, o.val])
    }
  })

  it('prezzi: listino, prezzo di adesso, mercato, affare/salasso', () => {
    for (const p of m.PL) uguale([m.attesa(p.id), m.attesaOra(p.id), m.fasciaPrezzo(p.id)], [fa.attesa(p.id), fa.attesaOra(p.id), fa.fasciaPrezzo(p.id)])
    uguale(m.mercato(), fa.mercato())
    for (const pid in m.S.assign) {
      const e = m.esitoPrezzo(+pid, m.S.assign[pid].price), tag: string = fa.dealTag(+pid, m.S.assign[pid].price)
      expect(e?.tipo ?? '').toBe(tag.includes('affare') ? 'affare' : tag.includes('salasso') ? 'salasso' : '')
    }
    uguale(m.mediaLega(), fa.mediaLega())
  })

  it('titolarità, appetibilità, rendimento, stagione scorsa', () => {
    for (const p of m.PL) {
      const o = vecchio(p.id)
      uguale(
        [m.titW(p), m.titStato(p), m.titFatti(p.id), m.appet(p, FIN.from, FIN.span), m.appetParts(p, FIN.from, FIN.span),
          m.statFor(p.id), m.formaOf(p.id, 3), m.annoScorso(p.id), m.rangoFm(p), m.mentLabel(p), m.isOut(p.id)],
        [fa.titW(o), fa.titStato(o), fa.titFatti(p.id), fa.appet(o, FIN.from, FIN.span), fa.appetParts(o, FIN.from, FIN.span),
          fa.statFor(p.id), fa.formaOf(p.id, 3), fa.annoScorso(p.id), fa.rangoFm(o), fa.mentLabel(o), fa.isOut(p.id)])
    }
    uguale(m.medieRuolo(), fa.medieRuolo())
  })

  it('forze delle squadre e calendario', () => {
    uguale(m.forze(), fa.forze())
    uguale(m.golDaiVoti(), fa.golDaiVoti())
    for (const t of m.CAL.teams) for (const r of ROLES) for (const from of [1, 4, 11])
      uguale(m.calScore(t, r, from, 5), fa.calScore(t, r, from, 5))
    uguale([m.giornataOggi(), m.legaOggi(), m.nextG(), m.pesoRisultati()], [fa.giornataOggi(), fa.legaOggi(), fa.nextG(), fa.pesoRisultati()])
    uguale(m.risultati(), fa.risultati())
    uguale(m.classificaSerieA(), fa.classificaSerieA())
  })

  it('scarsità e alternative', () => {
    uguale(m.scarsita(), fa.scarsita())
    for (const p of m.PL.filter((_, i) => i % 25 === 0)) uguale(m.alternative(p), fa.alternative(vecchio(p.id)))
  })

  it('rose, crediti, movimenti, giudizi', () => {
    for (const t of m.S.teams) {
      uguale([m.stats(t.id), m.aggCrediti(t.id), m.moviDi(t.id)], [fa.stats(t.id), fa.aggCrediti(t.id), fa.moves().filter((x: { voci: { da: number; a: number }[] }) => x.voci.some(v => v.da === t.id || v.a === t.id)).slice().reverse()])
      for (const g of [1, 6, 7, 12]) uguale(m.rosterAt(t.id, g), fa.rosterAt(t.id, g))
      uguale(m.undiciTipo(t.id), fa.undiciTipo(t.id))
      uguale(m.giudizio(t.id), fa.giudizio(t.id))
    }
    uguale(m.giudizi(), fa.giudizi())
    const ids = Object.keys(m.S.assign).map(Number)
    for (let i = 0; i + 1 < ids.length; i += 37) {
      uguale(m.verificaScambio(ids[i], ids[i + 1]), fa.verificaScambio(ids[i], ids[i + 1]))
      uguale(m.verificaSvincolo(m.S.assign[ids[i]].team, ids[i], m.PL[i].id), fa.verificaSvincolo(m.S.assign[ids[i]].team, ids[i], m.PL[i].id))
    }
  })

  it('lega: scontri, previsioni, pericolosi, giornate nere, classifica, verifica', () => {
    for (const t of m.S.teams) {
      for (const ga of [1, 5, 12]) uguale(m.attesoRosa(t.id, ga), fa.attesoRosa(t.id, ga))
      for (let gl = 1; gl <= 6; gl++) {
        uguale(m.scontro(t.id, gl), fa.scontro(t.id, gl))
        uguale(m.pericolosi(t.id, gl + 2, 5), fa.pericolosi(t.id, gl + 2, 5))
      }
      uguale(m.legaIncroci(t.id), fa.legaIncroci(t.id))
      const v = m.verifica(t.id)
      uguale(v, fa.verifica(t.id))
      uguale(m.sintesiVerifica(v), fa.sintesiVerifica(fa.verifica(t.id)))
    }
    uguale(m.classificaLega(), fa.classificaLega())
  })

  it('infermeria: cartellini, squalifiche, diffide, rossi, rientri', () => {
    uguale(m.cartellini(), fa.cartellini())
    uguale(m.squalifiche(), fa.squalifiche())
    expect(m.squalifiche().length).toBeGreaterThan(0)     // i «cattivi» devono esserci arrivati
    uguale(m.diffidati(), fa.diffidati())
    uguale(m.rossiDaVedere(), fa.rossiDaVedere())
    uguale(m.rientri(), fa.rientri())
  })

  it('punteggio di giornata e formazione automatica', () => {
    const g = m.nextG()
    for (const p of m.PL.filter(p => m.S.assign[p.id])) {
      const o = vecchio(p.id)
      uguale([m.dayScore(p, g), m.dayWhy(p, g), m.dayParts(p, g)], [fa.dayScore(o, g), fa.dayWhy(o, g), fa.dayParts(o, g)])
    }
    fa.autoFill(g)
    const L0 = fa.lineup(g)
    uguale(m.formazioneAutomatica(g, L0.mod), { mod: L0.mod, start: L0.start, bench: L0.bench })
  })

  it('rose ufficiali: lettura del file, abbinamento, confronto, movimenti proposti', () => {
    /* il file della lega, costruito dalle rose dell'app e poi «sporcato»:
       un prezzo diverso, un giocatore passato a un'altra squadra, uno che
       manca, uno nuovo, un nome che nessuno riconosce, una squadra rinominata */
    const colonne = m.S.teams.map(t => {
      const R = m.roster(t.id)
      return { nome: t.id === 4 ? 'I Rinnovati' : t.name, gio: ROLES.flatMap(r => R[r].map(x => [x.p.n, x.price] as [string, number])) }
    })
    colonne[0].gio[0][1] += 3
    colonne[1].gio.push(colonne[2].gio.shift()!)
    colonne[3].gio.pop()
    colonne[5].gio.push(['Sconosciuto Z.', 1])
    const libero = m.PL.find(p => !m.S.assign[p.id] && p.r === 'A')!
    colonne[6].gio.push([libero.n, 2])
    const alto = Math.max(...colonne.map(c => c.gio.length))
    const rows: unknown[][] = [['Rose della lega di prova'], colonne.flatMap(c => [c.nome, 'costo'])]
    for (let j = 0; j <= alto; j++) rows.push(colonne.flatMap(c => j < c.gio.length ? c.gio[j] : j === c.gio.length ? ['totale', c.gio.reduce((s, x) => s + x[1], 0)] : ['', '']))

    const vecchioFile = fa.parseRoseLega(rows)
    const file = parseRoseLega(rows, vecchioFile.quando)
    uguale(file, vecchioFile)
    const cmp = m.confrontoRose(file), cmpOld = fa.confrontoRose(vecchioFile)
    uguale(cmp, cmpOld)
    expect(cmp.diverse).toBeGreaterThan(0)
    uguale(m.movimentiProposti(cmp), fa.movimentiProposti(cmpOld))
  })
})
