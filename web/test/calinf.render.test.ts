/* Calendario e Infermeria resi davvero sulla lega sintetica. */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import Calendario from '../src/pagine/Calendario.tsx'
import Infermeria from '../src/pagine/Infermeria.tsx'
import { creaMotore } from '../src/domain/motore.ts'
import { calendarioDaRighe, parseCSV, righeInGiocatori } from '../src/domain/importa.ts'
import { costruisciLega } from './lega-sintetica.ts'

const ESEMPI = fileURLToPath(new URL('../../esempi/', import.meta.url))
const players = righeInGiocatori(parseCSV(readFileSync(ESEMPI + 'listone-esempio.csv', 'utf8')))
const cal = calendarioDaRighe(parseCSV(readFileSync(ESEMPI + 'calendario-esempio.csv', 'utf8')))
const { rig, hist, shared } = costruisciLega(players, cal)
const m = creaMotore({ players, cal, rig, hist, stato: shared, me: { myTeam: 3 } })
const conta = (html: string, classe: string) => (html.match(new RegExp(`class="${classe}[" ]`, 'g')) ?? []).length
const infermeria = (puoScrivere: boolean, motore = m) =>
  renderToString(createElement(Infermeria, { legaId: 'l1', motore, puoScrivere, ricarica: () => {} }))

describe('Calendario', () => {
  it('le venti squadre in ordine di morbidezza, i risultati veri, le forze', () => {
    const html = renderToString(createElement(Calendario, { motore: m }))
    expect(conta(html, 'tname')).toBe(cal.teams.length + m.classificaSerieA().length)   // calendario + classifica
    expect(conta(html, 'calscore')).toBe(cal.teams.length)
    expect(conta(html, 'forcerow')).toBe(cal.teams.length)
    expect(conta(html, 'rispart')).toBe(m.risultatiDi(m.giornateGiocate().at(-1)!).length)
  })

  it('senza calendario dice dove prenderlo', () => {
    const vuoto = creaMotore({ players, stato: shared })
    expect(renderToString(createElement(Calendario, { motore: vuoto }))).toContain('openfootball')
  })
})

describe('Infermeria', () => {
  it('fuori, diffidati ed espulsi: una riga per ciascuno, e i pulsanti solo a chi scrive', () => {
    const html = infermeria(true)
    const fuori = Object.keys(shared.out!).length + m.squalifiche().length
    expect(conta(html, 'infrow')).toBe(fuori + m.diffidati().length + m.rossiDaVedere().filter(() => true).length)
    expect(html).toContain('È tornato')
    expect(conta(html, 'inftag squal')).toBe(m.squalifiche().length)
    const sola = infermeria(false)
    expect(sola).not.toContain('È tornato')
    expect(sola).toContain('Gli infortunati li segnano admin e banditori')
  })

  it('con le squalifiche spente restano solo gli infortuni', () => {
    const spente = creaMotore({ players, cal, rig, hist, stato: { ...shared, squalOn: false }, me: { myTeam: 3 } })
    expect(conta(infermeria(true, spente), 'inftag squal')).toBe(0)
  })
})
