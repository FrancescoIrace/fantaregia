// @vitest-environment jsdom
/* Il colore squadra: la tinta scelta dall'utente deve restare quella, e
   restare leggibile su tutti e due i temi. Qui si misura, non si guarda —
   ogni numero di questo file è la ragione per cui una regola esiste. */
import { describe, expect, it } from 'vitest'
import {
  applicaColoreSquadra, contrasto, controlla, correggi, fondoChiaro, inchiostroSopra, luminosita,
  saturazione, TINTE_PRONTE, tintaLibera, tonalita, velo,
} from '../src/viste/colore-squadra.ts'

const PAN_NOTTE = '#1A232B', PAN_GIORNO = '#FFFFFF'
const SU = '#5FD09B', GIU = '#F0685C'
const CONTRASTO_MINIMO = 3.6
const distanza = (a: number, b: number) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d }

describe('correzione della tinta', () => {
  it('ogni tinta pronta arriva al contrasto minimo, su entrambi i temi', () => {
    for (const [hex, nome] of TINTE_PRONTE) {
      for (const fondo of [PAN_NOTTE, PAN_GIORNO]) {
        const { usata } = correggi(hex, fondo)
        expect(contrasto(usata, fondo), `${nome} su ${fondo}`).toBeGreaterThanOrEqual(CONTRASTO_MINIMO)
      }
    }
  })

  it('la tonalità scelta non si muove: cambia solo la luminosità', () => {
    for (const [hex, nome] of TINTE_PRONTE) {
      if (saturazione(hex) < .18) continue           // un grigio non ha tonalità da conservare
      for (const fondo of [PAN_NOTTE, PAN_GIORNO]) {
        const { usata } = correggi(hex, fondo)
        expect(distanza(tonalita(usata), tonalita(hex)), `${nome} su ${fondo}`).toBeLessThanOrEqual(2)
      }
    }
  })

  it('il verso lo decide il fondo, non il tema dichiarato', () => {
    /* Il caso che rompeva tutto: sistema in tema chiaro alla prima
       apertura, data-tema ancora assente. Deducendo il verso dall'attributo
       («in mancanza d'altro è notte») ambra veniva schiarita sul bianco e
       finiva a contrasto 1,23. */
    expect(fondoChiaro(PAN_GIORNO)).toBe(true)
    expect(fondoChiaro(PAN_NOTTE)).toBe(false)
    const { usata } = correggi('#F2B03D', PAN_GIORNO)
    expect(luminosita(usata)).toBeLessThan(luminosita('#F2B03D'))
    expect(contrasto(usata, PAN_GIORNO)).toBeGreaterThanOrEqual(CONTRASTO_MINIMO)
  })

  it('una tinta che va già bene non viene toccata', () => {
    const { usata, corretta } = correggi('#F2B03D', PAN_NOTTE)
    expect(usata).toBe('#F2B03D')
    expect(corretta).toBe(false)
  })

  it('anche le tinte impossibili si raddrizzano', () => {
    for (const hex of ['#FFFF00', '#FFFFFF', '#000000', '#FF00FF']) {
      for (const fondo of [PAN_NOTTE, PAN_GIORNO]) {
        expect(contrasto(correggi(hex, fondo).usata, fondo), `${hex} su ${fondo}`).toBeGreaterThanOrEqual(CONTRASTO_MINIMO)
      }
    }
  })
})

describe('inchiostro e velo', () => {
  it('l\'inchiostro è misurato sui due valori che poi si scrivono davvero', () => {
    for (const [hex, nome] of TINTE_PRONTE) {
      const ink = inchiostroSopra(hex)
      const altro = ink === '#FFFFFF' ? '#131A20' : '#FFFFFF'
      expect(contrasto(hex, ink), `${nome}`).toBeGreaterThanOrEqual(contrasto(hex, altro))
    }
  })

  it('il velo resta trasparente, così vale su qualsiasi superficie', () => {
    expect(velo('#F2B03D')).toBe('rgba(242,176,61,0.12)')
    expect(velo('#3E7BD6', .2)).toBe('rgba(62,123,214,0.2)')
  })
})

describe('avvisi sulla tinta', () => {
  const colori = { su: SU, giu: GIU }

  it('vicino al rosso dei cali, vicino al verde delle salite', () => {
    expect(controlla('#E1523D', { colori }).map(a => a.cosa)).toEqual(['rosso'])
    expect(controlla('#5FD09B', { colori }).map(a => a.cosa)).toEqual(['verde'])
    expect(controlla('#3E7BD6', { colori })).toEqual([])
  })

  it('una tinta già presa in lega', () => {
    expect(controlla('#3E7BD6', { colori, tinteInLega: ['#4272C9'] }).map(a => a.cosa)).toEqual(['lega'])
    expect(controlla('#3E7BD6', { colori, tinteInLega: ['#F2B03D'] })).toEqual([])
  })

  it('un grigio non è un rosso: la tonalità di un grigio non vuol dire niente', () => {
    // #888888 ha tonalità 0, a cinque gradi dal rosso dei cali: senza il
    // controllo sulla saturazione si beccava l'avviso sbagliato
    expect(tonalita('#888888')).toBe(0)
    expect(distanza(tonalita('#888888'), tonalita(GIU))).toBeLessThan(22)
    expect(controlla('#888888', { colori })).toEqual([])
  })

  it('due grigi però si confondono fra loro, e un grigio con un blu no', () => {
    expect(controlla('#9AA6AD', { colori, tinteInLega: ['#8E9AA2'] }).map(a => a.cosa)).toEqual(['lega'])
    // «grafite» sta a 14° da «cobalto» ma è quasi grigio: non è una collisione
    expect(distanza(tonalita('#9AA6AD'), tonalita('#3E7BD6'))).toBeLessThan(15)
    expect(controlla('#9AA6AD', { colori, tinteInLega: ['#3E7BD6'] })).toEqual([])
  })

  it('senza argomenti non esplode: è una funzione esportata', () => {
    expect(() => controlla('#3E7BD6')).not.toThrow()
  })
})

describe('tinta proposta a chi entra', () => {
  it('non propone mai una tinta che l\'app stessa contesterebbe', () => {
    for (const presi of [[], ['#F2B03D'], ['#F2B03D', '#3E7BD6'], ['#F2B03D', '#3E7BD6', '#2AA79B']]) {
      const scelta = tintaLibera(presi, { su: SU, giu: GIU })
      expect(controlla(scelta, { tinteInLega: presi, colori: { su: SU, giu: GIU } }), `con ${presi.join(',')}`).toEqual([])
    }
  })

  it('granata e rame non si propongono: stanno sul rosso dei cali', () => {
    // erano le prime due della lista dopo ambra, e scattavano l'avviso
    expect(tintaLibera(['#F2B03D'], { su: SU, giu: GIU })).not.toBe('#E1523D')
    expect(tintaLibera(['#F2B03D'], { su: SU, giu: GIU })).not.toBe('#E68A4E')
  })
})

describe('applicaColoreSquadra', () => {
  const radice = () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    return el
  }

  it('scrive i tre token e racconta cosa ha fatto', () => {
    const el = radice()
    el.style.setProperty('--fr-pan', PAN_NOTTE)
    el.style.setProperty('--fr-su', SU)
    el.style.setProperty('--fr-giu', GIU)
    const esito = applicaColoreSquadra('#F2B03D', { radice: el })

    expect(esito.scelta).toBe('#F2B03D')
    expect(esito.usata).toBe('#F2B03D')
    expect(esito.corretta).toBe(false)
    expect(esito.contrasto).toBeGreaterThanOrEqual(CONTRASTO_MINIMO)
    expect(esito.avvisi).toEqual([])
    expect(el.style.getPropertyValue('--fr-marchio')).toBe('#F2B03D')
    expect(el.style.getPropertyValue('--fr-marchio-ink')).toBe('#131A20')
    expect(el.style.getPropertyValue('--fr-marchio-velo')).toBe('rgba(242,176,61,0.12)')
  })

  it('sul fondo chiaro scurisce, e lo dice', () => {
    const el = radice()
    el.style.setProperty('--fr-pan', PAN_GIORNO)
    const esito = applicaColoreSquadra('#F2B03D', { radice: el })
    expect(esito.corretta).toBe(true)
    expect(esito.contrasto).toBeGreaterThanOrEqual(CONTRASTO_MINIMO)
    expect(luminosita(esito.usata)).toBeLessThan(luminosita('#F2B03D'))
  })

  it('senza token leggibili non si inventa niente di illeggibile', () => {
    // in jsdom le variabili non dichiarate tornano stringa vuota
    const esito = applicaColoreSquadra('#F2B03D', { radice: radice() })
    expect(esito.contrasto).toBeGreaterThanOrEqual(CONTRASTO_MINIMO)
  })
})
