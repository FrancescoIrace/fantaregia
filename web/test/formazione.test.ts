/* Le operazioni sulla formazione di giornata: stesse regole di lineup,
   putInSlot, syncBench e ordinaPanchina dell'app a file singolo. */
import { describe, expect, it } from 'vitest'
import { conModulo, metti, normalizza, ordinaPerRuolo, sincronizzaPanchina, sposta, usati, vuota } from '../src/domain/formazione.ts'
import type { Giocatore } from '../src/domain/tipi.ts'

const g = (id: number, r: Giocatore['r']): Giocatore => ({ id, r, n: `G${id}`, s: 'Alfa', q: 1 })

describe('formazione di giornata', () => {
  it('una formazione mancante o rotta diventa un 3-4-3 vuoto; le caselle seguono il modulo', () => {
    expect(normalizza(undefined)).toEqual(vuota('3-4-3'))
    expect(normalizza({ mod: '9-9-9' })).toEqual(vuota('3-4-3'))
    const L = { ...vuota('3-4-3'), start: { P: [1], D: [2, 3, 4], C: [5, 6, 7, 8], A: [9, 10, 11] } }
    const q = conModulo(L, '4-4-2')
    expect(q.start).toEqual({ P: [1], D: [2, 3, 4, null], C: [5, 6, 7, 8], A: [9, 10] })
    expect(usati(q)).toEqual(new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]))
  })

  it('mettere in campo chi era già in un\'altra casella dello stesso reparto scambia le due caselle', () => {
    const L = { ...vuota('3-4-3'), start: { ...vuota('3-4-3').start, D: [1, 2, null] } }
    expect(metti(L, 'D', 2, 1).start.D).toEqual([null, 2, 1])
    expect(metti(L, 'D', 1, 7).start.D).toEqual([1, 7, null])
    expect(L.start.D).toEqual([1, 2, null])          // l'originale non si tocca
  })

  it('la panchina tiene l\'ordine scelto, perde chi è entrato, e accoda i nuovi per reparto e punteggio', () => {
    const rosa = [g(1, 'P'), g(2, 'D'), g(3, 'D'), g(4, 'C'), g(5, 'A'), g(6, 'P')]
    const punti: Record<number, number> = { 1: 50, 2: 40, 3: 70, 4: 60, 5: 80, 6: 30 }
    const L = { ...vuota('3-4-3'), start: { ...vuota('3-4-3').start, P: [1] }, bench: [5, 99, 1, 2] }
    expect(sincronizzaPanchina(L, rosa, p => punti[p.id])).toEqual([5, 2, 6, 3, 4])
  })

  it('frecce e «Ordina per ruolo»', () => {
    expect(sposta([1, 2, 3], 0, -1)).toEqual([1, 2, 3])
    expect(sposta([1, 2, 3], 0, 1)).toEqual([2, 1, 3])
    const ruolo: Record<number, Giocatore['r']> = { 1: 'A', 2: 'P', 3: 'D', 4: 'D' }
    expect(ordinaPerRuolo([1, 2, 3, 4, 99], id => ruolo[id], id => ({ 3: 10, 4: 20 } as Record<number, number>)[id] ?? 0)).toEqual([2, 4, 3, 1, 99])
  })
})
