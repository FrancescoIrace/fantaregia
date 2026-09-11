/* Gli effetti di un caricamento: i giocatori in rosa che il listone nuovo
   perde restano, e i voti nuovi aggiornano l'infermeria (rientri) e fanno
   scattare le squalifiche confrontando prima e dopo. */
import { describe, expect, it } from 'vitest'
import { effettoVoti } from '../src/data/carica.ts'
import { unisciRimasti } from '../src/domain/importa.ts'
import type { GiocatoreGrezzo, StatoLega, VotoRiga } from '../src/domain/tipi.ts'

const players: GiocatoreGrezzo[] = [
  [10, 'A', 'Pc', 'Punta Dieci', 'Alfa', 20, 100, 1],
  [11, 'D', 'Dc', 'Difensore Undici', 'Alfa', 8, 40, 1],
  [12, 'C', 'C', 'Centro Dodici', 'Beta', 12, 60, 1],
]
const riga = (amm = 0): VotoRiga => [6, 0, 0, 0, 0, 0, 0, amm, 0, 0]

describe('effetti di un caricamento', () => {
  it('listone nuovo: chi è in rosa ma non c\'è più resta, una volta sola', () => {
    const nuovo = players.slice(0, 2)
    const snap = { id: 12, r: 'C' as const, n: 'Centro Dodici', s: 'Beta', q: 12 }
    const { players: tutti, rimasti } = unisciRimasti(nuovo, [snap, snap, null, { id: 10, r: 'A', n: 'Punta Dieci', s: 'Alfa', q: 20 }])
    expect(rimasti).toBe(1)
    expect(tutti).toEqual([...nuovo, [12, 'C', '', 'Centro Dodici', 'Beta', 12, 12, 1]])
  })

  it('voti nuovi: chi rigioca esce dall\'infermeria, la quinta ammonizione squalifica', () => {
    // quattro giornate: l'11 prende sempre giallo, il 10 è infortunato dalla 3ª e non gioca
    const stats: StatoLega['stats'] = {}
    for (let g = 1; g <= 4; g++) stats[g] = { 11: riga(1), 12: riga(), ...(g < 3 ? { 10: riga() } : {}) }
    const stato: Partial<StatoLega> = { stats, out: { 10: { motivo: 'infortunio', da: 3, ts: 0 } } }
    const e = effettoVoti({ players, stato }, { 5: { 10: riga(), 11: riga(1), 12: riga() } })
    expect(e.rientri).toEqual([{ pid: 10, g: 5 }])
    expect(e.squalifiche).toEqual([{ pid: 11, g: 6, n: 5 }])
    expect(e.nome(11)).toBe('Difensore Undici')
    // ricaricare la stessa giornata non «rifà» la squalifica: c'era già prima
    const di5 = { ...stats, 5: { 10: riga(), 11: riga(1), 12: riga() } }
    expect(effettoVoti({ players, stato: { ...stato, stats: di5 } }, { 5: di5[5] }).squalifiche).toEqual([])
  })
})
