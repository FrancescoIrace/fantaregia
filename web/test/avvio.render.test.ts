// @vitest-environment jsdom
/* La schermata di avvio: chi scrive carica il listone e il calendario parte
   da solo; chi legge vede solo che la lega non è pronta. E le due trappole
   che il piano aveva segnato — il calendario chiesto con i club del listone
   appena letto, non con quelli del motore, e l'esito che si legge prima di
   entrare. */
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Avvio from '../src/pagine/Avvio.tsx'
import * as carica from '../src/data/carica.ts'
import type { RigheLega } from '../src/data/componi.ts'

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const RIGHE = { lega: { id: 'l1', nome: 'Lega', stagione: '2026/27' }, assegnazioni: [] } as unknown as RigheLega
const CAL = { teams: ['Alfa', 'Beta'], fix: [[0, 1]] } as unknown as Awaited<ReturnType<typeof carica.scaricaCalendario>>['cal']

let radice: Root, box: HTMLDivElement
const entrato = vi.fn(), saltato = vi.fn()
beforeEach(() => { box = document.createElement('div'); document.body.appendChild(box); radice = createRoot(box) })
afterEach(() => { act(() => radice.unmount()); box.remove(); vi.restoreAllMocks(); entrato.mockClear(); saltato.mockClear() })

const apri = (puoScrivere = true) => act(() => radice.render(createElement(Avvio, {
  legaId: 'l1', righe: RIGHE, puoScrivere, onEntra: entrato, onSalta: saltato,
})))
const bottone = (testo: string | RegExp) =>
  [...box.querySelectorAll('button')].find(b => (typeof testo === 'string' ? b.textContent === testo : testo.test(b.textContent ?? '')))
const scegliFile = async () => {
  const input = box.querySelector<HTMLInputElement>('input[type=file]')!
  const f = new File(['nome;ruolo\n'], 'listone.csv', { type: 'text/csv' })
  Object.defineProperty(input, 'files', { value: [f], configurable: true })
  await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })) })
}

describe('chi non può scrivere', () => {
  it('vede che la lega non è pronta, e nessun caricamento', () => {
    apri(false)
    expect(box.textContent).toContain('La lega non è ancora pronta')
    expect(box.querySelector('input[type=file]')).toBeNull()
  })

  it('può guardare comunque: in Panoramica ci sono membri e inviti', () => {
    apri(false)
    act(() => bottone('Guarda comunque')!.click())
    expect(saltato).toHaveBeenCalled()
  })
})

describe('chi carica', () => {
  it('chiede un file solo, e dice che il calendario viene da sé', () => {
    apri()
    expect(box.textContent).toContain('Cominciamo dal listone')
    expect(box.textContent).toContain('openfootball')
    expect(box.querySelector('input[type=file]')).not.toBeNull()
    expect(bottone(/Entra nella lega/)).toBeUndefined()      // prima di caricare non c'è
  })

  it('letto il listone, il calendario si chiede con i club di quel file, non con quelli del motore', async () => {
    vi.spyOn(carica, 'caricaListone').mockResolvedValue({ giocatori: 518, rimasti: 0, club: ['Alfa', 'Beta'], fuori: [] })
    const giu = vi.spyOn(carica, 'scaricaCalendario').mockResolvedValue({ cal: CAL, ignote: [] })
    vi.spyOn(carica, 'salvaDataset').mockResolvedValue(undefined)
    apri()
    await scegliFile()
    expect(giu).toHaveBeenCalledWith('2026/27', ['Alfa', 'Beta'])
    expect(box.textContent).toContain('518 giocatori, 2 squadre di serie A')
    expect(box.textContent).toContain('Calendario 2026/27 da openfootball')
  })

  it('«Entra nella lega» arriva solo alla fine: l\'esito si legge prima', async () => {
    vi.spyOn(carica, 'caricaListone').mockResolvedValue({ giocatori: 518, rimasti: 3, club: ['Alfa'], fuori: [] })
    vi.spyOn(carica, 'scaricaCalendario').mockResolvedValue({ cal: CAL, ignote: [] })
    vi.spyOn(carica, 'salvaDataset').mockResolvedValue(undefined)
    apri()
    await scegliFile()
    expect(box.textContent).toContain('3 già in rosa non sono più in lista')
    act(() => bottone('Entra nella lega')!.click())
    expect(entrato).toHaveBeenCalled()
  })

  it('se openfootball non ha la stagione si va avanti lo stesso: il calendario si carica anche da csv', async () => {
    vi.spyOn(carica, 'caricaListone').mockResolvedValue({ giocatori: 518, rimasti: 0, club: ['Alfa'], fuori: [] })
    vi.spyOn(carica, 'scaricaCalendario').mockRejectedValue(new Error('openfootball non ha ancora la stagione 2026/27 (404)'))
    vi.spyOn(carica, 'salvaDataset').mockResolvedValue(undefined)
    apri()
    await scegliFile()
    expect(box.textContent).toContain('openfootball non ha ancora la stagione')
    expect(box.textContent).toContain('anche da un csv')
    expect(bottone('Entra nella lega')).toBeDefined()        // la lega si usa lo stesso
  })

  it('le squadre non abbinate si dicono, e non fermano niente', async () => {
    vi.spyOn(carica, 'caricaListone').mockResolvedValue({ giocatori: 518, rimasti: 0, club: ['Alfa', 'Gamma'], fuori: [] })
    vi.spyOn(carica, 'scaricaCalendario').mockResolvedValue({ cal: CAL, ignote: ['Gamma'] })
    vi.spyOn(carica, 'salvaDataset').mockResolvedValue(undefined)
    apri()
    await scegliFile()
    expect(box.textContent).toContain('Gamma non si abbina')
    expect(bottone('Entra nella lega')).toBeDefined()
  })

  it('un file che non è il listone lo dice e lascia riprovare, senza scaricare niente', async () => {
    vi.spyOn(carica, 'caricaListone').mockRejectedValue(new Error('In questo file non ci sono giocatori'))
    const giu = vi.spyOn(carica, 'scaricaCalendario')
    apri()
    await scegliFile()
    expect(box.textContent).toContain('In questo file non ci sono giocatori')
    expect(giu).not.toHaveBeenCalled()
    expect(box.querySelector<HTMLInputElement>('input[type=file]')!.disabled).toBe(false)
  })

  it('«lo faccio dopo» non è un vicolo: si entra lo stesso', () => {
    apri()
    act(() => bottone(/Lo faccio dopo/)!.click())
    expect(saltato).toHaveBeenCalled()
  })
})
