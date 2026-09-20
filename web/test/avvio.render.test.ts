// @vitest-environment jsdom
/* La schermata di avvio: chi scrive carica il listone e il calendario parte
   da solo; chi legge vede solo che la lega non è pronta. E le due trappole
   che il piano aveva segnato — il calendario chiesto con i club del listone
   appena letto, non con quelli del motore, e l'esito che si legge prima di
   entrare. */
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Avvio from '../src/pagine/Avvio.tsx'
import * as carica from '../src/data/carica.ts'
import * as lega from '../src/data/lega.ts'
import type { RigheLega } from '../src/data/componi.ts'
import type { FileRose } from '../src/domain/motore.ts'
import type { GiocatoreGrezzo } from '../src/domain/tipi.ts'

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const RIGHE = { lega: { id: 'l1', nome: 'Lega', stagione: '2026/27' }, assegnazioni: [] } as unknown as RigheLega
const CAL = { teams: ['Alfa', 'Beta'], fix: [[0, 1]] } as unknown as Awaited<ReturnType<typeof carica.scaricaCalendario>>['cal']

let radice: Root, box: HTMLDivElement
const entrato = vi.fn(), saltato = vi.fn()
beforeEach(() => { box = document.createElement('div'); document.body.appendChild(box); radice = createRoot(box) })
afterEach(() => { act(() => radice.unmount()); box.remove(); vi.restoreAllMocks(); entrato.mockClear(); saltato.mockClear() })

const apri = (puoScrivere = true, viaggio?: unknown, righe: RigheLega = RIGHE) => act(() => radice.render(
  createElement(MemoryRouter, { initialEntries: [{ pathname: '/lega/l1', state: viaggio }] },
    createElement(Avvio, { legaId: 'l1', righe, puoScrivere, onEntra: entrato, onSalta: saltato }))))
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
    vi.spyOn(carica, 'caricaListone').mockResolvedValue({ giocatori: 518, rimasti: 0, club: ['Alfa', 'Beta'], players: [], fuori: [] })
    const giu = vi.spyOn(carica, 'scaricaCalendario').mockResolvedValue({ cal: CAL, ignote: [] })
    vi.spyOn(carica, 'salvaDataset').mockResolvedValue(undefined)
    apri()
    await scegliFile()
    expect(giu).toHaveBeenCalledWith('2026/27', ['Alfa', 'Beta'])
    expect(box.textContent).toContain('518 giocatori, 2 squadre di serie A')
    expect(box.textContent).toContain('Calendario 2026/27 da openfootball')
  })

  it('«Entra nella lega» arriva solo alla fine: l\'esito si legge prima', async () => {
    vi.spyOn(carica, 'caricaListone').mockResolvedValue({ giocatori: 518, rimasti: 3, club: ['Alfa'], players: [], fuori: [] })
    vi.spyOn(carica, 'scaricaCalendario').mockResolvedValue({ cal: CAL, ignote: [] })
    vi.spyOn(carica, 'salvaDataset').mockResolvedValue(undefined)
    apri()
    await scegliFile()
    expect(box.textContent).toContain('3 già in rosa non sono più in lista')
    act(() => bottone('Entra nella lega')!.click())
    expect(entrato).toHaveBeenCalled()
  })

  it('se openfootball non ha la stagione si va avanti lo stesso: il calendario si carica anche da csv', async () => {
    vi.spyOn(carica, 'caricaListone').mockResolvedValue({ giocatori: 518, rimasti: 0, club: ['Alfa'], players: [], fuori: [] })
    vi.spyOn(carica, 'scaricaCalendario').mockRejectedValue(new Error('openfootball non ha ancora la stagione 2026/27 (404)'))
    vi.spyOn(carica, 'salvaDataset').mockResolvedValue(undefined)
    apri()
    await scegliFile()
    expect(box.textContent).toContain('openfootball non ha ancora la stagione')
    expect(box.textContent).toContain('anche da un csv')
    expect(bottone('Entra nella lega')).toBeDefined()        // la lega si usa lo stesso
  })

  it('le squadre non abbinate si dicono, e non fermano niente', async () => {
    vi.spyOn(carica, 'caricaListone').mockResolvedValue({ giocatori: 518, rimasti: 0, club: ['Alfa', 'Gamma'], players: [], fuori: [] })
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

/* ══ le rose arrivate dalla creazione ═══════════════════════════════
   Chi aveva già fatto l'asta ha portato il file delle rose: i nomi delle
   squadre sono già diventati la lega, e qui — con il listone dentro — i
   giocatori diventano le assegnazioni ai prezzi pagati. L'abbinamento dei
   nomi è quello vero del motore, non una copia. */
const PLAYERS = [
  [10, 'A', 'Pc', 'Punta Dieci', 'Alfa', 20, 100, 1],
  [11, 'D', 'Dc', 'Difensore Undici', 'Alfa', 8, 40, 1],
  [12, 'C', 'C', 'Centro Dodici', 'Beta', 12, 60, 1],
] as unknown as GiocatoreGrezzo[]

const ROSE: FileRose = {
  quando: 0,
  squadre: [
    { nome: 'Alfa FC', gio: [{ n: 'Punta Dieci', cr: 116 }, { n: 'Centro Dodici', cr: 54 }], totale: 170 },
    { nome: 'Beta FC', gio: [{ n: 'Difensore Undici', cr: 36 }, { n: 'Chi Sara', cr: 3 }], totale: 39 },
  ],
}

const RIGHE_ASTA: RigheLega = {
  lega: {
    id: 'l1', nome: 'Lega', stagione: '2026/27', budget: 500, slots: { P: 3, D: 8, C: 8, A: 6 },
    plan: { P: 7, D: 19, C: 32, A: 42 }, squal_on: true, voti_meta: null, rose_meta: null,
    versione: 1, aggiornata_il: '2026-09-20T10:00:00Z',
  },
  squadre: [
    { id: 11, nome: 'Alfa FC', posizione: 1, lega_idx: null, colore: null, allenatore: null },
    { id: 12, nome: 'Beta FC', posizione: 2, lega_idx: null, colore: null, allenatore: null },
  ],
  assegnazioni: [], log: [], movimenti: [], indisponibili: [], squalificheAnnullate: [], voti: [], dataset: [],
  preferenze: { mia_squadra: null, obiettivi: {}, formazioni: {} },
} as unknown as RigheLega

describe('le rose di chi aveva già fatto l\'asta', () => {
  const conListone = () => {
    vi.spyOn(carica, 'caricaListone').mockResolvedValue({ giocatori: 3, rimasti: 0, club: ['Alfa', 'Beta'], players: PLAYERS, fuori: [] })
    vi.spyOn(carica, 'scaricaCalendario').mockResolvedValue({ cal: CAL, ignote: [] })
    vi.spyOn(carica, 'salvaDataset').mockResolvedValue(undefined)
    vi.spyOn(lega, 'salvaRoseMeta').mockResolvedValue(undefined)
    return vi.spyOn(lega, 'allineaRose').mockResolvedValue({ messi: 3, tolti: 0, corretti: 0 })
  }

  it('lo dice già prima di caricare: il file è arrivato con te', () => {
    apri(true, { rose: ROSE }, RIGHE_ASTA)
    expect(box.textContent).toContain('Il file delle rose è arrivato con te')
    expect(box.textContent).toContain('2 squadre')
  })

  it('dopo il listone assegna i giocatori alla loro squadra, al prezzo pagato', async () => {
    const allinea = conListone()
    apri(true, { rose: ROSE, nomeFileRose: 'rosters.xlsx' }, RIGHE_ASTA)
    await scegliFile()
    expect(allinea).toHaveBeenCalledTimes(1)
    const righe = allinea.mock.calls[0][1]
    expect(righe.map(r => ({ pid: r.pid, squadra: r.squadra, prezzo: r.prezzo }))).toEqual([
      { pid: 10, squadra: 11, prezzo: 116 },                 // Punta Dieci, dall'Alfa FC
      { pid: 12, squadra: 11, prezzo: 54 },                  // Centro Dodici, comprato dall'Alfa FC anche se gioca nel Beta
      { pid: 11, squadra: 12, prezzo: 36 },
    ])
    expect(righe[0].snap).toEqual({ id: 10, r: 'A', n: 'Punta Dieci', s: 'Alfa', q: 20 })
  })

  it('un nome che nel listone non c\'è non ferma niente: lo dice e si va avanti', async () => {
    conListone()
    apri(true, { rose: ROSE }, RIGHE_ASTA)
    await scegliFile()
    expect(box.textContent).toContain('3 giocatori assegnati')
    expect(box.textContent).toContain('1 nome del file non corrisponde')
    expect(bottone('Entra nella lega')).toBeDefined()
  })

  it('senza rose non si assegna niente, e il passo non compare', async () => {
    const allinea = conListone()
    apri(true, undefined, RIGHE_ASTA)
    await scegliFile()
    expect(allinea).not.toHaveBeenCalled()
    expect(box.textContent).not.toContain('Rose dell\'asta')
  })

  it('se la scrittura fallisce la lega si usa lo stesso: le rose si caricano anche dopo', async () => {
    conListone()
    vi.spyOn(lega, 'allineaRose').mockRejectedValue(new Error('sola lettura: non puoi allineare le rose'))
    apri(true, { rose: ROSE }, RIGHE_ASTA)
    await scegliFile()
    expect(box.textContent).toContain('non puoi allineare le rose')
    expect(box.textContent).toContain('Rose ufficiali')
    expect(bottone('Entra nella lega')).toBeDefined()
  })
})
