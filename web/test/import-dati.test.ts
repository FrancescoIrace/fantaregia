/* Lettura dei file che la lega si porta: voti di giornata e listone
   confrontati con l'app originale, statistiche e calendario openfootball
   su dati sintetici. Nessun file reale: i voti qui sono generati. */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { avviaLegacy } from './legacy.ts'
import { mulberry32 } from './lega-sintetica.ts'
import {
  calendarioDaOpenfootball, calendarioDaRighe, giornataDaTitolo, leggiVoti, parseCSV, righeInGiocatori, storicoDaRighe,
  type PartitaAperta,
} from '../src/domain/importa.ts'

const ESEMPI = fileURLToPath(new URL('../../esempi/', import.meta.url))
const listoneCsv = readFileSync(ESEMPI + 'listone-esempio.csv', 'utf8')
const players = righeInGiocatori(parseCSV(listoneCsv))
const cal = calendarioDaRighe(parseCSV(readFileSync(ESEMPI + 'calendario-esempio.csv', 'utf8')))

/* un foglio di voti nella forma del file ufficiale, ma inventato: titolo,
   note, blocchi per squadra, allenatori, voti con la virgola e l'asterisco */
function foglioVoti() {
  const rnd = mulberry32(38)
  const rows: unknown[][] = [['Voti Fantacalcio 5ª giornata Serie A'], ['www.esempio.it — solo per uso personale'], []]
  for (const s of cal.teams.slice(0, 12)) {
    rows.push([s])
    rows.push(['Cod.', 'Ruolo', 'Nome', 'Voto', 'Gf', 'Gs', 'Rp', 'Rs', 'Rf', 'Au', 'Amm', 'Esp', 'Ass'])
    for (const p of players.filter(p => p[4] === s).slice(0, 12)) {
      const voto = 5 + 0.5 * Math.floor(rnd() * 6)
      const txt = rnd() < 0.1 ? '6*' : String(voto).replace('.', ',')
      const gf = rnd() < 0.15 ? 1 : 0
      rows.push([p[0], p[1], p[3], txt, gf, p[1] === 'P' ? Math.floor(rnd() * 3) : 0, 0, 0, rnd() < 0.05 ? 1 : 0, 0, rnd() < 0.2 ? 1 : 0, 0, rnd() < 0.1 ? 1 : 0])
    }
    rows.push([9000 + rows.length, 'ALL', 'Allenatore', '6', 0, 0, 0, 0, 0, 0, 0, 0, 0])
  }
  return rows
}

let L: Awaited<ReturnType<typeof avviaLegacy>>
beforeAll(async () => { L = await avviaLegacy({ players, cal, rig: {}, hist: {}, shared: null }) })
afterAll(() => L?.chiudi())

describe('lettura dei file della lega', () => {
  it('voti di giornata: stesse righe dell\'app originale, giornata dal titolo', () => {
    const rows = foglioVoti()
    const finto = { utils: { sheet_to_json: (sh: unknown) => sh } }
    const vecchio = L.fa.parseVoti(finto, { Sheets: { Fantacalcio: rows } }, 'Fantacalcio')
    const nuovo = leggiVoti(rows)
    expect(JSON.parse(JSON.stringify(nuovo))).toEqual(JSON.parse(JSON.stringify(vecchio)))
    expect(nuovo.righe).toBeGreaterThan(80)
    expect(Object.values(nuovo.voti).some(v => v[1] === 1)).toBe(true)          // almeno un senza voto
    expect(giornataDaTitolo([rows])).toBe(L.fa.giornataDa({ SheetNames: ['F'], Sheets: { F: rows } }, finto))
    expect(giornataDaTitolo([rows])).toBe(5)
    expect(() => leggiVoti(rows.slice(0, 20))).toThrow(/non sembra quello dei voti/)
  })

  it('listone: stessi giocatori dell\'app originale', () => {
    const vecchi = L.fa.rowsToPlayers(parseCSV(listoneCsv)) as { id: number; r: string; rm: string; n: string; s: string; q: number; f: number; v: number }[]
    expect(players).toEqual(vecchi.map(p => [p.id, p.r, p.rm, p.n, p.s, p.q, p.f, p.v]))
  })

  it('statistiche della stagione scorsa, dal formato del file ufficiale', () => {
    const intest = ['Id', 'R', 'Rm', 'Nome', 'Squadra', 'Pv', 'Mv', 'Fm', 'Gf', 'Gs', 'Rp', 'Rc', 'R+', 'R-', 'Ass', 'Amm', 'Esp', 'Au']
    const righe = [intest, ...players.slice(0, 60).map((p, i) => [p[0], p[1], p[2], p[3], p[4], i % 7 ? 20 + i % 10 : 0, '6.123', '6.789', 3, 0, 0, 0, 1, 0, 2, 4, 0, 0])]
    const h = storicoDaRighe(righe)
    expect(Object.keys(h)).toHaveLength(60)
    expect(h[players[1][0]]).toEqual([21, 6.12, 6.79, 3, 0, 0, 0, 1, 0, 2, 4, 0, 0, players[1][4]])
    expect(h[players[0][0]]).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, players[0][4]])
  })

  it('calendario openfootball: nomi dei club tradotti in quelli del listone, casa e trasferta, date', () => {
    const club: Record<string, string> = {
      'FC Internazionale Milano': 'Inter', 'AC Milan': 'Milan', 'Juventus FC': 'Juventus', 'SSC Napoli': 'Napoli',
      'AS Roma': 'Roma', 'SS Lazio': 'Lazio', 'Atalanta BC': 'Atalanta', 'ACF Fiorentina': 'Fiorentina',
      'Bologna FC 1909': 'Bologna', 'Torino FC': 'Torino', 'Udinese Calcio': 'Udinese', 'Genoa CFC': 'Genoa',
      'US Lecce': 'Lecce', 'Cagliari Calcio': 'Cagliari', 'Como 1907': 'Como', 'Parma Calcio 1913': 'Parma',
      'US Sassuolo Calcio': 'Sassuolo', 'Venezia FC': 'Venezia', 'AC Monza': 'Monza', 'Frosinone Calcio': 'Frosinone',
    }
    const aperti = Object.keys(club)
    const partite: PartitaAperta[] = [
      { round: 'Matchday 1', date: '2026-08-22', team1: aperti[0], team2: aperti[1] },
      { round: 'Matchday 1', date: '2026-08-24', team1: aperti[2], team2: aperti[3] },
      { round: 'Matchday 2', date: '2026-08-30', team1: aperti[1], team2: aperti[2] },
      { round: 'Matchday 2', date: '2026-08-29', team1: aperti[3], team2: aperti[0] },
      ...aperti.slice(4).map((t, i) => ({ round: 'Matchday 1', date: '2026-08-23', team1: t, team2: aperti[(i + 1) % 16 + 4] })),
    ]
    const { cal: c, ignote } = calendarioDaOpenfootball(partite, Object.values(club))
    expect(ignote).toEqual([])
    expect(c.teams).toEqual([...new Set(Object.values(club))].sort())
    const i = (s: string) => c.teams.indexOf(s)
    expect(c.fix[i('Inter')][0]).toBe(i('Milan') + 1)          // in casa
    expect(c.fix[i('Milan')][0]).toBe(-(i('Inter') + 1))       // in trasferta
    expect(c.dates).toEqual(['2026-08-24', '2026-08-30'])       // l'ultima partita della giornata
    const senzaListone = calendarioDaOpenfootball(partite.slice(0, 2))
    expect(senzaListone.cal.teams).toEqual(['Internazionale Milano', 'Juventus', 'Milan', 'Napoli'].map(s => s === 'Internazionale Milano' ? 'Inter' : s).sort())
    const conIgnota = calendarioDaOpenfootball([{ round: 'Matchday 1', team1: 'Pisa SC', team2: 'AC Milan' }], ['Milan'])
    expect(conIgnota.ignote).toEqual(['Pisa SC'])
  })
})
