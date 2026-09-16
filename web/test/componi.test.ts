/* Dalle righe del database allo stato del motore: le forme devono essere
   esattamente quelle che l'app a file singolo teneva in S. */
import { describe, expect, it } from 'vitest'
import { componiStato, ingressoMotore, miaSquadraDi, type RigheLega } from '../src/data/componi.ts'
import { creaMotore } from '../src/domain/motore.ts'

const righe: RigheLega = {
  lega: {
    id: 'l1', nome: 'Prova', stagione: '2026/27', budget: 500, slots: { P: 3, D: 8, C: 8, A: 6 },
    plan: { P: 7, D: 19, C: 32, A: 42 }, squal_on: true, voti_meta: null, rose_meta: null,
    versione: 4, aggiornata_il: '2026-09-11T10:00:00Z',
  },
  squadre: [{ id: 12, nome: 'Due', posizione: 2, lega_idx: null, colore: null, allenatore: null }, { id: 11, nome: 'Uno', posizione: 1, lega_idx: 3, colore: '#3E7BD6', allenatore: null }],
  assegnazioni: [{ giocatore_id: 7, squadra_id: 11, prezzo: 20, snap: { id: 7, r: 'A', n: 'Sette S.', s: 'Alfa', q: 15 } }],
  log: [
    { giocatore_id: 5, squadra_id: 12, prezzo: 3, registrata_il: '2026-09-01T20:00:00Z' },
    { giocatore_id: 7, squadra_id: 11, prezzo: 20, registrata_il: '2026-09-01T21:00:00Z' },
  ],
  movimenti: [
    { id: 2, giornata: 5, tipo: 'scambio', voci: [], agg: { 11: 4 }, rimborso: null, costo: null, registrato_il: '2026-10-01T10:00:00Z' },
    { id: 1, giornata: 3, tipo: 'svincolo', voci: [], agg: { 12: -2 }, rimborso: 10, costo: 1, registrato_il: '2026-10-02T10:00:00Z' },
  ],
  indisponibili: [
    { giocatore_id: 7, motivo: 'infortunio', da_giornata: 4, segnato_il: '2026-09-20T10:00:00Z' },
    { giocatore_id: 8, motivo: null, da_giornata: null, segnato_il: '2026-09-21T10:00:00Z' },
  ],
  squalificheAnnullate: [{ giocatore_id: 9, giornata: 6 }],
  voti: [{ giornata: 1, voti: { 7: [6.5, 0, 1, 0, 0, 0, 0, 0, 0, 0] } }],
  dataset: [{ tipo: 'calendario_lega', dati: { teams: ['A', 'B'], off: 2, gior: [[[0, 1]]] }, meta: {} }],
  preferenze: { mia_squadra: 11, obiettivi: { 7: { max: 25 } }, formazioni: {} },
}

describe('componiStato', () => {
  const S = componiStato(righe)

  it('squadre in ordine di posizione, e il loro posto nel calendario di lega', () => {
    expect(S.teams).toEqual([{ id: 11, name: 'Uno' }, { id: 12, name: 'Due' }])
    expect(S.legaMap).toEqual({ 11: 3 })
    expect(S.lega).toEqual({ teams: ['A', 'B'], off: 2, gior: [[[0, 1]]] })
  })

  it('asta: assegnazioni per id, registro dal più recente', () => {
    expect(S.assign).toEqual({ 7: { team: 11, price: 20, snap: { id: 7, r: 'A', n: 'Sette S.', s: 'Alfa', q: 15 } } })
    expect(S.log.map(l => l.pid)).toEqual([7, 5])
  })

  it('movimenti in ordine di giornata, rimborso e costo solo dove ci sono', () => {
    expect(S.moves!.map(m => m.id)).toEqual([1, 2])
    expect(S.moves![0]).toMatchObject({ rimborso: 10, costo: 1 })
    expect('rimborso' in S.moves![1]).toBe(false)
  })

  it('infermeria, squalifiche annullate, voti, impostazioni', () => {
    expect(S.out[7]).toMatchObject({ motivo: 'infortunio', da: 4 })
    expect(S.out[8]).not.toHaveProperty('motivo')
    expect(S.squalSalta).toEqual({ '9-6': 1 })
    expect(S.stats[1][7]).toEqual([6.5, 0, 1, 0, 0, 0, 0, 0, 0, 0])
    expect([S.rev, S.votiMeta, S.squalOn]).toEqual([4, {}, true])
  })

  it('il motore la prende così com\'è', () => {
    const m = creaMotore(ingressoMotore(righe))
    expect(m.meId()).toBe(11)
    expect(m.stats(11)).toMatchObject({ spent: 16, left: 484 })   // 20 pagati, 4 di correzione dallo scambio
    expect(m.isOut(7)).toBe(true)
  })
})

/* Qual è «la mia squadra»: la scelta privata, oppure — per chi se l'è vista
   assegnare dall'admin, e quindi non ne ha nessuna salvata — quella di cui
   risulta allenatore. Senza il secondo gradino l'app gli diceva «scegli la
   tua squadra» e non lo lasciava colorarla. */
describe('miaSquadraDi', () => {
  const UTENTE = '00000000-0000-4000-8000-00000000004b'

  it('la scelta privata viene prima', () => {
    expect(miaSquadraDi(righe, UTENTE)).toBe(11)
  })

  it('senza scelta privata vale la squadra di cui si è allenatore', () => {
    const legato: RigheLega = {
      ...righe,
      preferenze: null,
      squadre: righe.squadre.map(s => s.id === 12 ? { ...s, allenatore: UTENTE } : s),
    }
    expect(miaSquadraDi(legato, UTENTE)).toBe(12)
  })

  it('l\'allenatore è un altro, e non ho scelto: nessuna squadra', () => {
    const altrui: RigheLega = {
      ...righe,
      preferenze: null,
      squadre: righe.squadre.map(s => ({ ...s, allenatore: 'altro-utente' })),
    }
    expect(miaSquadraDi(altrui, UTENTE)).toBeNull()
  })
})
