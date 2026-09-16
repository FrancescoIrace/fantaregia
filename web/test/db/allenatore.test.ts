/* imposta_allenatore: chi gioca quale squadra è un dato di lega, pubblico
   come il colore. L'admin lo mette a chiunque; ognuno può prendersi una
   squadra libera, anche in sola lettura, ma non scalzare un altro. */
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { comeUtente, nuovoDb } from './pglite.ts'

const ADMIN = '00000000-0000-4000-8000-00000000004a'
const MIO = '00000000-0000-4000-8000-00000000004b'     // lettore: il secondo fantallenatore
const ALTRO = '00000000-0000-4000-8000-00000000004c'   // lettore senza squadra
const FUORI = '00000000-0000-4000-8000-00000000004d'   // non è della lega

let db: PGlite, lega: string, sq: number[]
const come = <T = Record<string, unknown>>(uid: string | null, sql: string, params: unknown[] = []) => comeUtente<T>(db, uid, sql, params)
const imposta = (uid: string, squadra: number, utente: string | null) =>
  come(uid, 'select public.imposta_allenatore($1, $2, $3)', [lega, squadra, utente])
const allenatori = async () => (await come<{ allenatore: string | null }>(ADMIN,
  'select allenatore from public.squadre where lega_id = $1 order by posizione', [lega])).map(x => x.allenatore)

beforeAll(async () => {
  db = await nuovoDb()
  await db.query('insert into auth.users (id, email) values ($1, $2), ($3, $4), ($5, $6), ($7, $8)',
    [ADMIN, 'a@example.com', MIO, 'm@example.com', ALTRO, 'o@example.com', FUORI, 'f@example.com'])
  const [r] = await come<{ crea_lega: string }>(ADMIN, `select public.crea_lega('Allenatori', array['Uno', 'Due', 'Tre'], 500)`)
  lega = r.crea_lega
  sq = (await come<{ id: number }>(ADMIN, 'select id::int as id from public.squadre where lega_id = $1 order by posizione', [lega])).map(x => x.id)
  await come(ADMIN, `insert into public.inviti (lega_id, ruolo, codice) values ($1, 'lettore', 'all-mio'), ($1, 'lettore', 'all-altro')`, [lega])
  await come(MIO, 'select public.unisciti($1)', ['all-mio'])
  await come(ALTRO, 'select public.unisciti($1)', ['all-altro'])
})

describe('imposta_allenatore', () => {
  it('l\'admin prende la sua squadra e la lega lo sa', async () => {
    await imposta(ADMIN, sq[0], ADMIN)
    expect((await allenatori())[0]).toBe(ADMIN)
  })

  it('un lettore si prende una squadra libera, e «chi sono io» lo segue', async () => {
    await imposta(MIO, sq[1], MIO)
    expect((await allenatori())[1]).toBe(MIO)
    const [p] = await come<{ mia_squadra: number }>(MIO,
      'select mia_squadra::int as mia_squadra from public.preferenze where utente_id = $1', [MIO])
    expect(p.mia_squadra).toBe(sq[1])
  })

  it('… ma non si prende quella di un altro', async () => {
    await expect(imposta(ALTRO, sq[1], ALTRO)).rejects.toThrow(/ha già un allenatore/)
    expect((await allenatori())[1]).toBe(MIO)
  })

  it('… e non assegna squadre a terzi', async () => {
    await expect(imposta(MIO, sq[2], ALTRO)).rejects.toThrow(/solo una squadra per te/)
    expect((await allenatori())[2]).toBeNull()
  })

  it('un allenatore ha una squadra sola: prendendone un\'altra lascia la prima', async () => {
    await imposta(MIO, sq[2], MIO)
    expect(await allenatori()).toEqual([ADMIN, null, MIO])
    await imposta(MIO, sq[1], MIO)   // torna alla sua
    expect(await allenatori()).toEqual([ADMIN, MIO, null])
  })

  it('l\'admin assegna una squadra a un altro membro, e la libera con null', async () => {
    await imposta(ADMIN, sq[2], ALTRO)
    expect((await allenatori())[2]).toBe(ALTRO)
    await imposta(ADMIN, sq[2], null)
    expect((await allenatori())[2]).toBeNull()
  })

  it('un utente che non è della lega non può esserne allenatore', async () => {
    await expect(imposta(ADMIN, sq[2], FUORI)).rejects.toThrow(/non è di questa lega/)
  })

  it('chi non è della lega non tocca niente', async () => {
    await expect(imposta(FUORI, sq[0], FUORI)).rejects.toThrow(/non fai parte/)
  })

  it('una squadra di un\'altra lega non si tocca passando da questa', async () => {
    const [r] = await come<{ crea_lega: string }>(ADMIN, `select public.crea_lega('Altra', array['X', 'Y'], 500)`)
    const [x] = await come<{ id: number }>(ADMIN, 'select id::int as id from public.squadre where lega_id = $1 order by posizione limit 1', [r.crea_lega])
    await expect(imposta(ADMIN, x.id, ADMIN)).rejects.toThrow(/non è di questa lega/)
  })

  it('un lettore non aggira la funzione scrivendo sulla tabella', async () => {
    // le policy di squadre lasciano scrivere solo admin e banditori: l'update tocca zero righe
    await come(ALTRO, 'update public.squadre set allenatore = $1 where id = $2', [ALTRO, sq[1]])
    expect((await allenatori())[1]).toBe(MIO)
  })
})
