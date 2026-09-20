/* crea_lega(): la stagione arriva da chi crea, e due squadre non possono
   chiamarsi uguale. Il parametro della stagione è in coda e facoltativo,
   quindi le chiamate con tre argomenti — tutti gli altri test su PGlite —
   devono continuare a funzionare. */
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { comeUtente, nuovoDb } from './pglite.ts'

const ADMIN = '00000000-0000-4000-8000-00000000007a'

let db: PGlite
const come = <T = Record<string, unknown>>(uid: string | null, sql: string, params: unknown[] = []) => comeUtente<T>(db, uid, sql, params)
const crea = (sql: string, params: unknown[] = []) => come<{ crea_lega: string }>(ADMIN, sql, params).then(r => r[0].crea_lega)
const stagioneDi = async (lega: string) =>
  (await come<{ stagione: string }>(ADMIN, 'select stagione from public.leghe where id = $1', [lega]))[0].stagione
const squadreDi = async (lega: string) =>
  (await come<{ nome: string }>(ADMIN, 'select nome from public.squadre where lega_id = $1 order by posizione', [lega])).map(x => x.nome)

beforeAll(async () => {
  db = await nuovoDb()
  await db.query('insert into auth.users (id, email) values ($1, $2)', [ADMIN, 'a@example.com'])
})

describe('la stagione', () => {
  it('arriva da chi crea la lega', async () => {
    const lega = await crea(`select public.crea_lega('Con stagione', array['Uno', 'Due'], 500, '2027/28')`)
    expect(await stagioneDi(lega)).toBe('2027/28')
  })

  it('senza, resta il valore predefinito della colonna: le chiamate a tre argomenti valgono ancora', async () => {
    const lega = await crea(`select public.crea_lega('Senza stagione', array['Uno', 'Due'], 500)`)
    expect(await stagioneDi(lega)).toBe('2026/27')
  })

  it('in una forma che non è 2026/27 viene rifiutata, invece di finire nell\'url di openfootball', async () => {
    await expect(crea(`select public.crea_lega('Storta', array['Uno', 'Due'], 500, '2027')`)).rejects.toThrow(/2026\/27/)
    await expect(crea(`select public.crea_lega('Storta', array['Uno', 'Due'], 500, '2027-28')`)).rejects.toThrow(/2026\/27/)
  })
})

describe('le squadre', () => {
  it('restano nell\'ordine in cui sono state scritte', async () => {
    const lega = await crea(`select public.crea_lega('Ordine', array['Terza', 'Prima', 'Seconda'], 500)`)
    expect(await squadreDi(lega)).toEqual(['Terza', 'Prima', 'Seconda'])
  })

  it('due che si chiamano uguale non si creano, e l\'errore dice quale', async () => {
    await expect(crea(`select public.crea_lega('Doppie', array['Regia FC', 'Altra', 'Regia FC'], 500)`))
      .rejects.toThrow(/Regia FC/)
  })

  it('spazi e maiuscole non fanno due squadre diverse', async () => {
    await expect(crea(`select public.crea_lega('Doppie', array['Regia FC', '  regia fc  '], 500)`)).rejects.toThrow(/due squadre/)
  })

  it('gli spazi intorno al nome si tolgono, così non restano nei dati', async () => {
    const lega = await crea(`select public.crea_lega('Spazi', array['  Uno  ', 'Due'], 500)`)
    expect(await squadreDi(lega)).toEqual(['Uno', 'Due'])
  })

  it('una squadra senza nome ferma tutto', async () => {
    await expect(crea(`select public.crea_lega('Vuota', array['Uno', '   '], 500)`)).rejects.toThrow(/senza nome/)
  })

  it('con meno di due non si crea niente', async () => {
    await expect(crea(`select public.crea_lega('Sola', array['Uno'], 500)`)).rejects.toThrow(/almeno due/)
  })

  it('quando la creazione fallisce non resta una lega a metà', async () => {
    const prima = (await come<{ n: number }>(ADMIN, 'select count(*)::int as n from public.leghe'))[0].n
    await expect(crea(`select public.crea_lega('Mai nata', array['Uno', 'Uno'], 500)`)).rejects.toThrow()
    expect((await come<{ n: number }>(ADMIN, 'select count(*)::int as n from public.leghe'))[0].n).toBe(prima)
  })
})
