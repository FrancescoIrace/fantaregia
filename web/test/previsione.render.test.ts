/* Previsione contro realtà e testa a testa sulla lega sintetica: il modello
   di ogni giornata passata si chiede al motore com'era prima, e le viste
   mostrano quello che promettono. */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import PrevisioneRealta from '../src/pagine/PrevisioneRealta.tsx'
import TestaATesta from '../src/pagine/TestaATesta.tsx'
import { storicoPrevisioni } from '../src/domain/previsione.ts'
import { creaMotore, type Motore } from '../src/domain/motore.ts'
import { calendarioDaRighe, parseCSV, righeInGiocatori } from '../src/domain/importa.ts'
import { costruisciLega } from './lega-sintetica.ts'

const ESEMPI = fileURLToPath(new URL('../../esempi/', import.meta.url))
const players = righeInGiocatori(parseCSV(readFileSync(ESEMPI + 'listone-esempio.csv', 'utf8')))
const cal = calendarioDaRighe(parseCSV(readFileSync(ESEMPI + 'calendario-esempio.csv', 'utf8')))
const { rig, hist, shared } = costruisciLega(players, cal)
const m = creaMotore({ players, cal, rig, hist, stato: shared, me: { myTeam: 3 } })

const fatti = new Map<number, Motore>()
const motorePrima = (g: number) => {
  if (!fatti.has(g)) {
    const stats = Object.fromEntries(Object.entries(shared.stats ?? {}).filter(([k]) => Number(k) < g))
    fatti.set(g, creaMotore({ players, cal, rig, hist, stato: { ...shared, stats }, me: { myTeam: 3 } }))
  }
  return fatti.get(g)!
}
const giocate = m.giornateGiocate().slice(0, 3)
const formazioni = Object.fromEntries(giocate.map(g => [g, m.formazioneAutomatica(g, '4-4-2')]))

describe('previsione contro realtà', () => {
  it('una voce per giornata con i voti e una formazione salvata, con fantapunti veri', () => {
    expect(giocate.length).toBeGreaterThan(0)
    const voci = storicoPrevisioni(m, motorePrima, formazioni)
    expect(voci.map(v => v.g)).toEqual(giocate)
    for (const v of voci) {
      expect(v.mia.totale).toBeGreaterThan(0)
      expect(v.modello.totale).toBeGreaterThan(0)
    }
  })

  it('il modello di ogni giornata si chiede al motore com\'era prima, non a quello di oggi', () => {
    const chieste: number[] = []
    storicoPrevisioni(m, g => { chieste.push(g); return motorePrima(g) }, formazioni)
    expect(chieste).toEqual(giocate)
    expect(motorePrima(giocate[0]).giornateGiocate().every(g => g < giocate[0])).toBe(true)
  })

  it('chiusa non calcola niente e dice quante giornate ci sono; aperta mostra una riga per giornata', () => {
    const chiusa = renderToString(createElement(PrevisioneRealta, { m, motorePrima: () => { throw new Error('non doveva calcolare') }, formazioni }))
    expect(chiusa).toContain('Confronta')
    const aperta = renderToString(createElement(PrevisioneRealta, { m, motorePrima, formazioni, iniziaAperta: true }))
    expect((aperta.match(/<td class="fr-num">/g) ?? []).length).toBe(giocate.length)
    expect(aperta).toContain('il modello avrebbe fatto meglio')
  })

  it('senza formazioni salvate lo spiega', () => {
    expect(renderToString(createElement(PrevisioneRealta, { m, motorePrima, formazioni: {} }))).toContain('Quando ci saranno i voti')
  })
})

describe('testa a testa', () => {
  it('due rose affiancate, ciascuna con il suo undici del modello e un totale', () => {
    const html = renderToString(createElement(TestaATesta, { m, motorePrima, a: 3, b: 4, ga: giocate[0] }))
    expect(html).toContain(m.teamName(3))
    expect(html).toContain(m.teamName(4))
    expect((html.match(/class="tat-xi"/g) ?? []).length).toBe(2)
    expect((html.match(/class="fr-num tat-totale/g) ?? []).length).toBe(2)
    expect(html).toContain('fantapunti veri')
  })

  it('su una giornata senza voti i fantapunti sono attesi', () => {
    const futura = Math.max(...m.giornateGiocate()) + 1
    expect(renderToString(createElement(TestaATesta, { m, motorePrima, a: 3, b: 4, ga: futura }))).toContain('fantapunti attesi')
  })
})
