// @vitest-environment jsdom
/* Il guscio del telefono, toccato davvero: la barra in basso, il cassetto,
   la modalità asta. */
import { act, createElement, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import Guscio from '../src/viste/Guscio.tsx'
import { ORDINE, PRIME, SCHEDE, type Modo } from '../src/viste/modo.ts'

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let radice: Root, box: HTMLDivElement
beforeEach(() => { box = document.createElement('div'); document.body.appendChild(box); radice = createRoot(box) })
afterEach(() => { act(() => radice.unmount()); box.remove() })

function Dove() { return createElement('output', { id: 'dove' }, useLocation().pathname) }

function Prova({ iniziale }: { iniziale: Modo }) {
  const [modo, setModo] = useState<Modo>(iniziale)
  return createElement(Guscio, {
    legaId: 'l1', nomeLega: 'Lega', squadra: { nome: 'Regia FC', colore: null }, modo, onModo: setModo,
    email: 'prova@esempio.it', onEsci: () => {}, children: createElement(Dove),
  })
}
const apri = (modo: Modo, via = '/lega/l1') => act(() => radice.render(
  createElement(MemoryRouter, { initialEntries: [via] }, createElement(Prova, { iniziale: modo }))))
const testiBarra = () => [...box.querySelectorAll('.g-nav .g-vai')].map(e => e.textContent)
const tocca = (e: Element | null) => act(() => (e as HTMLElement).click())

describe('il guscio del telefono', () => {
  it('in barra le prime quattro della modalità, più Altro', () => {
    apri('stagione')
    expect(testiBarra()).toEqual([...ORDINE.stagione.slice(0, PRIME).map(k => SCHEDE[k].testo), 'Altro'])
  })

  it('il cassetto ha Lega e dati, la modalità asta, tutte le altre pagine, le tue leghe ed Esci', () => {
    apri('stagione')
    tocca(box.querySelector('.g-tondo[aria-label="Menu della lega"]'))
    const cassetto = box.querySelector('.g-cassetto')!
    expect(cassetto.querySelector('.g-voce.primaria')!.textContent).toContain('Lega e dati')
    expect(cassetto.textContent).toContain('Modalità asta')
    for (const k of ORDINE.stagione.slice(PRIME)) expect(cassetto.textContent, k).toContain(SCHEDE[k].testo)
    expect(cassetto.textContent).toContain('Le tue leghe')
    expect(cassetto.textContent).toContain('Esci')
    expect(cassetto.textContent).toContain('prova@esempio.it')
    // tutte e dieci le pagine più la Panoramica raggiungibili: quattro in barra, sei nel cassetto, una in cima al cassetto
    const pagine = cassetto.querySelectorAll('a.g-voce:not(.primaria)[href^="/lega/l1/"]').length
    expect(pagine).toBe(ORDINE.stagione.length - PRIME)
    expect(PRIME + pagine + 1).toBe(11)
  })

  it('accendere la modalità asta riordina la barra e porta sulla sua prima pagina', () => {
    apri('stagione', '/lega/l1/scontri')
    tocca(box.querySelector('.g-vai:last-child'))                     // Altro
    tocca(box.querySelector('.g-interruttore'))
    expect(testiBarra()).toEqual([...ORDINE.asta.slice(0, PRIME).map(k => SCHEDE[k].testo), 'Altro'])
    expect(box.querySelector('#dove')!.textContent).toBe(`/lega/l1/${SCHEDE[ORDINE.asta[0]].path}`)
    expect(box.querySelector('.g-cassetto')).toBeNull()                 // e il cassetto si chiude
  })

  it('toccare una voce del cassetto porta lì e lo chiude', () => {
    apri('stagione')
    tocca(box.querySelector('.g-vai:last-child'))
    const voce = [...box.querySelectorAll('.g-cassetto a.g-voce')].find(a => a.textContent!.includes('Mercato'))!
    tocca(voce)
    expect(box.querySelector('#dove')!.textContent).toBe('/lega/l1/mercato')
    expect(box.querySelector('.g-cassetto')).toBeNull()
    // Mercato non è in barra: è acceso «Altro»
    expect(box.querySelector('.g-vai:last-child')!.className).toContain('on')
  })
})
