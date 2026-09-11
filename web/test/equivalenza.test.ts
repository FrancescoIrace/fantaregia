/* ══ Il port dà gli stessi numeri dell'originale? ═════════════════════
   Stessi dati in ingresso ai due motori — l'app a file singolo in jsdom e
   src/domain/motore.ts — e confronto di tutto quello che il motore sa dire:
   prezzi, indici, giudizi, previsioni, infermeria, formazioni, confronto
   con le rose ufficiali. Il confronto è esatto, non a tolleranza: il port
   fa le stesse operazioni nello stesso ordine.

   I dati sono il listone e il calendario INVENTATI di esempi/, più una lega
   sintetica generata con seme fisso (test/lega-sintetica.ts). Nessun dato
   reale: questo test può stare nel repo pubblico.                       */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { avviaLegacy, type Legacy } from './legacy.ts'
import { costruisciLega } from './lega-sintetica.ts'
import { creaMotore, parseRoseLega, ROLES, type Motore } from '../src/domain/motore.ts'
import { calendarioDaRighe, parseCSV, righeInGiocatori } from '../src/domain/importa.ts'
import type { GiocatoreGrezzo, Ruolo, StatoLega } from '../src/domain/tipi.ts'

const ESEMPI = fileURLToPath(new URL('../../esempi/', import.meta.url))
const FIN = { from: 3, span: 5 }
const ME = { myTeam: 3, targets: {} }

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
