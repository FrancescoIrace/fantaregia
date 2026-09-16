// @vitest-environment jsdom
/* La barra azione del telefono: una pagina dentro il guscio dice qual è la
   sua azione principale, e il guscio la disegna sopra la navigazione. Qui
   serve un DOM vero, perché l'azione arriva al guscio con un effetto, e gli
   effetti col rendering sul server non partono. */
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Guscio from '../src/viste/Guscio.tsx'
import { useAzione, type Azione } from '../src/viste/barra-azione.ts'

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let radice: Root, box: HTMLDivElement
beforeEach(() => { box = document.createElement('div'); document.body.appendChild(box); radice = createRoot(box) })
afterEach(() => { act(() => radice.unmount()); box.remove() })

function Pagina({ azione }: { azione: Azione | null }) {
  useAzione(azione)
  return createElement('p', null, 'pagina')
}

const nelGuscio = (figlio: ReturnType<typeof createElement>) => createElement(MemoryRouter, { initialEntries: ['/lega/l1/formazioni'] },
  createElement(Guscio, {
    legaId: 'l1', nomeLega: 'Lega', squadra: null, modo: 'stagione', onModo: () => {}, onEsci: () => {}, children: figlio,
  }))

describe('la barra azione', () => {
  it('la pagina dà la sua azione, il guscio la disegna, e il pulsante la esegue', () => {
    const fai = vi.fn()
    act(() => radice.render(nelGuscio(createElement(Pagina, { azione: { titolo: '3-4-3 · 72 di media', sotto: 'giornata 5', etichetta: 'Schiera la migliore', fai } }))))
    const barra = box.querySelector('.g-azione')
    expect(barra).not.toBeNull()
    expect(barra!.textContent).toContain('3-4-3 · 72 di media')
    expect(barra!.textContent).toContain('giornata 5')
    expect(box.querySelector('.guscio')!.className).toContain('con-azione')
    act(() => (box.querySelector('.g-principale') as HTMLButtonElement).click())
    expect(fai).toHaveBeenCalledTimes(1)
  })

  it('senza un\'azione principale la fascia non c\'è', () => {
    act(() => radice.render(nelGuscio(createElement(Pagina, { azione: null }))))
    expect(box.querySelector('.g-azione')).toBeNull()
    expect(box.querySelector('.guscio')!.className).not.toContain('con-azione')
  })

  it('segue la pagina: cambia quando cambia quello che mostra, sparisce quando la pagina se ne va', () => {
    const pagina = (n: number) => createElement(Pagina, { azione: { titolo: `${n} giocatori`, etichetta: 'Filtri', fai: () => {} } })
    act(() => radice.render(nelGuscio(pagina(1))))
    expect(box.querySelector('.g-azione')!.textContent).toContain('1 giocatori')
    act(() => radice.render(nelGuscio(pagina(84))))
    expect(box.querySelector('.g-azione')!.textContent).toContain('84 giocatori')
    act(() => radice.render(nelGuscio(createElement('p', null, 'altra pagina'))))
    expect(box.querySelector('.g-azione')).toBeNull()
  })

  it('il pulsante chiama sempre l\'ultima versione dell\'azione, non quella del primo disegno', () => {
    const vecchia = vi.fn(), nuova = vi.fn()
    // stesso testo: al guscio non si rimanda niente, ma il tocco deve arrivare alla funzione nuova
    const pagina = (fai: () => void) => createElement(Pagina, { azione: { titolo: 'Belbauzzi a 90', etichetta: 'Assegna', fai } })
    act(() => radice.render(nelGuscio(pagina(vecchia))))
    act(() => radice.render(nelGuscio(pagina(nuova))))
    act(() => (box.querySelector('.g-principale') as HTMLButtonElement).click())
    expect(nuova).toHaveBeenCalledTimes(1)
    expect(vecchia).not.toHaveBeenCalled()
  })

  it('fuori dal guscio, cioè da scrivania, useAzione non fa niente', () => {
    act(() => radice.render(createElement(Pagina, { azione: { titolo: 'x', etichetta: 'y', fai: () => {} } })))
    expect(box.textContent).toBe('pagina')
  })
})
