// @vitest-environment jsdom
/* Il pannello delle squadre, toccato davvero: quante righe nascono, cosa
   succede con Invio e incollando un elenco, e che un doppione si veda prima
   di premere «Crea» — il database lo rifiuterebbe, ma dopo. */
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CreaLega } from '../src/pagine/Leghe.tsx'
import { stagioneCorrente } from '../src/data/carica.ts'
import { supabase } from '../src/lib/supabase.ts'

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let radice: Root, box: HTMLDivElement
beforeEach(() => {
  box = document.createElement('div'); document.body.appendChild(box); radice = createRoot(box)
  act(() => radice.render(createElement(MemoryRouter, null, createElement(CreaLega))))
})
afterEach(() => { act(() => radice.unmount()); box.remove(); vi.restoreAllMocks() })

const righe = () => [...box.querySelectorAll<HTMLInputElement>('input[aria-label^="Squadra "]')]
const nomi = () => righe().map(e => e.value)
const quante = () => box.querySelector<HTMLInputElement>('input[aria-label="Quante squadre"]')!
const perEtichetta = (t: string) => [...box.querySelectorAll('label')].find(l => l.textContent?.startsWith(t))!.querySelector('input')!
const crea = () => [...box.querySelectorAll('button')].find(b => /^Crea/.test(b.textContent ?? ''))!

/* React ascolta l'evento, non l'assegnazione: il valore va scritto con il
   setter nativo, altrimenti lo stato non se ne accorge. */
const scrivi = (el: HTMLInputElement, v: string) => act(() => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, v)
  el.dispatchEvent(new Event('input', { bubbles: true }))
})
const invio = (el: HTMLInputElement) => act(() => {
  el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
})
const incolla = (el: HTMLInputElement, testo: string) => act(() => {
  const ev = new Event('paste', { bubbles: true, cancelable: true })
  Object.defineProperty(ev, 'clipboardData', { value: { getData: () => testo } })
  el.dispatchEvent(ev)
})

describe('quante siete', () => {
  it('apre con otto righe vuote e le conta', () => {
    expect(righe()).toHaveLength(8)
    expect(quante().value).toBe('8')
    expect(box.textContent).toContain('0 nomi scritti su 8')
  })

  it('alzando il numero nascono righe vuote', () => {
    scrivi(quante(), '10')
    expect(righe()).toHaveLength(10)
  })

  it('abbassandolo si tolgono solo le righe vuote in fondo: un nome non sparisce da solo', () => {
    scrivi(quante(), '10')
    scrivi(righe()[6], 'Settima')
    scrivi(quante(), '4')
    expect(nomi()).toEqual(['', '', '', '', '', '', 'Settima'])
  })

  it('la ✕ toglie la riga che si indica, nome compreso', () => {
    scrivi(righe()[0], 'Prima'); scrivi(righe()[1], 'Seconda')
    act(() => box.querySelector<HTMLButtonElement>('button[aria-label="Togli la squadra 1"]')!.click())
    expect(righe()).toHaveLength(7)
    expect(nomi()[0]).toBe('Seconda')
  })
})

describe('scrivere i nomi', () => {
  it('Invio in fondo apre la riga dopo, e non manda il modulo', () => {
    const rpc = vi.spyOn(supabase, 'rpc')
    invio(righe()[7])
    expect(righe()).toHaveLength(9)
    expect(document.activeElement).toBe(righe()[8])
    expect(rpc).not.toHaveBeenCalled()
  })

  it('Invio su una riga seguita da una vuota ci sposta soltanto il fuoco', () => {
    scrivi(righe()[0], 'Prima')
    invio(righe()[0])
    expect(righe()).toHaveLength(8)
    expect(document.activeElement).toBe(righe()[1])
  })

  it('un elenco incollato si spalma sulle righe, spazi tolti', () => {
    incolla(righe()[0], 'Regia FC\n  Altra Squadra \nTerza\n')
    expect(nomi().slice(0, 4)).toEqual(['Regia FC', 'Altra Squadra', 'Terza', ''])
    expect(box.textContent).toContain('3 nomi scritti su 8')
  })

  it('un elenco più lungo delle righe se le crea', () => {
    incolla(righe()[0], Array.from({ length: 12 }, (_, i) => `S${i + 1}`).join('\n'))
    expect(righe()).toHaveLength(12)
  })

  it('un nome solo si incolla come sempre, senza toccare le altre righe', () => {
    const ev = new Event('paste', { bubbles: true, cancelable: true })
    Object.defineProperty(ev, 'clipboardData', { value: { getData: () => 'Regia FC' } })
    act(() => { righe()[0].dispatchEvent(ev) })
    expect(ev.defaultPrevented).toBe(false)              // lo fa il browser, non noi
    expect(nomi()).toEqual(Array(8).fill(''))
  })
})

describe('i doppioni', () => {
  const doppione = () => { scrivi(perEtichetta('Nome'), 'Lega'); scrivi(righe()[0], 'Regia FC'); scrivi(righe()[1], '  regia fc  ') }

  it('spazi e maiuscole non fanno due squadre diverse: lo dice mentre scrivi', () => {
    doppione()
    expect(box.textContent).toContain('Due squadre si chiamano «Regia FC»')
  })

  it('le righe ripetute si segnano con il tratteggio, non con il colore', () => {
    doppione()
    expect(righe()[0].className).toContain('border-dashed')
    expect(righe()[1].className).toContain('border-dashed')
    expect(righe()[2].className).not.toContain('border-dashed')
  })

  it('e «Crea» resta spento finché ci sono', () => {
    doppione()
    expect(crea().disabled).toBe(true)
    scrivi(righe()[1], 'Altra')
    expect(crea().disabled).toBe(false)
  })
})

describe('creare la lega', () => {
  it('senza nome, o con meno di due squadre, non si può', () => {
    expect(crea().disabled).toBe(true)                    // appena aperta
    scrivi(perEtichetta('Nome'), 'Lega dei Sabati'); scrivi(righe()[0], 'Regia FC')
    expect(crea().disabled).toBe(true)                    // una squadra sola
    scrivi(righe()[1], 'Altra')
    expect(crea().disabled).toBe(false)
  })

  it('manda i nomi senza spazi né righe vuote, con la stagione di oggi', async () => {
    const rpc = vi.spyOn(supabase, 'rpc').mockResolvedValue({ data: 'lega-1', error: null } as never)
    scrivi(perEtichetta('Nome'), 'Lega dei Sabati')
    scrivi(righe()[0], '  Regia FC '); scrivi(righe()[3], 'Altra Squadra')
    await act(async () => { crea().click() })
    expect(rpc).toHaveBeenCalledWith('crea_lega', {
      p_nome: 'Lega dei Sabati', p_squadre: ['Regia FC', 'Altra Squadra'], p_budget: 500, p_stagione: stagioneCorrente(),
    })
  })

  it('una stagione scritta storta si ferma qui, invece di finire nell\'url di openfootball', async () => {
    const rpc = vi.spyOn(supabase, 'rpc')
    scrivi(perEtichetta('Nome'), 'Lega'); scrivi(righe()[0], 'Uno'); scrivi(righe()[1], 'Due')
    scrivi(perEtichetta('Stagione'), '2027')
    await act(async () => { crea().click() })
    expect(rpc).not.toHaveBeenCalled()
    expect(box.textContent).toContain('2026/27')
  })
})
