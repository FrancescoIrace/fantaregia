/* Il campo in prospettiva del telefono: la geometria (una proiezione sola,
   posizioni neutre dal modulo) e la resa dentro Formazioni. */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { posizioni, proietta, scala } from '../src/viste/prospettiva.ts'
import Formazioni from '../src/pagine/Formazioni.tsx'
import { MODULI, creaMotore } from '../src/domain/motore.ts'
import { calendarioDaRighe, parseCSV, righeInGiocatori } from '../src/domain/importa.ts'
import { costruisciLega } from './lega-sintetica.ts'
import type { RigheLega } from '../src/data/componi.ts'
import type { Ruolo } from '../src/domain/tipi.ts'

const reparti = (mod: string): Record<Ruolo, number> => { const [d, c, a] = MODULI[mod]; return { P: 1, D: d, C: c, A: a } }
const disposizione = (mod: string) => (['P', 'D', 'C', 'A'] as Ruolo[]).flatMap(r => posizioni(r, reparti(mod)[r]))

describe('la geometria', () => {
  it('la prospettiva: fondo largo, porta avversaria stretta, dischi più piccoli salendo', () => {
    const largo = (t: number) => proietta(1, t).x - proietta(0, t).x
    expect(largo(0)).toBeGreaterThan(largo(1))
    expect(proietta(0.5, 0).y).toBeGreaterThan(proietta(0.5, 1).y)   // la propria porta in basso
    expect(scala(0)).toBe(1)
    expect(scala(1)).toBeCloseTo(0.70)
  })

  it('ogni modulo mette undici giocatori dentro il campo, e i sette moduli si distinguono', () => {
    const impronte = new Set<string>()
    for (const mod of Object.keys(MODULI)) {
      const d = disposizione(mod)
      expect(d, mod).toHaveLength(11)
      for (const { u, t } of d) {
        expect(u, mod).toBeGreaterThanOrEqual(0); expect(u, mod).toBeLessThanOrEqual(1)
        expect(t, mod).toBeGreaterThan(0); expect(t, mod).toBeLessThan(1)
      }
      impronte.add(d.map(p => `${p.u.toFixed(3)},${p.t.toFixed(3)}`).join(' '))
    }
    expect(impronte.size).toBe(Object.keys(MODULI).length)
  })

  it('i reparti sono simmetrici, e chi sta sull\'esterno avanza rispetto ai centrali', () => {
    for (const r of ['D', 'C', 'A'] as Ruolo[]) for (const n of [2, 3, 4, 5]) {
      const pos = posizioni(r, n)
      for (let i = 0; i < n; i++) {
        expect(pos[i].u + pos[n - 1 - i].u, `${r}${n}`).toBeCloseTo(1)
        expect(pos[i].t, `${r}${n}`).toBeCloseTo(pos[n - 1 - i].t)
      }
      // con due non c'è un centrale: sono esterni tutti e due
      if (n >= 3) expect(pos[0].t, `${r}${n}`).toBeGreaterThan(pos[Math.floor(n / 2)].t)
    }
  })

  it('un reparto si allarga con quanti sono, e a parità di numero la difesa occupa più campo dell\'attacco', () => {
    const ampiezza = (r: Ruolo, n: number) => { const p = posizioni(r, n); return p[n - 1].u - p[0].u }
    expect(ampiezza('D', 5)).toBeGreaterThan(ampiezza('D', 3))
    expect(ampiezza('C', 4)).toBeGreaterThan(ampiezza('C', 3))
    expect(ampiezza('D', 3)).toBeGreaterThan(ampiezza('A', 3))
    // il portiere al centro, quasi sulla linea
    expect(posizioni('P', 1)).toEqual([{ u: 0.5, t: 0.045 }])
  })
})

describe('Formazioni sul telefono', () => {
  const ESEMPI = fileURLToPath(new URL('../../esempi/', import.meta.url))
  const players = righeInGiocatori(parseCSV(readFileSync(ESEMPI + 'listone-esempio.csv', 'utf8')))
  const cal = calendarioDaRighe(parseCSV(readFileSync(ESEMPI + 'calendario-esempio.csv', 'utf8')))
  const { rig, hist, shared } = costruisciLega(players, cal)
  const m = creaMotore({ players, cal, rig, hist, stato: shared, me: { myTeam: 3 } })
  const g = m.giornataOggi()
  const disegna = (formazioni: Record<string, unknown>, telefono = true) => renderToString(createElement(MemoryRouter, null,
    createElement(Formazioni, {
      legaId: 'l1', utenteId: 'u1', motore: m, motorePrima: () => m, telefono,
      righe: { squadre: [], preferenze: { mia_squadra: 3, obiettivi: {}, formazioni } } as unknown as RigheLega,
    })))
  const conta = (html: string, re: RegExp) => (html.match(re) ?? []).length

  it('il campo al posto delle caselle, un disco per titolare', () => {
    const html = disegna({ [g]: m.formazioneAutomatica(g, '3-4-3') })
    expect(html).toContain('m-campo-svg')
    expect(html).not.toMatch(/class="casella /)
    expect(conta(html, /class="m-disco( ko)?"/g)).toBe(11)
    expect(html).not.toContain('m-disco vuoto')
  })

  it('senza formazione le caselle vuote restano, toccabili', () => {
    const html = disegna({})
    expect(conta(html, /class="m-disco vuoto"/g)).toBe(11)
    expect(conta(html, /role="button" tabindex="0" aria-label="Casella vuota/g)).toBe(11)
  })

  it('i sette moduli sono pulsanti, e quello della giornata è premuto', () => {
    const html = disegna({ [g]: m.formazioneAutomatica(g, '4-4-2') })
    expect(conta(html, /aria-pressed="(true|false)" class="fr-num"/g)).toBe(Object.keys(MODULI).length)
    expect(html).toMatch(/aria-pressed="true" class="fr-num">4-4-2</)
  })

  it('niente si perde: schiera, svuota, preferito, panchina con «fisso» e frecce, spiegazione', () => {
    const html = disegna({ [g]: m.formazioneAutomatica(g, '3-4-3') })
    for (const x of ['Schiera la migliore', 'Svuota', 'Modulo preferito', 'Panchina', 'Ordina per ruolo', 'formazione completa']) expect(html, x).toContain(x)
    const panchina = conta(html, /class="benchrow/g)
    expect(panchina).toBeGreaterThan(0)
    expect(conta(html, /class="fisso" aria-pressed="false"/g)).toBe(panchina)
    expect(conta(html, /title="Sali"/g)).toBe(panchina)
  })

  it('da scrivania nessuna traccia del campo', () => {
    const html = disegna({ [g]: m.formazioneAutomatica(g, '3-4-3') }, false)
    expect(html).not.toContain('m-campo-svg')
    expect(html).not.toContain('m-supera')
    expect(conta(html, /class="casella /g)).toBe(11)
  })
})
