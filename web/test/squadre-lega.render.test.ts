/* Il tabellone delle squadre della Panoramica, nei due disegni. Sul telefono
   la tabella diventa una riga per squadra: il test pretende che in ogni riga
   ci siano ancora tutte le colonne della tabella — slot per reparto, spesi,
   residuo, tetto, giudizio, allenatore. */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import SquadreLega from '../src/pagine/SquadreLega.tsx'
import { creaMotore } from '../src/domain/motore.ts'
import { calendarioDaRighe, parseCSV, righeInGiocatori } from '../src/domain/importa.ts'
import { costruisciLega } from './lega-sintetica.ts'
import type { RigheLega } from '../src/data/componi.ts'

const ESEMPI = fileURLToPath(new URL('../../esempi/', import.meta.url))
const players = righeInGiocatori(parseCSV(readFileSync(ESEMPI + 'listone-esempio.csv', 'utf8')))
const cal = calendarioDaRighe(parseCSV(readFileSync(ESEMPI + 'calendario-esempio.csv', 'utf8')))
const { rig, hist, shared } = costruisciLega(players, cal)
const motore = creaMotore({ players, cal, rig, hist, stato: shared, me: { myTeam: 3 } })

const squadre = motore.S.teams.map(t => ({ id: t.id, nome: t.name, posizione: t.id, lega_idx: null,
  colore: t.id === 3 ? '#3E7BD6' : null, allenatore: t.id === 3 ? 'u1' : null }))
const righe = { squadre, allenatoreMancante: false } as unknown as RigheLega
const membri = [{ utente_id: 'u1', nome: 'Francesco' }, { utente_id: 'u2', nome: 'Marco' }]

const disegna = (telefono: boolean, puoAssegnare = true) => renderToString(createElement(SquadreLega, {
  motore, righe, mia: 3, utenteId: 'u1', membri, puoAssegnare, onAllenatore: () => {}, telefono,
}))
const conta = (html: string, re: RegExp) => (html.match(re) ?? []).length

describe('le squadre della Panoramica', () => {
  const n = motore.S.teams.length

  it('da scrivania: la tabella, una riga per squadra', () => {
    const html = disegna(false)
    expect(html).toContain('min-w-[640px]')
    expect(conta(html, /<tr class="(bg-accent-soft)?"/g)).toBe(n)
  })

  it('sul telefono: niente tabella, una riga per squadra con tutte le colonne', () => {
    const html = disegna(true)
    expect(html).not.toContain('<table')
    expect(conta(html, /class="m-squadra( mia)?"/g)).toBe(n)
    expect(conta(html, /class="m-squadra mia"/g)).toBe(1)
    // quattro reparti per squadra, e spesi, tetto, giudizio in ogni riga
    expect(conta(html, /class="ruolo-lettera"/g)).toBe(n * 4)
    for (const voce of ['residuo · spesi', 'tetto ', 'giudizio ']) expect(conta(html, new RegExp(voce, 'g')), voce).toBe(n)
    // i numeri sono quelli del motore
    for (const t of motore.S.teams) expect(html).toContain(`<b class="fr-num">${motore.stats(t.id).left}</b>`)
  })

  it('chi scrive assegna gli allenatori; chi no vede i nomi e si prende una squadra libera', () => {
    expect(conta(disegna(true, true), /<select class="m-select"/g)).toBe(n)
    const lettore = disegna(true, false)
    expect(lettore).not.toContain('<select')
    expect(lettore).toContain('>tu<')
    expect(conta(lettore, />Prendila</g)).toBe(n - 1)
  })

  it('il filo della riga è la tinta della squadra, solo dove ce n\'è una', () => {
    expect(conta(disegna(true), /--tinta:#3E7BD6/g)).toBe(1)
  })
})
