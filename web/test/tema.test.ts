// @vitest-environment jsdom
/* Il tema scelto da chi guarda: resta sul dispositivo, «come il sistema»
   vuol dire nessun attributo, e il marchio si ricorregge sul fondo nuovo. */
import { beforeEach, describe, expect, it } from 'vitest'
import { scegliTema, temaSalvato } from '../src/viste/tema.ts'
import { usaTinta } from '../src/viste/colore-squadra.ts'

const radice = document.documentElement
const marchio = () => radice.style.getPropertyValue('--fr-marchio')

beforeEach(() => {
  localStorage.clear()
  delete radice.dataset.tema
  // i due fondi dei token, quanto basta a far lavorare la correzione
  document.head.innerHTML = '<style>:root{--fr-pan:#1A232B} :root[data-tema="giorno"]{--fr-pan:#FFFFFF}</style>'
  usaTinta(null)
})

describe('il tema', () => {
  it('senza scelta segue il sistema: nessun attributo e niente in memoria', () => {
    expect(temaSalvato()).toBeNull()
    expect(radice.dataset.tema).toBeUndefined()
  })

  it('una scelta esplicita scrive l\'attributo e resta sul dispositivo', () => {
    scegliTema('giorno')
    expect(radice.dataset.tema).toBe('giorno')
    expect(temaSalvato()).toBe('giorno')
  })

  it('tornare a «come il sistema» toglie attributo e memoria', () => {
    scegliTema('notte')
    scegliTema(null)
    expect(radice.dataset.tema).toBeUndefined()
    expect(temaSalvato()).toBeNull()
  })

  it('in memoria valgono solo notte e giorno', () => {
    localStorage.setItem('fantaregia:tema', 'viola')
    expect(temaSalvato()).toBeNull()
  })

  it('la barra del browser segue il tema', () => {
    /* Il meta theme-color non legge i token: senza qualcuno che lo riscriva
       resta al valore di index.html, cioè il pannello del notte, anche sul
       tema giorno. Vale --fr-pan, quello che sta appena sotto la barra. */
    const colore = () => document.head.querySelector('meta[name="theme-color"]')?.getAttribute('content')
    scegliTema('notte')
    expect(colore()).toBe('#1A232B')
    scegliTema('giorno')
    expect(colore()).toBe('#FFFFFF')
  })

  it('cambiando tema il marchio si ricorregge sul fondo nuovo', () => {
    /* L'ambra sul pannello notte regge da sola (8,4:1); sul bianco va
       scurita. Se la tinta si riapplicasse prima di cambiare attributo,
       sul giorno resterebbe l'ambra chiara, a 1,9:1. */
    scegliTema('notte')
    const notte = marchio()
    scegliTema('giorno')
    expect(notte.toUpperCase()).toBe('#F2B03D')
    expect(marchio().toUpperCase()).not.toBe('#F2B03D')
  })
})
