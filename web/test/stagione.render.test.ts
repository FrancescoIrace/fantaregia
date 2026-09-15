/* Titolari e Rendimento resi davvero sulla lega sintetica: una scheda per
   squadra con i giocatori divisi per livello, una riga di tabella per chi
   ha almeno una presenza. */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import Titolari from '../src/pagine/Titolari.tsx'
import Rendimento from '../src/pagine/Rendimento.tsx'
import { creaMotore } from '../src/domain/motore.ts'
import { calendarioDaRighe, parseCSV, righeInGiocatori } from '../src/domain/importa.ts'
import { costruisciLega } from './lega-sintetica.ts'

const ESEMPI = fileURLToPath(new URL('../../esempi/', import.meta.url))
const players = righeInGiocatori(parseCSV(readFileSync(ESEMPI + 'listone-esempio.csv', 'utf8')))
const cal = calendarioDaRighe(parseCSV(readFileSync(ESEMPI + 'calendario-esempio.csv', 'utf8')))
const { rig, hist, shared } = costruisciLega(players, cal)
const m = creaMotore({ players, cal, rig, hist, stato: shared, me: { myTeam: 3 } })
const conta = (html: string, classe: string) => (html.match(new RegExp(`class="${classe}[" ]`, 'g')) ?? []).length

describe('viste di stagione', () => {
  it('Titolari: una scheda per squadra, e ognuno sta in un livello o fra gli indisponibili', () => {
    const html = renderToString(createElement(Titolari, { motore: m }))
    const squadre = new Set(m.PL.map(p => p.s))
    expect(conta(html, 'tithead')).toBe(squadre.size)
    const attesi = m.PL.filter(p => m.isOut(p.id) || m.titStato(p).liv <= 3).length
    expect(conta(html, 'tp')).toBe(attesi)
    expect(conta(html, 'rigrow')).toBe(new Set(m.PL.filter(p => m.rigOf(p)).map(p => p.s)).size)
  })

  it('Rendimento: una riga per chi ha giocato, e la striscia delle ultime giornate', () => {
    const html = renderToString(createElement(Rendimento, { motore: m }))
    const giocato = m.PL.filter(p => m.statFor(p.id)?.pres).length
    expect((html.match(/<tr>/g) ?? []).length - 1).toBe(Math.min(400, giocato))   // meno l'intestazione
    expect(html).toContain('class="spark"')
    expect(html).toContain('1, 2, 3, 4, 5, 6, 7, 8, 9, 10')    // React separa i pezzi di testo con <!-- -->
  })

  it('i componenti nuovi: filo di ruolo e lettera per riga, numeri condensati, la forma detta con il delta', () => {
    const tit = renderToString(createElement(Titolari, { motore: m }))
    const righeTit = conta(tit, 'tp')
    expect((tit.match(/class="fr-filo-ruolo"/g) ?? []).length).toBe(righeTit)
    expect(conta(tit, 'qz fr-num')).toBe(righeTit)
    expect(tit).not.toContain('rounded-[5px]')                                  // il chip pastello di prima

    const ren = renderToString(createElement(Rendimento, { motore: m }))
    const righeRen = Math.min(400, m.PL.filter(p => m.statFor(p.id)?.pres).length)
    expect((ren.match(/class="fr-filo-ruolo"/g) ?? []).length).toBe(righeRen)
    expect(conta(ren, 'fmv fr-num')).toBe(righeRen)
    expect(ren).toMatch(/class="fr-delta" data-verso="(su|giu|fermo)"/)
  })

  it('senza voti né listone lo dicono', () => {
    const vuoto = creaMotore({ players: [], stato: { ...shared, stats: {} } })
    expect(renderToString(createElement(Rendimento, { motore: vuoto }))).toContain('Nessuna giornata caricata')
    expect(renderToString(createElement(Titolari, { motore: vuoto }))).toContain('Il listone non è caricato')
  })
})
