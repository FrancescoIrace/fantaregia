/* Il delta: la variazione accanto al valore, con il verso deciso da una
   soglia, e lo spazio che resta anche quando un confronto non c'è. */
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { scriviDelta, verso } from '../src/viste/delta.ts'
import { Delta } from '../src/viste/segni.tsx'

describe('delta', () => {
  it('sotto la soglia è fermo: un punto su cento è rumore', () => {
    expect([verso(2), verso(-2), verso(3), verso(-3)]).toEqual(['fermo', 'fermo', 'su', 'giu'])
    expect(verso(5, 6)).toBe('fermo')
  })

  it('si scrive col segno, e il meno è quello tipografico', () => {
    expect([scriviDelta(5), scriviDelta(-3), scriviDelta(0.4), scriviDelta(-0.4)]).toEqual(['+5', '−3', '=', '='])
    // sui fantapunti mezzo punto è un voto: lì si scrive il decimale
    expect([scriviDelta(1.5, 1), scriviDelta(-0.04, 1), scriviDelta(2, 1)]).toEqual(['+1.5', '=', '+2.0'])
  })

  it('senza confronto lo spazio resta: vuoto, senza verso, nascosto ai lettori di schermo', () => {
    expect(renderToString(createElement(Delta, { ora: 60, prima: null }))).toBe('<span class="fr-delta" aria-hidden="true"></span>')
  })

  it('con il confronto: verso e valore', () => {
    const html = renderToString(createElement(Delta, { ora: 60, prima: 52 }))
    expect(html).toContain('data-verso="su"')
    expect(html).toContain('>+8<')
  })
})
