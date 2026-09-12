/* allinea_rose: il file della lega è la versione firmata, e le voci
   diverse si riscrivono in un colpo solo. */
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { comeUtente, nuovoDb } from './pglite.ts'

const ADMIN = '00000000-0000-4000-8000-00000000002a'
const LETTORE = '00000000-0000-4000-8000-00000000002c'
const snap = (id: number, r: string) => JSON.stringify({ id, r, n: `G${id}`, s: 'Alfa', q: 10 })

let db: PGlite, lega: string, sq: number[]
const come = <T = Record<string, unknown>>(uid: string | null, sql: string, params: unknown[] = []) => comeUtente<T>(db, uid, sql, params)
const rose = () => come<{ giocatore_id: number; squadra_id: number; prezzo: number }>(ADMIN,
  'select giocatore_id, squadra_id::int as squadra_id, prezzo from public.assegnazioni where lega_id = $1 order by giocatore_id', [lega])

beforeAll(async () => {
  db = await nuovoDb()
  await db.query('insert into auth.users (id, email) values ($1, $2), ($3, $4)', [ADMIN, 'a@example.com', LETTORE, 'l@example.com'])
  const [r] = await come<{ crea_lega: string }>(ADMIN, `select public.crea_lega('Rose', array['Uno', 'Due'], 500)`)
  lega = r.crea_lega
  sq = (await come<{ id: number }>(ADMIN, 'select id::int as id from public.squadre where lega_id = $1 order by posizione', [lega])).map(x => x.id)
  await come(ADMIN, `insert into public.inviti (lega_id, ruolo, codice) values ($1, 'lettore', 'cod-rose')`, [lega])
  await come(LETTORE, 'select public.unisciti($1)', ['cod-rose'])
  // nell'asta: 1 e 2 alla prima squadra, 3 alla seconda
  for (const [pid, i, prezzo] of [[1, 0, 30], [2, 0, 10], [3, 1, 20]] as const)
    await come(ADMIN, 'insert into public.assegnazioni (lega_id, giocatore_id, squadra_id, prezzo, snap) values ($1, $2, $3, $4, $5::jsonb)',
      [lega, pid, sq[i], prezzo, snap(pid, 'D')])
})

describe('allinea_rose', () => {
  it('riscrive prezzo, squadra, aggiunge chi manca e toglie chi nel file non c\'è', async () => {
    const righe = [
      { stato: 'prezzo', pid: 1, squadra: sq[0], prezzo: 35 },
      { stato: 'squadra', pid: 3, squadra: sq[0], prezzo: 22 },
      { stato: 'solofile', pid: 4, squadra: sq[1], prezzo: 8, snap: JSON.parse(snap(4, 'C')) },
      { stato: 'soloapp', pid: 2, squadra: sq[0], prezzo: 10 },
    ]
    const [r] = await come<{ allinea_rose: { messi: number; tolti: number; corretti: number } }>(ADMIN,
      'select public.allinea_rose($1, $2::jsonb)', [lega, JSON.stringify(righe)])
    expect(r.allinea_rose).toEqual({ messi: 1, tolti: 1, corretti: 2 })
    expect(await rose()).toEqual([
      { giocatore_id: 1, squadra_id: sq[0], prezzo: 35 },
      { giocatore_id: 3, squadra_id: sq[0], prezzo: 22 },
      { giocatore_id: 4, squadra_id: sq[1], prezzo: 8 },
    ])
  })

  it('chi è in sola lettura non allinea niente', async () => {
    await expect(come(LETTORE, 'select public.allinea_rose($1, $2::jsonb)', [lega, JSON.stringify([{ stato: 'prezzo', pid: 1, squadra: sq[0], prezzo: 1 }])]))
      .rejects.toThrow(/sola lettura/)
    expect((await rose())[0].prezzo).toBe(35)
  })

  it('una lista vuota non fa danni', async () => {
    const [r] = await come<{ allinea_rose: { messi: number } }>(ADMIN, `select public.allinea_rose($1, '[]'::jsonb)`, [lega])
    expect(r.allinea_rose).toEqual({ messi: 0, tolti: 0, corretti: 0 })
  })
})
