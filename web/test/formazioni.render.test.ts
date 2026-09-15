/* La vista Formazioni resa davvero (react-dom/server) sulla lega sintetica:
   la maglia di ogni casella, la panchina, la distinta. Serve a scoprire gli
   errori di disegno senza dover aprire il browser con un account. */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import Formazioni from '../src/pagine/Formazioni.tsx'
import { creaMotore } from '../src/domain/motore.ts'
import { calendarioDaRighe, parseCSV, righeInGiocatori } from '../src/domain/importa.ts'
import { costruisciLega } from './lega-sintetica.ts'
import type { RigheLega } from '../src/data/componi.ts'

const ESEMPI = fileURLToPath(new URL('../../esempi/', import.meta.url))
const players = righeInGiocatori(parseCSV(readFileSync(ESEMPI + 'listone-esempio.csv', 'utf8')))
const cal = calendarioDaRighe(parseCSV(readFileSync(ESEMPI + 'calendario-esempio.csv', 'utf8')))
const { rig, hist, shared } = costruisciLega(players, cal)
const motore = creaMotore({ players, cal, rig, hist, stato: shared, me: { myTeam: 3 } })

const disegna = (formazioni: Record<string, unknown>, mia: number | null = 3) => renderToString(
  createElement(MemoryRouter, null, createElement(Formazioni, {
    legaId: 'l1', utenteId: 'u1', motore,
    righe: { preferenze: { mia_squadra: mia, obiettivi: {}, formazioni } } as unknown as RigheLega,
  })))

describe('vista Formazioni', () => {
  it('senza formazione: caselle vuote, panchina con tutta la rosa', () => {
    const html = disegna({})
    expect(html).toContain('gslot vuoto')
    expect((html.match(/class="benchrow/g) ?? []).length).toBe(Object.values(shared.assign!).filter(a => a.team === 3).length)
  })

  it('con la formazione proposta: undici maglie colorate per fascia, distinta, niente caselle vuote', () => {
    const g = motore.giornataOggi()
    const html = disegna({ [g]: motore.formazioneAutomatica(g, '3-4-3') })
    expect((html.match(/class="gslot f-(oro|arg|bro|gre)/g) ?? []).length).toBe(11)
    expect(html).not.toContain('gslot vuoto')
    expect(html).toContain('formazione completa')
    expect(html).toContain('fixstrip')
  })

  it('i componenti nuovi: filo di ruolo su ogni riga di panchina, numeri condensati, delta sulla giornata prima', () => {
    const g = motore.giornataOggi()
    expect(g).toBeGreaterThan(1)                        // altrimenti non c'è una giornata prima con cui confrontare
    const html = disegna({ [g]: motore.formazioneAutomatica(g, '3-4-3') })
    const righePanchina = (html.match(/class="benchrow/g) ?? []).length
    expect(righePanchina).toBeGreaterThan(0)
    expect((html.match(/class="fr-filo-ruolo"/g) ?? []).length).toBe(righePanchina)
    expect((html.match(/class="dsc fr-num"/g) ?? []).length).toBe(righePanchina)
    // il ruolo lo dice il filo: la lettera senza sfondo, niente quadratino pieno accanto ai delta
    expect((html.match(/class="ruolo-lettera"/g) ?? []).length).toBe(righePanchina)
    expect(html).not.toContain('fr-chip')
    expect((html.match(/class="gslot[^"]*"[^>]*>(?:(?!<\/button>).)*class="fr-num"/g) ?? []).length).toBe(11)
    // un delta per riga di panchina, per maglia, e uno per il punteggio medio
    expect((html.match(/class="fr-delta" data-verso="(su|giu|fermo)"/g) ?? []).length).toBe(righePanchina + 11 + 1)
  })

  it('ogni riga di panchina ha l\'interruttore «fisso», spento finché non lo si accende', () => {
    const html = disegna({})
    const righePanchina = (html.match(/class="benchrow/g) ?? []).length
    expect((html.match(/class="fisso" aria-pressed="false"/g) ?? []).length).toBe(righePanchina)
    expect(html).toContain('>Preferito<')
  })

  it('senza la propria squadra scelta lo dice, e intanto mostra la prima', () => {
    expect(disegna({}, null)).toContain('Non hai ancora scelto la tua squadra')
  })
})
