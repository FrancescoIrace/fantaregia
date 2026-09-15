/* Previsione contro realtà: i fantapunti di una formazione con la regola dei
   cambi scelta (per ruolo, ordine della panchina, fino a tre), la formazione
   del modello, la sintesi, e il motore «com'era prima» che non vede i voti
   della giornata che si giudica. */
import { describe, expect, it } from 'vitest'
import { formazioneModello, MAX_CAMBI, puntiFormazione, sintesiPrevisioni } from '../src/domain/previsione.ts'
import { vuota } from '../src/domain/formazione.ts'
import { ingressoFinoA, ingressoMotore, type RigheLega } from '../src/data/componi.ts'
import type { Giocatore, Ruolo } from '../src/domain/tipi.ts'

const RUOLI: Record<number, Ruolo> = {
  1: 'P', 2: 'D', 3: 'D', 4: 'D', 5: 'C', 6: 'C', 7: 'C', 8: 'C', 9: 'A', 10: 'A', 11: 'A',
  12: 'P', 13: 'D', 14: 'C', 15: 'A', 16: 'D',
}
const ruoloDi = (id: number) => RUOLI[id]
const titolari = () => ({ ...vuota('3-4-3'), start: { P: [1], D: [2, 3, 4], C: [5, 6, 7, 8], A: [9, 10, 11] } })

describe('i fantapunti di una formazione', () => {
  it('tutti a voto: la somma dei fantavoti, nessun cambio', () => {
    expect(puntiFormazione({ ...titolari(), bench: [12, 13] }, () => 6, ruoloDi)).toEqual({ totale: 66, cambi: [], scoperte: 0 })
  })

  it('chi è senza voto lo sostituisce il primo della panchina dello stesso ruolo che ha preso voto', () => {
    const voti: Record<number, number | null> = { 3: null, 13: null, 16: 7 }
    const r = puntiFormazione({ ...titolari(), bench: [12, 13, 16] }, id => id in voti ? voti[id] : 6, ruoloDi)
    expect(r.cambi).toEqual([{ esce: 3, entra: 16 }])
    expect(r.totale).toBe(6 * 10 + 7)
  })

  it('conta l\'ordine della panchina, e i cambi si fermano a tre', () => {
    expect(MAX_CAMBI).toBe(3)
    const senza = new Set([1, 2, 5, 9])
    const r = puntiFormazione({ ...titolari(), bench: [15, 14, 13, 12] }, id => senza.has(id) ? null : 6, ruoloDi)
    expect(r.cambi).toEqual([{ esce: 9, entra: 15 }, { esce: 5, entra: 14 }, { esce: 2, entra: 13 }])
    expect(r.scoperte).toBe(1)                          // il portiere resta senza sostituto: i cambi sono finiti
    expect(r.totale).toBe(6 * 10)
  })

  it('una casella vuota vale come un titolare senza voto', () => {
    const L = { ...titolari(), start: { ...titolari().start, A: [9, 10, null] }, bench: [15] }
    const r = puntiFormazione(L, () => 6, ruoloDi)
    expect(r.cambi).toEqual([{ esce: null, entra: 15 }])
    expect(r.totale).toBe(66)
  })
})

describe('la formazione del modello', () => {
  it('sceglie il modulo con il punteggio di giornata più alto sugli undici', () => {
    const gio = (id: number): Giocatore => ({ id, r: RUOLI[id], n: `G${id}`, s: 'Alfa', q: 1 })
    const rosa = [1, 2, 3, 4, 13, 16, 5, 6, 7, 8, 14, 9, 10, 11, 15].map(gio)
    // difensori forti, attaccanti deboli: il modello deve andare a cinque in difesa e una punta
    const punti = (p: Giocatore) => ({ P: 50, D: 90, C: 60, A: 20 })[p.r]
    expect(formazioneModello(rosa, { punteggio: punti, indisponibile: () => false }).mod).toBe('5-4-1')
  })
})

describe('la sintesi', () => {
  const v = (mia: number, modello: number) => ({ mia: { totale: mia }, modello: { totale: modello } })
  it('in quante giornate il modello avrebbe fatto meglio, e di quanto', () => {
    expect(sintesiPrevisioni([v(70, 74), v(68, 65), v(60, 60), v(55, 57)])).toEqual({
      giornate: 4, meglioModello: 2, meglioMia: 1, pari: 1, mediaScarto: (4 - 3 + 0 + 2) / 4, mediaQuandoMeglio: 3,
    })
  })
  it('senza giornate, niente divisioni per zero', () => {
    expect(sintesiPrevisioni([])).toEqual({ giornate: 0, meglioModello: 0, meglioMia: 0, pari: 0, mediaScarto: 0, mediaQuandoMeglio: 0 })
  })
})

describe('il motore com\'era prima', () => {
  it('ingressoFinoA toglie i voti dalla giornata in poi, e nient\'altro', () => {
    const righe = {
      lega: {
        id: 'l1', nome: 'Prova', stagione: '2026/27', budget: 500, slots: { P: 3, D: 8, C: 8, A: 6 },
        plan: { P: 7, D: 19, C: 32, A: 42 }, squal_on: true, voti_meta: null, rose_meta: null, versione: 1, aggiornata_il: '2026-09-11T10:00:00Z',
      },
      squadre: [], assegnazioni: [], log: [], movimenti: [], indisponibili: [], squalificheAnnullate: [], dataset: [], preferenze: null,
      voti: [1, 2, 3].map(g => ({ giornata: g, voti: { 7: [6, 0, 0, 0, 0, 0, 0, 0, 0, 0] } })),
    } as unknown as RigheLega
    expect(Object.keys(ingressoFinoA(righe, 3).stato!.stats!).map(Number)).toEqual([1, 2])
    expect(Object.keys(ingressoFinoA(righe, 1).stato!.stats!)).toEqual([])
    expect(Object.keys(ingressoMotore(righe).stato!.stats!).map(Number)).toEqual([1, 2, 3])
    expect(ingressoFinoA(righe, 3).stato!.budget).toBe(500)
  })
})
