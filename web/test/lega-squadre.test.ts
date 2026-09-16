/* Le squadre anche da un database a cui mancano le colonne aggiunte dopo:
   la lega si apre lo stesso, e si sa che cosa manca. Il caso vero: codice
   aggiornato, migrazione non ancora applicata, e l'intera lega che non si
   caricava più per «column squadre.colore does not exist». Le colonne
   facoltative ora sono due, colore e allenatore, e si scende di un gradino
   alla volta. */
import { describe, expect, it } from 'vitest'
import { leggiSquadre } from '../src/data/lega.ts'
import type { RigaSquadra } from '../src/data/componi.ts'

const riga = { id: 1, nome: 'Uno', posizione: 1, lega_idx: null }
const TUTTE = 'id, nome, posizione, lega_idx, colore, allenatore'
const COLORE = 'id, nome, posizione, lega_idx, colore'
const SENZA = 'id, nome, posizione, lega_idx'
const ALLENATORE = '00000000-0000-4000-8000-00000000004b'

describe('leggiSquadre', () => {
  it('con tutte le colonne: una richiesta sola, i dati come sono', async () => {
    const chieste: string[] = []
    const r = await leggiSquadre(async c => {
      chieste.push(c)
      return { data: [{ ...riga, colore: '#3E7BD6', allenatore: ALLENATORE }], error: null }
    })
    expect(r).toEqual({
      squadre: [{ ...riga, colore: '#3E7BD6', allenatore: ALLENATORE }],
      coloreMancante: false, allenatoreMancante: false,
    })
    expect(chieste).toEqual([TUTTE])
  })

  it('senza l\'allenatore: si richiede col solo colore, e si segna cosa manca', async () => {
    const chieste: string[] = []
    const r = await leggiSquadre(async c => {
      chieste.push(c)
      return c.includes('allenatore')
        ? { data: null, error: { code: '42703', message: 'column squadre.allenatore does not exist' } }
        : { data: [{ ...riga, colore: '#3E7BD6' }] as unknown as RigaSquadra[], error: null }
    })
    expect(r).toEqual({
      squadre: [{ ...riga, colore: '#3E7BD6', allenatore: null }],
      coloreMancante: false, allenatoreMancante: true,
    })
    expect(chieste).toEqual([TUTTE, COLORE])
  })

  it('senza nessuna delle due: si scende fino alle colonne di sempre', async () => {
    const chieste: string[] = []
    const r = await leggiSquadre(async c => {
      chieste.push(c)
      return c.includes('colore')
        ? { data: null, error: { code: '42703', message: 'column squadre.colore does not exist' } }
        : { data: [riga] as unknown as RigaSquadra[], error: null }
    })
    expect(r).toEqual({
      squadre: [{ ...riga, colore: null, allenatore: null }],
      coloreMancante: true, allenatoreMancante: true,
    })
    expect(chieste).toEqual([TUTTE, COLORE, SENZA])
  })

  it('basta il messaggio, se il codice non arriva', async () => {
    const r = await leggiSquadre(async c => c.includes('colore')
      ? { data: null, error: { message: 'column squadre.colore does not exist' } }
      : { data: [riga] as unknown as RigaSquadra[], error: null })
    expect(r.coloreMancante).toBe(true)
    expect(r.allenatoreMancante).toBe(true)
  })

  it('un altro errore non si nasconde dietro il ripiego', async () => {
    const chieste: string[] = []
    await expect(leggiSquadre(async c => { chieste.push(c); return { data: null, error: { code: '42501', message: 'permission denied' } } }))
      .rejects.toThrow('squadre: permission denied')
    expect(chieste).toEqual([TUTTE])
  })
})
