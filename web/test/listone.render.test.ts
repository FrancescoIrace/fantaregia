/* Listone e scheda giocatore resi davvero sulla lega sintetica. */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import Listone from '../src/pagine/Listone.tsx'
import Scheda from '../src/pagine/Scheda.tsx'
import { creaMotore } from '../src/domain/motore.ts'
import { calendarioDaRighe, parseCSV, righeInGiocatori } from '../src/domain/importa.ts'
import { costruisciLega } from './lega-sintetica.ts'
import type { RigheLega } from '../src/data/componi.ts'

const ESEMPI = fileURLToPath(new URL('../../esempi/', import.meta.url))
const players = righeInGiocatori(parseCSV(readFileSync(ESEMPI + 'listone-esempio.csv', 'utf8')))
const cal = calendarioDaRighe(parseCSV(readFileSync(ESEMPI + 'calendario-esempio.csv', 'utf8')))
const { rig, hist, shared } = costruisciLega(players, cal)
const m = creaMotore({ players, cal, rig, hist, stato: shared, me: { myTeam: 3 } })
const conta = (html: string, classe: string) => (html.match(new RegExp(`class="${classe}[" ]`, 'g')) ?? []).length

const righe = { preferenze: { mia_squadra: 3, obiettivi: { [players[0][0]]: { max: 12 } }, formazioni: {} } } as unknown as RigheLega
const listone = (motore = m) => renderToString(createElement(Listone, {
  legaId: 'l1', utenteId: 'u1', righe, motore, puoScrivere: true, ricarica: () => {},
}))
const scheda = (id: number) => renderToString(createElement(Scheda, {
  m, id, legaId: 'l1', puoScrivere: true, finestra: { from: 3, span: 5 },
  obiettivo: undefined, onObiettivo: () => {}, onChiudi: () => {}, ricarica: () => {},
}))

describe('Listone', () => {
  it('una riga per giocatore fino a 400, con stella, prezzo atteso e appetibilità', () => {
    const html = listone()
    expect(conta(html, 'starbtn')).toBe(Math.min(400, players.length))
    expect(conta(html, 'app')).toBe(Math.min(400, players.length))
    expect(html).toContain('mostrati i primi 400')
    expect(html).toContain('class="list stats"')            // ci sono voti: compare la colonna FM
    expect(conta(html, 'takenby')).toBeGreaterThan(0)        // qualcuno è già assegnato
    expect(html).toContain('★')                              // l'obiettivo salvato nelle preferenze
  })

  it('senza listone dice dove caricarlo', () => {
    expect(listone(creaMotore({ players: [], stato: shared }))).toContain('Il listone non è caricato')
  })
})

describe('scheda giocatore', () => {
  it('un giocatore con voti: appetibilità a voci, stagione scorsa, rendimento e giornata per giornata', () => {
    const p = m.PL.find(x => m.statFor(x.id)?.pres && m.annoScorso(x.id))!
    const html = scheda(p.id)
    expect(conta(html, 'brkrow')).toBe(m.appetParts(p, 3, 5).length)
    expect(conta(html, 'gdrow')).toBe(m.giornateGiocate().length)
    expect(html).toContain('Stagione 2025/26')
    expect(html).toContain('Come nasce')
    expect(html).toContain(p.n)
  })

  it('un giocatore senza storia lo dice invece di inventare numeri', () => {
    const p = m.PL.find(x => !m.annoScorso(x.id))!
    expect(scheda(p.id)).toContain('è un arrivo nuovo')
  })
})
