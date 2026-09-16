/* L'interruttore della modalità asta: l'ordine del menu e la decisione
   automatica alla prima apertura, come in part5 §"Modalità asta". */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { creaMotore } from '../src/domain/motore.ts'
import { calendarioDaRighe, parseCSV, righeInGiocatori } from '../src/domain/importa.ts'
import { ORDINE, PRIME, SCHEDE, modoAuto, modoSalvato, salvaModo, type Scheda } from '../src/viste/modo.ts'
import { costruisciLega } from './lega-sintetica.ts'

const ESEMPI = fileURLToPath(new URL('../../esempi/', import.meta.url))
const players = righeInGiocatori(parseCSV(readFileSync(ESEMPI + 'listone-esempio.csv', 'utf8')))
const cal = calendarioDaRighe(parseCSV(readFileSync(ESEMPI + 'calendario-esempio.csv', 'utf8')))
const { rig, hist, shared } = costruisciLega(players, cal)

/* la suite gira in node: una memoria locale finta, quanto basta. Senza,
   modo.ts non sbaglia comunque — il try/catch la dà per assente e la
   scelta vale solo per la visita — ma qui vogliamo provare che ricorda. */
const memoria = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => memoria.get(k) ?? null,
    setItem: (k: string, v: string) => { memoria.set(k, String(v)) },
  },
})

describe('ordine del menu', () => {
  it('le stesse voci nelle due modalità, in ordine diverso', () => {
    expect([...ORDINE.asta].sort()).toEqual([...ORDINE.stagione].sort())
    expect(ORDINE.asta).not.toEqual(ORDINE.stagione)
  })

  it('in primo piano ci sono le quattro voci del momento', () => {
    /* Sul telefono queste quattro sono la barra in basso, più «Altro»:
       cambiarne una cambia cosa si tocca col pollice. In stagione viene
       prima Giornata, perché la domanda del sabato è «chi affronto», e la
       formazione si schiera sapendo quello. */
    expect(ORDINE.asta.slice(0, PRIME)).toEqual(['asta', 'listone', 'titolari', 'rose'])
    expect(ORDINE.stagione.slice(0, PRIME)).toEqual(['scontri', 'formazioni', 'infermeria', 'titolari'])
  })

  it('l\'asta è la prima con l\'interruttore acceso, l\'ultima da spento', () => {
    expect(ORDINE.asta[0]).toBe('asta')
    expect(ORDINE.stagione.at(-1)).toBe('asta')
  })
})

describe('le schede', () => {
  it('ogni voce degli ordini ha un nome e una riga che la spiega', () => {
    // il cassetto del telefono le scrive tutte: una senza spiega uscirebbe monca
    for (const k of ORDINE.stagione) {
      expect(SCHEDE[k], k).toBeDefined()
      expect(SCHEDE[k].testo.length, k).toBeGreaterThan(0)
      expect(SCHEDE[k].spiega.length, k).toBeGreaterThan(0)
    }
    expect(Object.keys(SCHEDE).sort()).toEqual([...ORDINE.stagione].sort())
  })

  it('i path delle rotte non cambiano quando cambia un\'etichetta', () => {
    /* «Lega» è diventata «Giornata», ma la rotta resta `scontri`: i link
       già in giro puntano lì. Questo test è la rete per la prossima volta
       che si rinomina una voce. */
    const path = Object.fromEntries((Object.keys(SCHEDE) as Scheda[]).map(k => [k, SCHEDE[k].path]))
    expect(path).toEqual({
      asta: 'asta', listone: 'listone', rose: 'rose', formazioni: 'formazioni', scontri: 'scontri',
      rendimento: 'rendimento', titolari: 'titolari', calendario: 'calendario', infermeria: 'infermeria', mercato: 'mercato',
    })
    expect(SCHEDE.scontri.testo).toBe('Giornata')
  })
})

describe('modoAuto', () => {
  it('con le rose non ancora piene parte in modalità asta', () => {
    // la lega sintetica ha le rose piene al 70%: l'asta non è finita
    expect(modoAuto(creaMotore({ players, cal, rig, hist, stato: shared }))).toBe('asta')
  })

  it('quando ogni squadra ha coperto i suoi slot passa alla stagione', () => {
    const finita = creaMotore({ players, cal, rig, hist, stato: { ...shared, slots: { P: 1, D: 1, C: 1, A: 1 } } })
    expect(modoAuto(finita)).toBe('stagione')
  })

  it('senza squadre non dichiara finita l\'asta', () => {
    expect(modoAuto(creaMotore({ players, cal, stato: { ...shared, teams: [], assign: {} } }))).toBe('asta')
  })
})

describe('la scelta resta sul dispositivo', () => {
  it('si ricorda per lega, e senza scelta non inventa niente', () => {
    expect(modoSalvato('lega-mai-vista')).toBeNull()
    salvaModo('l1', 'stagione')
    salvaModo('l2', 'asta')
    expect(modoSalvato('l1')).toBe('stagione')
    expect(modoSalvato('l2')).toBe('asta')
  })

  it('un valore illeggibile vale come nessuna scelta', () => {
    localStorage.setItem('fantaregia:modo:l3', 'boh')
    expect(modoSalvato('l3')).toBeNull()
  })
})
