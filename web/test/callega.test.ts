/* Il calendario di lega: il file di leghe.fantacalcio.it letto come
   nell'app originale, e cosa succede agli abbinamenti quando lo si
   ricarica. È l'unica fonte dei risultati — il motore non li calcola —
   quindi da qui dipendono la classifica di lega e la verifica. */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { avviaLegacy } from './legacy.ts'
import { costruisciLega } from './lega-sintetica.ts'
import { parseCalLega, proponiAbbinamenti, riallinea } from '../src/domain/calendario-lega.ts'
import { squadreAsta } from '../src/data/carica.ts'
import CaricaDati from '../src/pagine/CaricaDati.tsx'
import { creaMotore } from '../src/domain/motore.ts'
import { calendarioDaRighe, parseCSV, righeInGiocatori } from '../src/domain/importa.ts'
import type { RigheLega } from '../src/data/componi.ts'
import type { CalendarioLega, StatoLega } from '../src/domain/tipi.ts'

const ESEMPI = fileURLToPath(new URL('../../esempi/', import.meta.url))
const players = righeInGiocatori(parseCSV(readFileSync(ESEMPI + 'listone-esempio.csv', 'utf8')))
const cal = calendarioDaRighe(parseCSV(readFileSync(ESEMPI + 'calendario-esempio.csv', 'utf8')))
const { rig, hist, shared } = costruisciLega(players, cal)
const LEGA = shared.lega!

const motore = (stato: Partial<StatoLega>) => creaMotore({ players, cal, rig, hist, stato, me: { myTeam: 1 } })

/* Il foglio come lo fa scaricare leghe.fantacalcio.it: blocchi affiancati a
   coppie, «Nª Giornata lega» e tre colonne più in là «Mª Giornata serie a»;
   sotto le partite, con i fantapunti in mezzo alle due squadre e il
   risultato in gol cinque colonne più in là. Prima che si giochi al posto
   dei numeri ci sono «0», «0» e «-». */
function foglioCalLega(lega: CalendarioLega, conRisultati = true): unknown[][] {
  const rows: unknown[][] = [['Calendario Lega di prova'], []]
  const pt = (v: number | null | undefined) => v === null || v === undefined ? '0' : String(v).replace('.', ',')
  for (let g = 0; g < lega.gior.length; g += 2) {
    const banda = [g, g + 1].filter(x => x < lega.gior.length)
    const testa: unknown[] = []
    banda.forEach((x, k) => {
      testa[k * 6] = `${x + 1}ª Giornata lega`
      testa[k * 6 + 3] = `${x + 1 + lega.off}ª Giornata serie a`
    })
    rows.push(testa)
    for (let j = 0; j < Math.max(...banda.map(x => lega.gior[x].length)); j++) {
      const r: unknown[] = []
      banda.forEach((x, k) => {
        const p = lega.gior[x][j]
        if (!p) return
        const e = conRisultati ? (lega.ris ?? [])[x]?.[j] : null
        r[k * 6] = lega.teams[p[0]]
        r[k * 6 + 1] = pt(e?.pa)
        r[k * 6 + 2] = pt(e?.pb)
        r[k * 6 + 3] = lega.teams[p[1]]
        r[k * 6 + 4] = e && e.ga !== null && e.gb !== null ? `${e.ga}-${e.gb}` : '-'
      })
      rows.push(r)
    }
    rows.push([])
  }
  return rows
}

/** gli incroci con i nomi al posto degli indici: il confronto che regge al rinumero */
const perNome = (c: CalendarioLega) => c.gior.map(ps => ps.map(([a, b]) => [c.teams[a], c.teams[b]]))

const righe = foglioCalLega(LEGA)

let L: Awaited<ReturnType<typeof avviaLegacy>>
beforeAll(async () => { L = await avviaLegacy({ players, cal, rig, hist, shared }) })
afterAll(() => L?.chiudi())

describe('lettura del calendario di lega', () => {
  it('andata e ritorno: incroci, fantapunti e gol tornano identici', () => {
    const { cal: letto, giocate, prime, offMisto, avvisi } = parseCalLega(righe)
    expect([...letto.teams].sort()).toEqual([...LEGA.teams].sort())
    expect(letto.off).toBe(LEGA.off)
    expect(perNome(letto)).toEqual(perNome(LEGA))
    expect(letto.ris).toEqual(LEGA.ris!.concat(
      Array.from({ length: LEGA.gior.length - LEGA.ris!.length }, () => LEGA.gior[0].map(() => null))))
    expect(giocate).toBe(4)
    expect(prime).toBe(1)
    expect(offMisto).toBe(false)
    expect(avvisi).toEqual([])
  })

  it('una partita senza gol tiene i fantapunti: serve alla verifica', () => {
    const { cal: letto } = parseCalLega(righe)
    const senzaGol = letto.ris![2][0]!
    expect(senzaGol.ga).toBeNull()
    expect(senzaGol.gb).toBeNull()
    expect(senzaGol.pa).toBe(LEGA.ris![2][0]!.pa)
  })

  it('prima che si giochi: nessun risultato, il calendario sì', () => {
    const { cal: letto, giocate } = parseCalLega(foglioCalLega(LEGA, false))
    expect(giocate).toBe(0)
    expect(letto.ris!.every(r => r.every(x => x === null))).toBe(true)
    expect(perNome(letto)).toEqual(perNome(LEGA))
  })

  it('gli stessi numeri dell\'app a file singolo', () => {
    const mio = parseCalLega(righe)
    const suo = L.fa.parseCalLega(righe)
    expect(mio.cal.teams).toEqual(suo.teams)
    expect(mio.cal.off).toBe(suo.off)
    expect(mio.cal.gior).toEqual(suo.gior)
    expect(mio.cal.ris).toEqual(suo.ris)
    expect([mio.giocate, mio.prime, mio.offMisto, mio.avvisi]).toEqual([suo.giocate, suo.prime, suo.offMisto, suo.avvisi])
  })

  it('un file che non è un calendario di lega lo dice, invece di leggere zero', () => {
    expect(() => parseCalLega([['Nome', 'Squadra', 'Voto'], ['Tizio', 'Alfa', '6']]))
      .toThrow(/non sembra un calendario di lega/)
    expect(() => parseCalLega(foglioCalLega({ ...LEGA, gior: LEGA.gior.slice(0, 1), ris: LEGA.ris!.slice(0, 1) })))
      .toThrow(/ho letto solo 1 giornate/)
  })

  it('una giornata sbilanciata è un avviso, non un errore', () => {
    const storta = { ...LEGA, gior: LEGA.gior.map((ps, i) => i === 3 ? ps.slice(0, 3) : ps) }
    const { cal: letto, avvisi } = parseCalLega(foglioCalLega(storta))
    expect(avvisi).toEqual(['la giornata 4 ha 3 partite invece di 5'])
    expect(letto.gior[3]).toHaveLength(3)
  })
})

describe('abbinamento con le squadre dell\'asta', () => {
  it('le stesse proposte dell\'app a file singolo', () => {
    const m = motore(shared)
    const { cal: letto } = parseCalLega(righe)
    expect(proponiAbbinamenti(squadreAsta(m), letto.teams)).toEqual(L.fa.proponiAbbinamenti(letto.teams))
  })

  it('il nome uguale vince, sotto la soglia non si tira a indovinare', () => {
    const squadre = [
      { tid: 1, nome: 'Fanta A', colpi: [] },
      { tid: 2, nome: 'Qwerty', colpi: [] },
    ]
    const map = proponiAbbinamenti(squadre, ['Fanta A', 'Fanta B'])
    expect(map).toEqual({ 1: 0 })                       // 2 resta da abbinare a mano
  })

  it('il giocatore simbolo abbina, il riempitivo da un credito no', () => {
    const simbolo = [{ tid: 1, nome: 'Undici', colpi: [{ nome: 'Thuram M.', prezzo: 241 }] }]
    expect(proponiAbbinamenti(simbolo, ['I Duran Thuram'])).toEqual({ 1: 0 })
    const riempitivo = [{ tid: 1, nome: 'Undici', colpi: [{ nome: 'Thuram K.', prezzo: 1 }] }]
    expect(proponiAbbinamenti(riempitivo, ['I Duran Thuram'])).toEqual({})
  })
})

describe('ricaricare il calendario', () => {
  const m = motore(shared)
  const { cal: letto } = parseCalLega(righe)
  /* Nella lega sintetica le squadre dell'asta si chiamano «Squadra N» e
     quelle del calendario «Fanta X»: nessuna somiglianza, quindi gli
     abbinamenti sono quelli fatti a mano. Qui li si riporta sugli indici
     del file letto, che scopre le squadre in un ordine suo. */
  const mappa = Object.fromEntries(Object.entries(shared.legaMap!)
    .map(([tid, i]) => [tid, letto.teams.indexOf(LEGA.teams[i])]))

  it('nessuna somiglianza: il file nuovo si abbina a mano', () => {
    expect(riallinea(null, {}, letto, squadreAsta(m)).map).toEqual({})
  })

  it('stesso file: gli abbinamenti restano dov\'erano', () => {
    const dopo = riallinea(letto, mappa, parseCalLega(righe).cal, squadreAsta(m))
    expect(dopo.map).toEqual(mappa)
    expect(dopo.rifatto).toBe(false)
    expect(dopo.rinominate).toEqual([])
  })

  it('qualcuno ha cambiato nome: incroci identici, abbinamenti validi', () => {
    const rinominato = { ...letto, teams: letto.teams.map((n, i) => i === 2 ? 'Nome Nuovo' : n) }
    const dopo = riallinea(letto, mappa, rinominato, squadreAsta(m))
    expect(dopo.rinominate).toEqual([`${letto.teams[2]} → Nome Nuovo`])
    expect(dopo.rifatto).toBe(false)
    expect(dopo.map).toEqual(mappa)
  })

  it('incroci diversi: tiene per nome quello che può e lo dice', () => {
    const rifatto = { ...letto, gior: [...letto.gior].reverse() }
    const dopo = riallinea(letto, mappa, rifatto, squadreAsta(m))
    expect(dopo.rifatto).toBe(true)
    expect(dopo.tenuti).toBe(Object.keys(mappa).length)
    expect(dopo.map).toEqual(mappa)                     // i nomi ci sono tutti: nessuno perso
    expect(dopo.persi).toEqual([])
  })

  it('una squadra sparita dal file nuovo finisce fra i persi', () => {
    const map = { 1: 0, 2: 1 }
    const nuovo = { ...letto, teams: letto.teams.map((n, i) => i === 1 ? 'Sconosciuta FC' : n), gior: [...letto.gior].reverse() }
    const dopo = riallinea(letto, map, nuovo, [])
    expect(dopo.map).toEqual({ 1: 0 })
    expect(dopo.persi).toEqual([letto.teams[1]])
  })
})

describe('la riga in «Carica dati»', () => {
  const righeDb: RigheLega = {
    lega: {
      id: 'l1', nome: 'Prova', stagione: '2026/27', budget: 500, slots: { P: 3, D: 8, C: 8, A: 6 },
      plan: { P: 7, D: 19, C: 32, A: 42 }, squal_on: true, voti_meta: null, rose_meta: null,
      versione: 1, aggiornata_il: '2026-09-11T10:00:00Z',
    },
    squadre: [], assegnazioni: [], log: [], movimenti: [], indisponibili: [], squalificheAnnullate: [],
    voti: [], dataset: [], preferenze: null,
  }
  // una data a stagione finita: la giornata di oggi non dipende dai voti caricati
  const disegna = (stato: Partial<StatoLega>) => renderToString(createElement(CaricaDati, {
    legaId: 'l1', righe: righeDb,
    motore: creaMotore({ players, cal, rig, hist, stato, me: { myTeam: 1 }, oggi: new Date('2027-07-01') }),
  }))

  it('senza calendario dice cosa manca, non solo che manca', () => {
    const html = disegna({ ...shared, lega: null, legaMap: {} })
    expect(html).toContain('Calendario di lega e risultati')
    expect(html).toContain('senza questo non ci sono classifica di lega né verifica')
  })

  it('con il calendario dice fin dove arrivano i risultati', () => {
    const html = disegna(shared)
    expect(html).toContain('10 squadre')
    expect(html).toContain('18 giornate')
    expect(html).toContain('risultati fino alla 4ª')
    expect(html).toContain('mancano dalla 5ª alla 17ª')
    expect(html).toContain('1 da abbinare')             // la decima squadra non è abbinata
  })
})

describe('i risultati accendono classifica e verifica', () => {
  it('senza calendario di lega non c\'è niente da mostrare', () => {
    const m = motore({ ...shared, lega: null, legaMap: {} })
    expect(m.legaGiocate()).toEqual([])
    expect(m.classificaLega()).toEqual([])
    expect(m.verifica(1)).toEqual([])
  })

  it('caricato il file, i numeri sono quelli di prima', () => {
    const vecchio = motore(shared)
    const { cal: letto } = parseCalLega(righe)
    const r = riallinea(shared.lega, shared.legaMap!, letto, squadreAsta(vecchio))
    const nuovo = motore({ ...shared, lega: letto, legaMap: r.map })

    expect(nuovo.legaGiocate()).toEqual(vecchio.legaGiocate())
    /* Il file scopre le squadre in un ordine suo, quindi gli indici cambiano
       e i nomi no: è per nome che le due classifiche devono coincidere. */
    const senzaIndice = (c: ReturnType<typeof nuovo.classificaLega>) => c.map(({ i, ...x }) => x)
    expect(senzaIndice(nuovo.classificaLega())).toEqual(senzaIndice(vecchio.classificaLega()))
    const perAvversario = (v: ReturnType<typeof nuovo.verifica>, t: string[]) => v.map(x => ({ ...x, avv: t[x.avv] }))
    expect(perAvversario(nuovo.verifica(1), letto.teams)).toEqual(perAvversario(vecchio.verifica(1), LEGA.teams))
  })
})
