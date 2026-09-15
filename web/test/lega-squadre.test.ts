/* Le squadre anche da un database a cui manca la colonna del colore: la
   lega si apre lo stesso, e si sa che manca qualcosa. Il caso vero: codice
   aggiornato, migrazione colore_squadra non ancora applicata, e l'intera
   lega che non si caricava più per «column squadre.colore does not exist». */
import { describe, expect, it } from 'vitest'
import { leggiSquadre } from '../src/data/lega.ts'
import type { RigaSquadra } from '../src/data/componi.ts'

const riga = { id: 1, nome: 'Uno', posizione: 1, lega_idx: null }
const CON = 'id, nome, posizione, lega_idx, colore', SENZA = 'id, nome, posizione, lega_idx'

describe('leggiSquadre', () => {
  it('con la colonna: una richiesta sola, i colori come sono', async () => {
    const chieste: string[] = []
    const r = await leggiSquadre(async c => { chieste.push(c); return { data: [{ ...riga, colore: '#3E7BD6' }], error: null } })
    expect(r).toEqual({ squadre: [{ ...riga, colore: '#3E7BD6' }], coloreMancante: false })
    expect(chieste).toEqual([CON])
  })

  it('senza la colonna: si richiede senza, la lega si apre e si segna cosa manca', async () => {
    const chieste: string[] = []
    const r = await leggiSquadre(async c => {
      chieste.push(c)
      return c.includes('colore')
        ? { data: null, error: { code: '42703', message: 'column squadre.colore does not exist' } }
        : { data: [riga] as unknown as RigaSquadra[], error: null }
    })
    expect(r).toEqual({ squadre: [{ ...riga, colore: null }], coloreMancante: true })
    expect(chieste).toEqual([CON, SENZA])
  })

  it('basta il messaggio, se il codice non arriva', async () => {
    const r = await leggiSquadre(async c => c.includes('colore')
      ? { data: null, error: { message: 'column squadre.colore does not exist' } }
      : { data: [riga] as unknown as RigaSquadra[], error: null })
    expect(r.coloreMancante).toBe(true)
  })

  it('un altro errore non si nasconde dietro il ripiego', async () => {
    const chieste: string[] = []
    await expect(leggiSquadre(async c => { chieste.push(c); return { data: null, error: { code: '42501', message: 'permission denied' } } }))
      .rejects.toThrow('squadre: permission denied')
    expect(chieste).toEqual([CON])
  })
})
