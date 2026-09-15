// @vitest-environment jsdom
/* Modulo preferito e titolari fissi: sul dispositivo, una chiave per lega,
   e un valore rovinato vale come nessuna preferenza invece di rompere. */
import { beforeEach, describe, expect, it } from 'vitest'
import { moduloPreferito, salvaModuloPreferito, salvaTitolariFissi, titolariFissi } from '../src/viste/preferenze-formazione.ts'

beforeEach(() => localStorage.clear())

describe('preferenze della formazione', () => {
  it('il modulo preferito resta per lega, e si può togliere', () => {
    salvaModuloPreferito('l1', '4-4-2')
    expect(moduloPreferito('l1')).toBe('4-4-2')
    expect(moduloPreferito('l2')).toBeNull()
    salvaModuloPreferito('l1', null)
    expect(moduloPreferito('l1')).toBeNull()
  })

  it('un modulo che non esiste vale come nessuno', () => {
    localStorage.setItem('fantaregia:modulo:l1', '9-9-9')
    expect(moduloPreferito('l1')).toBeNull()
    localStorage.setItem('fantaregia:modulo:l1', '__proto__')
    expect(moduloPreferito('l1')).toBeNull()
  })

  it('i titolari fissi tengono l\'ordine in cui sono stati fissati', () => {
    salvaTitolariFissi('l1', [7, 3, 9])
    expect(titolariFissi('l1')).toEqual([7, 3, 9])
    expect(titolariFissi('l2')).toEqual([])
  })

  it('una lista rovinata vale come vuota; doppioni e voci strane si scartano', () => {
    localStorage.setItem('fantaregia:fissi:l1', '{rotto')
    expect(titolariFissi('l1')).toEqual([])
    localStorage.setItem('fantaregia:fissi:l1', JSON.stringify([3, 3, 'x', -1, 2.5, 8]))
    expect(titolariFissi('l1')).toEqual([3, 8])
  })
})
