// @vitest-environment jsdom
/* La formazione come immagine: dove stanno i giocatori, cosa finisce
   scritto, e come si condivide. Il disegno vero lo fa un canvas che jsdom
   non ha: qui lo sostituisce un contesto che registra le chiamate, e si
   controlla che ogni nome e ogni punteggio siano davvero nell'immagine. */
import { readFileSync } from 'node:fs'
// in jsdom URL è quello del browser finto: per i file serve quello di Node
import { fileURLToPath, URL as NodeURL } from 'node:url'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  altezza, condividiImmagine, disegnaFormazione, disposizione, LARGHEZZA, leggiColori, type Colori, type DatiImmagine, type GiocatoreImmagine,
} from '../src/viste/immagine-formazione.ts'
import Formazioni from '../src/pagine/Formazioni.tsx'
import { MODULI, creaMotore } from '../src/domain/motore.ts'
import { calendarioDaRighe, parseCSV, righeInGiocatori } from '../src/domain/importa.ts'
import { costruisciLega } from './lega-sintetica.ts'
import type { RigheLega } from '../src/data/componi.ts'
import type { Ruolo } from '../src/domain/tipi.ts'

const g = (nome: string, ruolo: Ruolo, punti: number, fuori = false): GiocatoreImmagine => ({ nome, ruolo, punti: fuori ? null : punti, fuori })
const campoDi = (mod: string): DatiImmagine['campo'] => {
  const [d, c, a] = MODULI[mod]
  const reparto = (r: Ruolo, n: number) => Array.from({ length: n }, (_, i) => g(`${r}${i + 1}`, r, 60 + i))
  return { P: reparto('P', 1), D: reparto('D', d), C: reparto('C', c), A: reparto('A', a) }
}
const dati = (over: Partial<DatiImmagine> = {}): DatiImmagine => ({
  squadra: 'Regia FC', lega: 'Lega dei Sabati', giornata: 5, data: '21/09/26', modulo: '3-4-3', media: 71,
  campo: campoDi('3-4-3'), panchina: [g('Nevfonzo', 'P', 61), g('Rinsessi', 'C', 0, true), g('Cenrasco', 'A', 70)], ...over,
})
const COLORI = Object.fromEntries(['fondo', 'pan', 'incasso', 'filo', 'ink', 'fioco', 'marchio', 'marchioInk', 'giu', 'erba', 'erba2', 'erbaLinea']
  .map(k => [k, '#000000'])) as unknown as Colori

describe('dove stanno i giocatori', () => {
  it.each(Object.keys(MODULI))('%s: undici maglie dentro l\'immagine, dal fondo verso chi guarda', mod => {
    const d = disposizione(campoDi(mod))
    expect(d).toHaveLength(11)
    for (const p of d) {
      expect(p.x).toBeGreaterThan(60); expect(p.x).toBeLessThan(LARGHEZZA - 60)
      expect(p.y).toBeGreaterThan(210 + 92)                  // la maglia sta sopra il punto, e non entra nella testa
    }
    // ordinati per altezza: chi è più in basso si disegna dopo e copre chi sta dietro
    expect(d.map(p => p.y)).toEqual([...d.map(p => p.y)].sort((a, b) => a - b))
    // due giocatori non stanno mai nello stesso punto
    expect(new Set(d.map(p => `${Math.round(p.x)},${Math.round(p.y)}`)).size).toBe(11)
  })

  it('il portiere è il più vicino a chi guarda, gli attaccanti i più lontani', () => {
    const d = disposizione(campoDi('4-3-3'))
    expect(d.at(-1)!.ruolo === 'P' || d.slice(-3).some(p => p.ruolo === 'P')).toBe(true)
    const media = (r: Ruolo) => { const x = d.filter(p => p.ruolo === r); return x.reduce((s, p) => s + p.y, 0) / x.length }
    expect(media('P')).toBeGreaterThan(media('D'))
    expect(media('D')).toBeGreaterThan(media('C'))
    expect(media('C')).toBeGreaterThan(media('A'))
  })

  it('l\'immagine si allunga con la panchina', () => {
    expect(altezza(dati({ panchina: Array(12).fill(g('x', 'C', 1)) }))).toBeGreaterThan(altezza(dati()))
  })
})

describe('cosa c\'è scritto', () => {
  /* un contesto che non disegna niente e ricorda tutto quello che scrive */
  function registratore() {
    const scritti: string[] = []
    const ctx = new Proxy({}, {
      get: (_, k) => (k === 'fillText' ? (t: string) => { scritti.push(t) } : () => {}),
      set: () => true,
    }) as unknown as CanvasRenderingContext2D
    return { ctx, scritti }
  }

  it('squadra, giornata, modulo, media; ogni titolare col suo punteggio; la panchina in ordine', () => {
    const { ctx, scritti } = registratore()
    const d = dati()
    disegnaFormazione(ctx, d, COLORI)
    expect(scritti).toContain('Regia FC')
    expect(scritti).toContain('Lega dei Sabati · 5ª giornata · 21/09/26 · 3-4-3')
    expect(scritti).toContain('71')
    for (const r of ['P', 'D', 'C', 'A'] as Ruolo[]) for (const x of d.campo[r]) {
      expect(scritti, x!.nome).toContain(x!.nome)
      expect(scritti, `${x!.nome} punti`).toContain(String(x!.punti))
    }
    // la panchina: numero d'ordine, nome, punteggio; chi è fuori ha il trattino
    const i = scritti.indexOf('Nevfonzo')
    expect(scritti.slice(i - 2, i + 2)).toEqual(['1', 'P', 'Nevfonzo', '61'])
    expect(scritti.slice(scritti.indexOf('Rinsessi'), scritti.indexOf('Rinsessi') + 2)).toEqual(['Rinsessi', '—'])
  })

  it('una casella vuota ha il segno più, un indisponibile il trattino; i nomi lunghi si accorciano', () => {
    const { ctx, scritti } = registratore()
    const campo = campoDi('3-4-3')
    campo.A[1] = null
    campo.D[0] = g('Rusloler', 'D', 0, true)
    campo.C[0] = g('Theo Hernandez Junior', 'C', 80)
    disegnaFormazione(ctx, dati({ campo }), COLORI)
    expect(scritti).toContain('+')
    expect(scritti).toContain('—')
    expect(scritti).toContain('Theo Hernan.')
  })
})

describe('i colori sono i token del tema', () => {
  it('leggiColori li prende dal documento', () => {
    document.head.innerHTML = '<style>:root{--fr-marchio:#3E7BD6;--fr-marchio-ink:#FFFFFF;--fr-erba:#183A2E}</style>'
    const c = leggiColori()
    expect(c.marchio).toBe('#3E7BD6')
    expect(c.marchioInk).toBe('#FFFFFF')
    expect(c.erba).toBe('#183A2E')
  })
})

describe('condividere', () => {
  const blob = new Blob(['png'], { type: 'image/png' })
  afterEach(() => { vi.restoreAllMocks(); Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true }) })
  const conCondivisione = (share: (d: ShareData) => Promise<void>) => {
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true })
    Object.defineProperty(navigator, 'share', { value: share, configurable: true })
  }

  it('dove si può, apre il pannello di condivisione con il file', async () => {
    const share = vi.fn(async (_d: ShareData) => {})
    conCondivisione(share)
    expect(await condividiImmagine(blob, 'formazione-giornata-5.png', 'Regia FC')).toBe('condivisa')
    const arg = share.mock.calls[0][0] as ShareData
    expect(arg.files![0].name).toBe('formazione-giornata-5.png')
    expect(arg.files![0].type).toBe('image/png')
  })

  it('chiudere il pannello non è un errore, e non scarica niente', async () => {
    conCondivisione(async () => { throw new DOMException('annullato', 'AbortError') })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    expect(await condividiImmagine(blob, 'f.png', 't')).toBe('annullata')
    expect(click).not.toHaveBeenCalled()
  })

  it('dove non si può condividere un file, si scarica', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:prova')
    URL.revokeObjectURL = vi.fn()
    let scaricato = ''
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { scaricato = this.download })
    expect(await condividiImmagine(blob, 'formazione-giornata-5.png', 't')).toBe('scaricata')
    expect(scaricato).toBe('formazione-giornata-5.png')
  })
})

describe('il pulsante in Formazioni', () => {
  const ESEMPI = fileURLToPath(new NodeURL('../../esempi/', import.meta.url))
  const players = righeInGiocatori(parseCSV(readFileSync(ESEMPI + 'listone-esempio.csv', 'utf8')))
  const cal = calendarioDaRighe(parseCSV(readFileSync(ESEMPI + 'calendario-esempio.csv', 'utf8')))
  const { rig, hist, shared } = costruisciLega(players, cal)
  const m = creaMotore({ players, cal, rig, hist, stato: shared, me: { myTeam: 3 } })
  const gg = m.giornataOggi()
  const disegna = (formazioni: Record<string, unknown>, telefono: boolean) => renderToString(createElement(MemoryRouter, null,
    createElement(Formazioni, {
      legaId: 'l1', utenteId: 'u1', motore: m, telefono,
      righe: { squadre: [], preferenze: { mia_squadra: 3, obiettivi: {}, formazioni } } as unknown as RigheLega,
    })))
  const bottone = (html: string) => /<button[^>]*title="La formazione e la panchina come immagine[^"]*"[^>]*>/.exec(html)?.[0] ?? ''

  it.each([false, true])('c\'è da scrivania e sul telefono (telefono: %s), attivo con una formazione schierata', telefono => {
    const html = disegna({ [gg]: m.formazioneAutomatica(gg, '3-4-3') }, telefono)
    expect(html).toContain('>Condividi<')
    expect(bottone(html)).not.toMatch(/\sdisabled=""/)          // l'attributo, non le classi disabled:… di Tailwind
  })

  it('senza nessuno in campo è spento: non c\'è niente da condividere', () => {
    expect(bottone(disegna({}, false))).toMatch(/\sdisabled=""/)
  })
})
