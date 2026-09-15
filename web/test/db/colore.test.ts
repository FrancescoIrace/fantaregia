/* imposta_colore: il colore è un dato di lega, ma ognuno cambia il suo —
   anche chi è in sola lettura, perché la squadra resta sua. */
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { comeUtente, nuovoDb } from './pglite.ts'

const ADMIN = '00000000-0000-4000-8000-00000000003a'
const MIO = '00000000-0000-4000-8000-00000000003b'     // lettore che ha scelto la seconda squadra
const ALTRO = '00000000-0000-4000-8000-00000000003c'   // lettore senza squadra scelta
const FUORI = '00000000-0000-4000-8000-00000000003d'   // non è della lega

let db: PGlite, lega: string, sq: number[]
const come = <T = Record<string, unknown>>(uid: string | null, sql: string, params: unknown[] = []) => comeUtente<T>(db, uid, sql, params)
const imposta = (uid: string, squadra: number, colore: string | null, l = lega) =>
  come(uid, 'select public.imposta_colore($1, $2, $3)', [l, squadra, colore])
const colori = async () => (await come<{ colore: string | null }>(ADMIN,
  'select colore from public.squadre where lega_id = $1 order by posizione', [lega])).map(x => x.colore)

beforeAll(async () => {
  db = await nuovoDb()
  await db.query('insert into auth.users (id, email) values ($1, $2), ($3, $4), ($5, $6), ($7, $8)',
    [ADMIN, 'a@example.com', MIO, 'm@example.com', ALTRO, 'o@example.com', FUORI, 'f@example.com'])
  const [r] = await come<{ crea_lega: string }>(ADMIN, `select public.crea_lega('Colori', array['Uno', 'Due', 'Tre'], 500)`)
  lega = r.crea_lega
  sq = (await come<{ id: number }>(ADMIN, 'select id::int as id from public.squadre where lega_id = $1 order by posizione', [lega])).map(x => x.id)
  await come(ADMIN, `insert into public.inviti (lega_id, ruolo, codice) values ($1, 'lettore', 'cod-mio'), ($1, 'lettore', 'cod-altro')`, [lega])
  await come(MIO, 'select public.unisciti($1)', ['cod-mio'])
  await come(ALTRO, 'select public.unisciti($1)', ['cod-altro'])
  await come(MIO, 'insert into public.preferenze (lega_id, utente_id, mia_squadra) values ($1, $2, $3)', [lega, MIO, sq[1]])
})

describe('imposta_colore', () => {
  it('admin e banditori colorano qualsiasi squadra, e la tinta si salva maiuscola', async () => {
    await imposta(ADMIN, sq[0], '#3e7bd6')
    expect((await colori())[0]).toBe('#3E7BD6')
  })

  it('un lettore cambia il colore della squadra che ha scelto come sua', async () => {
    await imposta(MIO, sq[1], '#2AA79B')
    expect((await colori())[1]).toBe('#2AA79B')
  })

  it('… e solo quello', async () => {
    await expect(imposta(MIO, sq[0], '#000000')).rejects.toThrow(/sola lettura/)
    await expect(imposta(ALTRO, sq[1], '#000000')).rejects.toThrow(/sola lettura/)
    expect(await colori()).toEqual(['#3E7BD6', '#2AA79B', null])
  })

  it('un lettore non può aggirare la funzione scrivendo sulla tabella', async () => {
    // le policy di squadre lasciano scrivere solo admin e banditori: l'update tocca zero righe
    await come(MIO, 'update public.squadre set colore = $1 where id = $2', ['#000000', sq[1]])
    expect((await colori())[1]).toBe('#2AA79B')
  })

  it('chi non è della lega non tocca niente', async () => {
    await expect(imposta(FUORI, sq[0], '#000000')).rejects.toThrow(/non fai parte/)
  })

  it('una squadra di un\'altra lega non si colora passando da questa', async () => {
    const [r] = await come<{ crea_lega: string }>(ADMIN, `select public.crea_lega('Altra', array['X', 'Y'], 500)`)
    const [x] = await come<{ id: number }>(ADMIN, 'select id::int as id from public.squadre where lega_id = $1 order by posizione limit 1', [r.crea_lega])
    await expect(imposta(ADMIN, x.id, '#000000')).rejects.toThrow(/non è di questa lega/)
  })

  it('un colore che non è #RRGGBB non entra', async () => {
    await expect(imposta(ADMIN, sq[2], 'rosso')).rejects.toThrow(/check/)
    await expect(imposta(ADMIN, sq[2], '#FFF')).rejects.toThrow(/check/)
    expect((await colori())[2]).toBeNull()
  })

  it('null toglie il colore', async () => {
    await imposta(ADMIN, sq[0], null)
    expect((await colori())[0]).toBeNull()
  })
})
