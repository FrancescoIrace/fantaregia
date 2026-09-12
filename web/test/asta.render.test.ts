/* Asta live: tabellone, scarsità, crediti in sala, piano di spesa e
   registro delle chiamate, resi sulla lega sintetica. */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import Asta from '../src/pagine/Asta.tsx'
import { creaMotore, ROLES } from '../src/domain/motore.ts'
import { calendarioDaRighe, parseCSV, righeInGiocatori } from '../src/domain/importa.ts'
import { completa, costruisciLega } from './lega-sintetica.ts'
import type { StatoLega } from '../src/domain/tipi.ts'

const ESEMPI = fileURLToPath(new URL('../../esempi/', import.meta.url))
const players = righeInGiocatori(parseCSV(readFileSync(ESEMPI + 'listone-esempio.csv', 'utf8')))
const cal = calendarioDaRighe(parseCSV(readFileSync(ESEMPI + 'calendario-esempio.csv', 'utf8')))
const { rig, hist, shared } = costruisciLega(players, cal)
// «completa» aggiunge il registro delle chiamate, che qui serve
const stato = completa(shared, players) as StatoLega
const m = creaMotore({ players, cal, rig, hist, stato, me: { myTeam: 3 } })
const conta = (html: string, classe: string) => (html.match(new RegExp(`class="${classe}[" ]`, 'g')) ?? []).length
const disegna = (puoScrivere = true, motore = m) => renderToString(createElement(Asta, {
  legaId: 'l1', motore, puoScrivere, ricarica: () => {},
}))

describe('Asta live', () => {
  it('tabellone, scarsità per ruolo, crediti di tutte le squadre, piano di spesa', () => {
    const html = disegna()
    // crediti, max offerta, quattro ruoli e il tassello mercato
    expect(conta(html, 'gauge')).toBeGreaterThanOrEqual(2 + ROLES.length)
    expect(conta(html, 'scrow')).toBe(ROLES.length)
    expect(conta(html, 'teamrow')).toBe(m.S.teams.length)
    expect(conta(html, 'planrow')).toBe(ROLES.length)
    expect(html).toContain('Chi resta, chi cerca')
  })

  it('il registro mostra le chiamate, con affari e salassi', () => {
    const html = disegna()
    expect(conta(html, 'logrow')).toBe(Math.min(80, stato.log.length))
    expect(stato.log.length).toBeGreaterThan(0)
    expect(html).toContain('Annulla ultima')
  })

  it('in sola lettura niente chiamata né pulsanti', () => {
    const html = disegna(false)
    expect(html).toContain('sola lettura')
    expect(html).toContain('riservata a chi registra')
    expect(html).not.toContain('Annulla ultima')
  })

  it('senza asta cominciata lo dice', () => {
    const vuoto = creaMotore({ players, cal, rig, hist, stato: { ...stato, assign: {}, log: [] }, me: { myTeam: 3 } })
    expect(disegna(true, vuoto)).toContain('asta non è ancora cominciata')
  })
})
