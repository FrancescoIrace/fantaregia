/* Chi colora cosa, dall'interfaccia: ognuno la sua squadra; admin e banditori
   scelgono quale, come permette imposta_colore() nel database. */
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import ColoreSquadra from '../src/pagine/ColoreSquadra.tsx'
import type { RigaSquadra } from '../src/data/componi.ts'

const squadre: RigaSquadra[] = [
  { id: 1, nome: 'Regia FC', posizione: 1, lega_idx: null, colore: '#E1523D' },
  { id: 2, nome: 'I Duran Thuram', posizione: 2, lega_idx: null, colore: '#2AA79B' },
  { id: 3, nome: 'Real Pizzeria', posizione: 3, lega_idx: null, colore: null },
]
const disegna = (p: Partial<Parameters<typeof ColoreSquadra>[0]>) =>
  renderToString(createElement(ColoreSquadra, { legaId: 'l1', squadre, mia: 1, ...p }))

describe('chi colora cosa', () => {
  it('in sola lettura: solo la propria squadra, niente scelta', () => {
    const html = disegna({ puoScrivere: false })
    expect(html).toContain('Il colore di <!-- -->Regia FC')
    expect(html).not.toContain('<select')
  })

  it('admin e banditori scelgono quale squadra colorare, partendo dalla propria', () => {
    const html = disegna({ puoScrivere: true })
    expect(html).toContain('<select')
    for (const s of squadre) expect(html).toContain(s.nome)
    expect(html).toContain('Regia FC<!-- --> (io)')
    expect(html).toMatch(/<option value="1" selected="">/)
  })

  it('un admin senza squadra scelta può colorare lo stesso', () => {
    const html = disegna({ puoScrivere: true, mia: null })
    expect(html).toContain('<select')
    expect(html).not.toContain('Scegli la tua squadra qui sopra')
  })

  it('in sola lettura e senza squadra scelta lo dice', () => {
    expect(disegna({ puoScrivere: false, mia: null })).toContain('Scegli la tua squadra qui sopra')
  })
})
