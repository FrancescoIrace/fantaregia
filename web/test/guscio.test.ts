// @vitest-environment jsdom
/* Il guscio del telefono, toccato davvero: il cassetto, la modalità asta. */
import { act, createElement, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import Guscio from '../src/viste/Guscio.tsx'
import { ORDINE, SCHEDE, type Modo } from '../src/viste/modo.ts'

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
const tocca = (e: Element | null) => act(() => (e as HTMLElement).click())
const apriMenu = () => tocca(box.querySelector('.g-tondo[aria-label="Menu della lega"]'))
const testiPagine = () => [...box.querySelectorAll('.g-cassetto a.g-voce:not(.primaria)[href^="/lega/l1/"]')].map(e => e.querySelector('span')!.firstChild!.textContent)

describe('il guscio del telefono', () => {
  it('niente barra in basso: la navigazione sta tutta nel menu', () => {
    apri('stagione')
    expect(box.querySelector('nav')).toBeNull()
    expect(box.querySelector('.g-cassetto')).toBeNull()
  })

  it('il cassetto ha Oggi, Lega e dati, la modalità asta, tutte le pagine, le tue leghe ed Esci', () => {
    apri('stagione')
    apriMenu()
    const cassetto = box.querySelector('.g-cassetto')!
    const [oggi, dati] = cassetto.querySelectorAll('.g-voce.primaria')
    expect(oggi.textContent).toContain('Oggi')
    expect(oggi.getAttribute('href')).toBe('/lega/l1')
    expect(oggi.className).toContain('on')                              // Oggi è la rotta index
    expect(dati.textContent).toContain('Lega e dati')
    expect(dati.getAttribute('href')).toBe('/lega/l1/dati')
    expect(cassetto.textContent).toContain('Modalità asta')
    expect(testiPagine()).toEqual(ORDINE.stagione.map(k => SCHEDE[k].testo))
    expect(cassetto.textContent).toContain('Le tue leghe')
    expect(cassetto.textContent).toContain('Esci')
    expect(cassetto.textContent).toContain('prova@esempio.it')
  })

  it('accendere la modalità asta riordina le pagine e riporta a Oggi, che cambia con lei', () => {
    apri('stagione', '/lega/l1/scontri')
    apriMenu()
    tocca(box.querySelector('.g-interruttore'))
    expect(box.querySelector('#dove')!.textContent).toBe('/lega/l1')
    expect(box.querySelector('.g-cassetto')).toBeNull()                 // e il cassetto si chiude
    apriMenu()
    expect(testiPagine()).toEqual(ORDINE.asta.map(k => SCHEDE[k].testo))
  })

  it('toccare una voce del cassetto porta lì e lo chiude', () => {
    apri('stagione')
    apriMenu()
    const voce = [...box.querySelectorAll('.g-cassetto a.g-voce')].find(a => a.textContent!.includes('Mercato'))!
    tocca(voce)
    expect(box.querySelector('#dove')!.textContent).toBe('/lega/l1/mercato')
    expect(box.querySelector('.g-cassetto')).toBeNull()
    // riaperto, la voce della pagina in cui sei è accesa
    apriMenu()
    const accesa = box.querySelector('.g-cassetto a.g-voce.on')!
    expect(accesa.textContent).toContain('Mercato')
  })

  it("il tasto indietro: non c'è su Oggi, torna di un passo, e a Oggi se dietro non c'è niente", () => {
    const indietro = () => box.querySelector('.g-indietro')
    apri('stagione')
    expect(indietro()).toBeNull()
    apriMenu()
    tocca([...box.querySelectorAll('.g-cassetto a.g-voce')].find(a => a.textContent!.includes('Mercato'))!)
    apriMenu()
    tocca([...box.querySelectorAll('.g-cassetto a.g-voce')].find(a => a.textContent!.includes('Rose'))!)
    tocca(indietro())
    expect(box.querySelector('#dove')!.textContent).toBe('/lega/l1/mercato')
    // aperta da un link, senza niente dietro: si torna a Oggi, non fuori dall'app
    act(() => radice.unmount()); radice = createRoot(box)
    apri('stagione', '/lega/l1/rose')
    tocca(indietro())
    expect(box.querySelector('#dove')!.textContent).toBe('/lega/l1')
    expect(indietro()).toBeNull()
  })
})
