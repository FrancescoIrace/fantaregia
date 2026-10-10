/* Oggi, la dashboard del telefono, resa davvero sulla lega sintetica:
   poche caselle che portano alle pagine, e un bottone per ogni pagina. */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import Oggi from '../src/pagine/Oggi.tsx'
import { creaMotore, ROLES } from '../src/domain/motore.ts'
import { calendarioDaRighe, parseCSV, righeInGiocatori } from '../src/domain/importa.ts'
import { ORDINE, type Modo } from '../src/viste/modo.ts'
import type { RigheLega } from '../src/data/componi.ts'
import { costruisciLega } from './lega-sintetica.ts'

const ESEMPI = fileURLToPath(new URL('../../esempi/', import.meta.url))
const players = righeInGiocatori(parseCSV(readFileSync(ESEMPI + 'listone-esempio.csv', 'utf8')))
const cal = calendarioDaRighe(parseCSV(readFileSync(ESEMPI + 'calendario-esempio.csv', 'utf8')))
const { rig, hist, shared } = costruisciLega(players, cal)

const motore = (myTeam: number, stato = shared) => creaMotore({ players, cal, rig, hist, stato, me: { myTeam } })
const righe = (formazioni: Record<string, unknown> = {}, obiettivi = {}) =>
  ({ preferenze: { mia_squadra: 3, obiettivi, formazioni } }) as unknown as RigheLega
const disegna = (m: ReturnType<typeof motore>, modo: Modo, r = righe(), puoScrivere = true) => renderToString(createElement(MemoryRouter, null,
  createElement(Oggi, { legaId: 'l1', righe: r, motore: m, modo, puoScrivere }))).replaceAll('<!-- -->', '')
const conta = (html: string, classe: string) => (html.match(new RegExp(`class="${classe}[" ]`, 'g')) ?? []).length

describe('Oggi', () => {
  it('in stagione: la giornata in cima, scontro, formazione, fuori e classifica, ognuno un link alla sua pagina', () => {
    const m = motore(3), html = disegna(m, 'stagione')
    expect(html).toContain(`${m.giornataOggi()}ª giornata`)
    expect(html).toContain('Il tuo scontro')
    expect(html).toContain('href="/lega/l1/scontri"')
    expect(html).toContain('Da schierare')                       // nessuna formazione salvata
    expect(html).toContain('href="/lega/l1/formazioni"')
    expect(html).toContain('I tuoi fuori')
    expect(html).toContain('href="/lega/l1/infermeria"')
    expect(html).toContain('Classifica')
    expect(conta(html, 'o-casella')).toBeLessThanOrEqual(5)    // poche cose, non la pagina intera
  })

  it('un bottone per ogni pagina, più Lega e dati', () => {
    for (const modo of ['stagione', 'asta'] as const) {
      const html = disegna(motore(3), modo)
      expect(conta(html, 'o-bottone'), modo).toBe(ORDINE[modo].length + 1)
      expect(html).toContain('href="/lega/l1/dati"')
    }
  })

  it('la formazione salvata con undici in campo è «Schierata», col suo modulo', () => {
    const m = motore(3), g = m.giornataOggi(), R = m.roster(3)
    const prendi = (r: (typeof ROLES)[number], n: number) => R[r].slice(0, n).map(x => x.p.id)
    const start = { P: prendi('P', 1), D: prendi('D', 4), C: prendi('C', 4), A: prendi('A', 2) }
    const html = disegna(m, 'stagione', righe({ [g]: { mod: '4-4-2', start, bench: [] } }))
    expect(html).toContain('Schierata')
    expect(html).toContain('4-4-2')
    expect(html).not.toContain('Da schierare')
  })

  it('senza calendario di lega lo dice, a chi scrive come caricarlo', () => {
    const m = motore(3, { ...shared, lega: null })
    expect(disegna(m, 'stagione')).toContain('si carica in Lega e dati')
    expect(disegna(m, 'stagione', righe(), false)).toContain('lo carica chi tiene la lega')
  })

  it('all\'asta: crediti, posti per reparto, avanzamento, obiettivi', () => {
    const m = motore(3), st = m.stats(3)
    const html = disegna(m, 'asta', righe({}, { [m.PL[0].id]: { max: 10 } }))
    expect(html).toContain(`${st.left} crediti`)
    expect(html).toContain(`offri al massimo <b class="fr-num">${st.max}</b>`)
    expect(conta(html, 'o-reparto')).toBe(4)
    expect(html).toContain('L&#x27;asta della lega')
    expect(html).toContain('Obiettivi')
    expect(html).not.toContain('Il tuo scontro')
  })

  it('all\'asta, l\'ultimo acquisto dal registro; senza registro la propria rosa', () => {
    expect(disegna(motore(3), 'asta')).toContain('La tua rosa')
    const assegnate = shared.assign!, pid = Number(Object.keys(assegnate)[0]), a = assegnate[pid]
    const conLog = motore(3, { ...shared, log: [{ pid, team: a.team, price: a.price, t: 1 }] })
    const html = disegna(conLog, 'asta')
    expect(html).toContain('Ultimo acquisto')
    expect(html).toContain(conLog.byId.get(pid)!.n)
  })
})
