/* Rose: riepilogo con i giudizi, una scheda per squadra, e le righe che
   finiscono in Excel. */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import Rose from '../src/pagine/Rose.tsx'
import { creaMotore, ROLES } from '../src/domain/motore.ts'
import { righeRiepilogo, righeRose } from '../src/domain/riepilogo.ts'
import { calendarioDaRighe, parseCSV, righeInGiocatori } from '../src/domain/importa.ts'
import { costruisciLega } from './lega-sintetica.ts'

const ESEMPI = fileURLToPath(new URL('../../esempi/', import.meta.url))
const players = righeInGiocatori(parseCSV(readFileSync(ESEMPI + 'listone-esempio.csv', 'utf8')))
const cal = calendarioDaRighe(parseCSV(readFileSync(ESEMPI + 'calendario-esempio.csv', 'utf8')))
const { rig, hist, shared } = costruisciLega(players, cal)
const m = creaMotore({ players, cal, rig, hist, stato: shared, me: { myTeam: 3 } })
const conta = (html: string, classe: string) => (html.match(new RegExp(`class="${classe}[" ]`, 'g')) ?? []).length
const disegna = (motore = m, puoScrivere = true) => renderToString(createElement(Rose, {
  legaId: 'l1', motore, puoScrivere, ricarica: () => {},
}))

describe('Rose', () => {
  it('riepilogo e una scheda per squadra, con il giudizio sotto', () => {
    const html = disegna()
    expect(conta(html, 'rosecard card')).toBe(m.S.teams.length)
    expect(conta(html, 'giud')).toBe(m.S.teams.length)
    // il giudizio ha sei voci: undici, profondità, prezzi, titolari, rigoristi, rischio
    expect(conta(html, 'gpart')).toBe(m.S.teams.length * 6)
    expect(conta(html, 'pblock')).toBe(m.S.teams.length)      // la vista di stampa
    expect(html).toContain('Scarica in Excel')
  })

  it('in sola lettura niente pulsanti per liberare', () => {
    expect(disegna(m, false)).not.toContain('title="Libera"')
    expect(disegna(m, true)).toContain('title="Libera"')
  })

  it('senza asta lo dice invece di mostrare una tabella vuota', () => {
    const vuoto = creaMotore({ players, cal, rig, hist, stato: { ...shared, assign: {} } })
    expect(disegna(vuoto)).toContain('asta non è ancora cominciata')
  })
})

describe('righe da esportare', () => {
  it('una riga per giocatore in rosa, più l\'intestazione', () => {
    const righe = righeRose(m, { from: 3, span: 5 })
    const inRosa = m.S.teams.reduce((n, t) => n + ROLES.reduce((k, r) => k + m.roster(t.id)[r].length, 0), 0)
    expect(righe).toHaveLength(inRosa + 1)
    expect(righe[0][0]).toBe('Squadra')
  })

  it('una riga per squadra, con spesa e residuo che fanno il budget', () => {
    const righe = righeRiepilogo(m)
    expect(righe).toHaveLength(m.S.teams.length + 1)
    for (const r of righe.slice(1)) expect(Number(r[1]) + Number(r[2])).toBe(m.S.budget)
  })
})
