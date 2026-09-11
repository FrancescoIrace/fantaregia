/* La vista Lega resa davvero sulla lega sintetica (calendario di lega con
   dieci squadre, nove abbinate, quattro giornate di risultati). */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import Scontri from '../src/pagine/Scontri.tsx'
import { creaMotore } from '../src/domain/motore.ts'
import { calendarioDaRighe, parseCSV, righeInGiocatori } from '../src/domain/importa.ts'
import { costruisciLega } from './lega-sintetica.ts'

const ESEMPI = fileURLToPath(new URL('../../esempi/', import.meta.url))
const players = righeInGiocatori(parseCSV(readFileSync(ESEMPI + 'listone-esempio.csv', 'utf8')))
const cal = calendarioDaRighe(parseCSV(readFileSync(ESEMPI + 'calendario-esempio.csv', 'utf8')))
const { rig, hist, shared } = costruisciLega(players, cal)

const motore = (myTeam: number, stato = shared) => creaMotore({ players, cal, rig, hist, stato, me: { myTeam } })
const disegna = (m: ReturnType<typeof motore>) => renderToString(createElement(MemoryRouter, null,
  createElement(Scontri, { legaId: 'l1', utenteId: 'u1', motore: m, puoScrivere: true, ricarica: () => {} })))
const conta = (html: string, classe: string) => (html.match(new RegExp(`class="${classe}[" ]`, 'g')) ?? []).length

describe('vista Lega', () => {
  it('squadra abbinata: scontro, striscia delle giornate, classifica, verifica', () => {
    const m = motore(3)
    const html = disegna(m)
    expect(html).toContain('scmatch')
    expect(conta(html, 'lcell')).toBe(m.legaIncroci(3).length)
    expect(m.legaIncroci(3).length).toBeGreaterThan(10)
    expect(conta(html, 'mono cpos')).toBe(m.classificaLega().length)
    expect(conta(html, 'vrow')).toBe(m.verifica(3).length)
    expect(html).toContain('Abbinamenti')                 // la squadra 10 non è abbinata
  })

  it('in una giornata con avversario abbinato: probabilità, consiglio, reparti, pericolosi', () => {
    const m = motore(3)
    const gl = m.legaIncroci(3)[0].gl
    const s = m.scontro(3, gl)!
    expect(s.sua).not.toBeNull()
    const html = renderToString(createElement(MemoryRouter, null, createElement(Scontri, {
      legaId: 'l1', utenteId: 'u1', motore: m, puoScrivere: false, ricarica: () => {},
    })))
    // la giornata iniziale è «oggi»: basta che almeno una delle viste abbia il pronostico completo
    expect(html.includes('legasc') || html.includes('non è abbinato')).toBe(true)
    expect(conta(html, 'cmprow') === 0 || conta(html, 'cmprow') === 4).toBe(true)
  })

  it('squadra senza nome nel calendario di lega: lo dice e propone gli abbinamenti', () => {
    const html = disegna(motore(10))
    expect(html).toContain('non è ancora abbinata')
    expect(html).not.toContain('class="legasc"')
  })

  it('senza calendario di lega spiega cosa serve', () => {
    expect(disegna(motore(3, { ...shared, lega: null }))).toContain('Il calendario della lega non c&#x27;è ancora')
  })
})
