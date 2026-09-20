// @vitest-environment jsdom
/* Il file degli indisponibili su tutte le leghe che gestisci: una proposta
   per lega, calcolata con il listone e gli infortunati di quella lega; la
   scrittura solo dove serve e solo dove hai scelto; un errore in una lega che
   non ferma le altre. Il file è un csv vero, letto da righeDaFile() com'è. */
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Leghe from '../src/pagine/Leghe.tsx'
import InfortuniLeghe from '../src/pagine/InfortuniLeghe.tsx'
import * as lega from '../src/data/lega.ts'
import { preparaLega } from '../src/data/infortuni-leghe.ts'
import { ingressoMotore, type RigheLega } from '../src/data/componi.ts'
import { supabase } from '../src/lib/supabase.ts'
import { creaMotore } from '../src/domain/motore.ts'
import {
  contestoLega, leggiFileIndisponibili, proponi, riassuntoProposta, segnalazioni, vociDaScrivere,
} from '../src/domain/indisponibili.ts'
import type { GiocatoreGrezzo } from '../src/domain/tipi.ts'

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const PLAYERS = [
  [10, 'A', 'Pc', 'Punta Dieci', 'Alfa', 20, 100, 1],
  [11, 'D', 'Dc', 'Difensore Undici', 'Alfa', 8, 40, 1],
  [12, 'C', 'C', 'Centro Dodici', 'Beta', 12, 60, 1],
] as unknown as GiocatoreGrezzo[]

const legaFinta = (id: string, over: Partial<RigheLega> = {}, listone: GiocatoreGrezzo[] | null = PLAYERS) => ({
  lega: {
    id, nome: id, stagione: '2026/27', budget: 500, slots: { P: 3, D: 8, C: 8, A: 6 },
    plan: { P: 7, D: 19, C: 32, A: 42 }, squal_on: true, voti_meta: null, rose_meta: null, versione: 1, aggiornata_il: '',
  },
  squadre: [], assegnazioni: [], log: [], movimenti: [], indisponibili: [], squalificheAnnullate: [], voti: [],
  dataset: listone ? [{ tipo: 'listone', dati: listone, meta: {} }] : [],
  preferenze: null, ...over,
}) as unknown as RigheLega

/* Sabati: nessuno fuori. Domeniche: Difensore Undici è già fuori, con una nota vecchia. */
const SABATI = legaFinta('Sabati')
const DOMENICHE = legaFinta('Domeniche', {
  indisponibili: [{ giocatore_id: 11, motivo: 'infortunio', da_giornata: 4, segnato_il: '2026-09-17T10:00:00Z', nota: 'vecchia nota' }],
})
const SENZA_LISTONE = legaFinta('Vuota', {}, null)

const CSV = ['nome;stato;nota', 'Punta Dieci;infortunio;adduttore', 'Difensore Undici;rientrato;torna in gruppo', 'Nessuno Qui;infortunio;'].join('\n')
const voci = leggiFileIndisponibili([['nome', 'stato', 'nota'], ...CSV.split('\n').slice(1).map(r => r.split(';'))])

describe('le parti condivise con Infermeria', () => {
  const mSab = creaMotore(ingressoMotore(SABATI))
  const mDom = creaMotore(ingressoMotore(DOMENICHE))
  const prop = (m: typeof mSab) => { const c = contestoLega(m); return proponi(voci, c.giocatori, c.fuoriOra) }

  it('contestoLega: chi è già fuori lo dice con motivo e nota, chi non lo è null', () => {
    expect(contestoLega(mDom).fuoriOra(11)).toEqual({ motivo: 'infortunio', nota: 'vecchia nota' })
    expect(contestoLega(mDom).fuoriOra(10)).toBeNull()
  })

  it('la stessa riga vale cose diverse in due leghe: entra in una, rientra nell\'altra', () => {
    const s = prop(mSab), d = prop(mDom)
    expect(s.rientrano).toHaveLength(0)
    expect(s.nonFuori.map(x => x.p.n)).toEqual(['Difensore Undici'])        // rientrato ma non era fuori: segnalato, non un errore
    expect(d.rientrano.map(x => x.p.n)).toEqual(['Difensore Undici'])
    expect(s.entrano.map(x => x.p.n)).toEqual(['Punta Dieci'])
    expect(d.entrano.map(x => x.p.n)).toEqual(['Punta Dieci'])
  })

  it('vociDaScrivere: chi entra parte dalla prossima giornata, chi rientra porta la nota del file', () => {
    const { fuori, rientrati } = vociDaScrivere(prop(mDom), mDom, 7)
    expect(fuori).toEqual([{ giocatore_id: 10, motivo: 'infortunio', nota: 'adduttore', da_giornata: 7 }])
    expect(rientrati).toEqual([{ giocatore_id: 11, nota: 'torna in gruppo' }])
  })

  it('un già fuori che cambia nota tiene la giornata da cui lo è, non quella di oggi', () => {
    const c = contestoLega(mDom)
    const aggiorna = proponi(leggiFileIndisponibili([['n', 's', 'nota'], ['Difensore Undici', 'infortunio', 'nuova nota']]), c.giocatori, c.fuoriOra)
    expect(vociDaScrivere(aggiorna, mDom, 9).fuori).toEqual([{ giocatore_id: 11, motivo: 'infortunio', nota: 'nuova nota', da_giornata: 4 }])
  })

  it('riassuntoProposta e segnalazioni: solo le parti che ci sono, singolare e plurale', () => {
    const d = prop(mDom)
    expect(riassuntoProposta(d)).toEqual(['1 in infermeria', '1 rientrati'])
    expect(segnalazioni(d)).toEqual(['1 nome non riconosciuto'])
    expect(segnalazioni({ ...d, nonTrovati: [...d.nonTrovati, ...d.nonTrovati] })).toEqual(['2 nomi non riconosciuti'])
    expect(riassuntoProposta({ ...d, entrano: [], rientrano: [] })).toEqual([])
  })
})

describe('preparaLega', () => {
  beforeEach(() => {
    vi.spyOn(lega, 'caricaRighe').mockImplementation(async id => {
      if (id === 'Guasta') throw new Error('permission denied')
      return ({ Sabati: SABATI, Domeniche: DOMENICHE, Vuota: SENZA_LISTONE } as Record<string, RigheLega>)[id]
    })
  })
  afterEach(() => vi.restoreAllMocks())

  it('una lega con il suo listone: proposta e cosa scrivere', async () => {
    const p = await preparaLega({ id: 'Domeniche', nome: 'Domeniche' }, 'u1', voci)
    expect(p.stato).toBe('pronta')
    if (p.stato !== 'pronta') return
    expect(p.fuori.map(x => x.giocatore_id)).toEqual([10])
    expect(p.rientrati.map(x => x.giocatore_id)).toEqual([11])
    expect(p.notaMancante).toBe(false)
  })

  it('senza listone dice che manca, invece di dichiarare «non riconosciuto» ogni nome del file', async () => {
    expect((await preparaLega({ id: 'Vuota', nome: 'Vuota' }, 'u1', voci)).stato).toBe('senza-listone')
  })

  it('una lega che non si legge torna come errore di quella lega, non fa cadere le altre', async () => {
    const p = await preparaLega({ id: 'Guasta', nome: 'Guasta' }, 'u1', voci)
    expect(p).toMatchObject({ stato: 'errore', testo: 'permission denied' })
  })
})

describe('il pannello', () => {
  let radice: Root, box: HTMLDivElement
  const LEGHE = [{ id: 'Sabati', nome: 'Sabati' }, { id: 'Domeniche', nome: 'Domeniche' }]
  let scrittura: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    box = document.createElement('div'); document.body.appendChild(box); radice = createRoot(box)
    vi.spyOn(lega, 'caricaRighe').mockImplementation(async id => {
      if (id === 'Guasta') throw new Error('permission denied')
      return ({ Sabati: SABATI, Domeniche: DOMENICHE, Vuota: SENZA_LISTONE } as Record<string, RigheLega>)[id]
    })
    scrittura = vi.spyOn(lega, 'importaIndisponibili').mockResolvedValue({ storico: true })
  })
  afterEach(() => { act(() => radice.unmount()); box.remove(); vi.restoreAllMocks() })

  const apri = (leghe = LEGHE) => act(() => radice.render(createElement(MemoryRouter, null,
    createElement(InfortuniLeghe, { utenteId: 'u1', leghe }))))
  const carica = async (testo = CSV) => {
    const input = box.querySelector<HTMLInputElement>('input[type=file]')!
    Object.defineProperty(input, 'files', { value: [new File([testo], 'indisponibili.csv', { type: 'text/csv' })], configurable: true })
    await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })) })
  }
  const bottone = (re: RegExp) => [...box.querySelectorAll('button')].find(b => re.test(b.textContent ?? ''))!
  const spunta = (nome: string) => box.querySelector<HTMLInputElement>(`input[aria-label="Applica a ${nome}"]`)!
  const premi = async (re: RegExp) => { await act(async () => { bottone(re).click() }) }

  it('legge il file e dice cosa succederebbe in ogni lega, senza scrivere niente', async () => {
    apri()
    await carica()
    expect(box.textContent).toContain('3 cambiamenti in 2 leghe')
    expect(box.textContent).toContain('Sabati')
    expect(box.textContent).toContain('1 in infermeria')                      // Sabati
    expect(box.textContent).toContain('1 in infermeria · 1 rientrati')        // Domeniche
    expect(scrittura).not.toHaveBeenCalled()
  })

  it('quello che non torna resta indicato per lega, con il modo di arrivarci', async () => {
    apri()
    await carica()
    expect(box.textContent).toContain('Da sistemare a mano: 1 nome non riconosciuto')
    expect(box.querySelector('a[href="/lega/Sabati/infermeria"]')).not.toBeNull()
    expect(box.querySelector('a[href="/lega/Domeniche/infermeria"]')).not.toBeNull()
  })

  it('Applica scrive in ogni lega scelta, con le voci di quella lega', async () => {
    apri()
    await carica()
    await premi(/^Applica \(3\)/)
    expect(scrittura).toHaveBeenCalledTimes(2)
    expect(scrittura).toHaveBeenCalledWith('Sabati',
      [{ giocatore_id: 10, motivo: 'infortunio', nota: 'adduttore', da_giornata: expect.any(Number) }], [], true)
    expect(scrittura).toHaveBeenCalledWith('Domeniche',
      [{ giocatore_id: 10, motivo: 'infortunio', nota: 'adduttore', da_giornata: expect.any(Number) }],
      [{ giocatore_id: 11, nota: 'torna in gruppo' }], true)
    expect(box.textContent).toContain('Sabati: 1 in infermeria')
    expect(box.textContent).toContain('Domeniche: 1 in infermeria, 1 rientrati')
  })

  it('una lega tolta dalla spunta non si tocca, e il conto scende', async () => {
    apri()
    await carica()
    act(() => spunta('Sabati').click())
    expect(box.textContent).toContain('2 cambiamenti in 1 lega')
    await premi(/^Applica \(2\)/)
    expect(scrittura).toHaveBeenCalledTimes(1)
    expect(scrittura.mock.calls[0][0]).toBe('Domeniche')
  })

  it('senza nessuna lega scelta Applica è spento: non si scrive niente per sbaglio', async () => {
    apri()
    await carica()
    act(() => spunta('Sabati').click()); act(() => spunta('Domeniche').click())
    expect((bottone(/^Applica/) as HTMLButtonElement).disabled).toBe(true)
  })

  it('una lega senza listone o che non si legge si salta, e non ferma le altre', async () => {
    apri([...LEGHE, { id: 'Vuota', nome: 'Vuota' }, { id: 'Guasta', nome: 'Guasta' }])
    await carica()
    expect(box.textContent).toContain('senza listone')
    expect(box.textContent).toContain('non riesco a leggerla — permission denied')
    expect(spunta('Vuota').disabled).toBe(true)
    expect(spunta('Guasta').disabled).toBe(true)
    await premi(/^Applica \(3\)/)
    expect(scrittura).toHaveBeenCalledTimes(2)                                // solo le due buone
  })

  it('se la scrittura fallisce in una lega, le altre vanno avanti e l\'esito dice dov\'è successo', async () => {
    scrittura.mockImplementation(async (id: string) => { if (id === 'Sabati') throw new Error('sola lettura'); return { storico: true } })
    apri()
    await carica()
    await premi(/^Applica/)
    expect(scrittura).toHaveBeenCalledTimes(2)
    expect(box.textContent).toContain('Sabati: non applicato — sola lettura')
    expect(box.textContent).toContain('Domeniche: 1 in infermeria, 1 rientrati')
  })

  it('un file senza nessuna riga con un nome lo dice, non scrive niente e lascia riprovare', async () => {
    apri()
    await carica('nome;stato;nota')
    expect(scrittura).not.toHaveBeenCalled()
    expect(box.textContent).toContain("indisponibili.csv: nel file non c'è nessuna riga con un nome")
    expect(box.querySelector('input[type=file]')).not.toBeNull()              // si può riprovare
  })

  it('un file con righe ma senza stati validi non è un errore: la proposta li elenca fra quelli da sistemare', async () => {
    apri()
    await carica('colonna\nnessun nome qui')
    expect(scrittura).not.toHaveBeenCalled()
    expect(box.textContent).toContain('niente da applicare')
    expect(box.textContent).toContain('2 stati che non capisco')        // senza intestazione anche la prima riga è un dato
  })
})

describe('quando compare nella dashboard', () => {
  let radice: Root, box: HTMLDivElement
  beforeEach(() => { box = document.createElement('div'); document.body.appendChild(box); radice = createRoot(box) })
  afterEach(() => { act(() => radice.unmount()); box.remove(); vi.restoreAllMocks() })

  const conRuoli = async (ruoli: string[]) => {
    const data = ruoli.map((ruolo, i) => ({ ruolo, lega: { id: `l${i}`, nome: `Lega ${i}`, stagione: '2026/27' } }))
    vi.spyOn(supabase, 'from').mockReturnValue({ select: () => ({ eq: () => Promise.resolve({ data, error: null }) }) } as never)
    await act(async () => radice.render(createElement(MemoryRouter, null, createElement(Leghe, { utenteId: 'u1' }))))
  }

  it('con due leghe che gestisci c\'è, e ne conta due', async () => {
    await conRuoli(['admin', 'banditore'])
    expect(box.textContent).toContain('Infortunati di tutte le tue leghe')
    expect(box.textContent).toContain('2 leghe')
  })

  it('le leghe in cui sei solo allenatore non contano: lì non puoi scrivere', async () => {
    await conRuoli(['admin', 'lettore', 'lettore'])
    expect(box.textContent).not.toContain('Infortunati di tutte le tue leghe')
  })

  it('con una lega sola basta la scheda Infermeria: il pannello non compare', async () => {
    await conRuoli(['admin'])
    expect(box.textContent).not.toContain('Infortunati di tutte le tue leghe')
  })
})
