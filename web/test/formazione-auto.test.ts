/* Il generatore di formazione con i vincoli di chi guarda: modulo, titolari
   fissi, e le note quando qualcosa non torna. Senza vincoli deve scegliere
   esattamente come formazioneAutomatica() del motore, che è il port 1:1. */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { descriviNota, generaFormazione, moduloVicino } from '../src/domain/formazione.ts'
import { creaMotore, MODULI, ROLES } from '../src/domain/motore.ts'
import { calendarioDaRighe, parseCSV, righeInGiocatori } from '../src/domain/importa.ts'
import { costruisciLega } from './lega-sintetica.ts'
import type { Giocatore } from '../src/domain/tipi.ts'

const ESEMPI = fileURLToPath(new URL('../../esempi/', import.meta.url))
const players = righeInGiocatori(parseCSV(readFileSync(ESEMPI + 'listone-esempio.csv', 'utf8')))
const cal = calendarioDaRighe(parseCSV(readFileSync(ESEMPI + 'calendario-esempio.csv', 'utf8')))
const { rig, hist, shared } = costruisciLega(players, cal)
const m = creaMotore({ players, cal, rig, hist, stato: shared, me: { myTeam: 3 } })
const R = m.roster(m.meId())
const rosa = ROLES.flatMap(r => R[r].map(x => x.p))
const opzioni = (g: number, fissi: number[] = []) =>
  ({ punteggio: (p: Giocatore) => m.dayScore(p, g), indisponibile: (id: number) => m.isOut(id), fissi })
const gio = (id: number, r: Giocatore['r']): Giocatore => ({ id, r, n: `G${id}`, s: 'Alfa', q: 1 })

describe('senza vincoli è formazioneAutomatica()', () => {
  it('stessi titolari e stessa panchina, per ogni modulo e su più giornate', () => {
    for (const g of [1, m.giornataOggi(), 20]) {
      for (const mod of Object.keys(MODULI)) {
        expect(generaFormazione(rosa, mod, opzioni(g)).formazione, `${mod}, giornata ${g}`).toEqual(m.formazioneAutomatica(g, mod))
      }
    }
  })
})

describe('titolari fissi', () => {
  const g = m.giornataOggi()
  const difensori = R.D.map(x => x.p).filter(p => !m.isOut(p.id)).sort((a, b) => m.dayScore(a, g) - m.dayScore(b, g))

  it('un fisso va in campo anche se il punteggio lo lascerebbe fuori', () => {
    const ultimo = difensori[0]
    expect(m.formazioneAutomatica(g, '3-4-3').start.D).not.toContain(ultimo.id)
    const { formazione, note } = generaFormazione(rosa, '3-4-3', opzioni(g, [ultimo.id]))
    expect(formazione.start.D).toContain(ultimo.id)
    expect(formazione.bench).not.toContain(ultimo.id)
    expect(note).toEqual([])
  })

  it('troppi fissi per il reparto: entrano i primi fissati, gli altri restano fuori e lo si dice', () => {
    const [a, b, c, d] = difensori
    const { formazione, note } = generaFormazione(rosa, '3-4-3', opzioni(g, [a.id, b.id, c.id, d.id]))
    expect(formazione.start.D).toEqual([a.id, b.id, c.id])
    expect(note).toEqual([{ tipo: 'fissi-troppi', mod: '3-4-3', r: 'D', fuori: [d.id] }])
    expect(formazione.bench).toContain(d.id)
  })

  it('un fisso indisponibile non si schiera, e non sparisce in silenzio', () => {
    const piena = [gio(1, 'P'), gio(2, 'D'), gio(3, 'D'), gio(4, 'D'), gio(5, 'D'), gio(6, 'C'), gio(7, 'C'), gio(8, 'C'), gio(9, 'C'),
      gio(10, 'A'), gio(11, 'A'), gio(12, 'A')]
    const { formazione, note } = generaFormazione(piena, '3-4-3', { punteggio: () => 50, indisponibile: id => id === 2, fissi: [2] })
    expect(formazione.start.D).toEqual([3, 4, 5])
    expect(note).toEqual([{ tipo: 'fisso-indisponibile', pid: 2 }])
  })

  it('un fisso che non è più in rosa si ignora', () => {
    expect(generaFormazione(rosa, '3-4-3', opzioni(g, [999999])).formazione).toEqual(m.formazioneAutomatica(g, '3-4-3'))
  })
})

describe('un modulo che la rosa non copre', () => {
  const corta = [gio(1, 'P'), gio(2, 'D'), gio(3, 'D'), gio(4, 'D'), gio(5, 'C'), gio(6, 'C'), gio(7, 'C'), gio(8, 'C'), gio(9, 'C'),
    gio(10, 'A'), gio(11, 'A')]
  const opz = { punteggio: () => 50, indisponibile: () => false }

  it('le caselle scoperte restano vuote, e si propone il modulo più vicino che la rosa copre', () => {
    const { formazione, note } = generaFormazione(corta, '4-4-2', opz)
    expect(formazione.start.D).toEqual([2, 3, 4, null])
    expect(note).toEqual([{ tipo: 'modulo-scoperto', mod: '4-4-2', manca: { D: 1 }, proposto: '3-5-2' }])
  })

  it('con il modulo proposto la formazione è completa', () => {
    const { formazione, note } = generaFormazione(corta, '3-5-2', opz)
    expect(note).toEqual([])
    expect(ROLES.flatMap(r => formazione.start[r]).every(x => x !== null)).toBe(true)
  })

  it('gli indisponibili non contano per coprire il modulo', () => {
    expect(generaFormazione(corta, '3-5-2', { ...opz, indisponibile: id => id === 2 }).note)
      .toEqual([{ tipo: 'modulo-scoperto', mod: '3-5-2', manca: { D: 1 }, proposto: null }])
  })

  it('senza un portiere nessun modulo è completo', () => {
    expect(moduloVicino({ P: 0, D: 8, C: 8, A: 6 }, '4-4-2')).toBeNull()
  })
})

describe('le note si leggono', () => {
  const nome = (id: number) => ({ 7: 'Lookman', 8: 'Retegui' } as Record<number, string>)[id] ?? `#${id}`
  it('una frase per nota, con i nomi', () => {
    expect(descriviNota({ tipo: 'modulo-scoperto', mod: '4-4-2', manca: { D: 1 }, proposto: '3-5-2' }, nome))
      .toBe('Il 4-4-2 non si può schierare: manca 1 difensore disponibile. Il modulo più vicino che la rosa copre è il 3-5-2.')
    expect(descriviNota({ tipo: 'modulo-scoperto', mod: '3-4-3', manca: { A: 2 }, proposto: null }, nome))
      .toBe('Il 3-4-3 non si può schierare: mancano 2 attaccanti disponibili. Nessun modulo è completo con i giocatori disponibili.')
    expect(descriviNota({ tipo: 'fissi-troppi', mod: '4-5-1', r: 'A', fuori: [8] }, nome))
      .toBe('Troppi titolari fissi in attacco per il 4-5-1: Retegui resta fuori.')
    expect(descriviNota({ tipo: 'fisso-indisponibile', pid: 7 }, nome))
      .toBe('Lookman è un titolare fisso, ma è segnato indisponibile: non l\'ho schierato.')
  })
})
