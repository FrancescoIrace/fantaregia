/* indisponibili.nota: la colonna della migrazione nota_indisponibili. La
   scrivono admin e banditori, la leggono tutti i membri, e un lettore non la
   tocca — le stesse regole del resto della tabella. */
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { comeUtente, nuovoDb } from './pglite.ts'

const ADMIN = '00000000-0000-4000-8000-00000000005a'
const BANDITORE = '00000000-0000-4000-8000-00000000005b'
const LETTORE = '00000000-0000-4000-8000-00000000005c'
const FUORI = '00000000-0000-4000-8000-00000000005d'

let db: PGlite, lega: string
const come = <T = Record<string, unknown>>(uid: string | null, sql: string, params: unknown[] = []) => comeUtente<T>(db, uid, sql, params)
const note = async (uid: string) => come<{ giocatore_id: number; nota: string | null }>(uid,
  'select giocatore_id, nota from public.indisponibili where lega_id = $1 order by giocatore_id', [lega])

beforeAll(async () => {
  db = await nuovoDb()
  await db.query('insert into auth.users (id, email) values ($1, $2), ($3, $4), ($5, $6), ($7, $8)',
    [ADMIN, 'a@example.com', BANDITORE, 'b@example.com', LETTORE, 'l@example.com', FUORI, 'f@example.com'])
  const [r] = await come<{ crea_lega: string }>(ADMIN, `select public.crea_lega('Note', array['Uno', 'Due'], 500)`)
  lega = r.crea_lega
  await come(ADMIN, `insert into public.inviti (lega_id, ruolo, codice) values ($1, 'banditore', 'cod-b'), ($1, 'lettore', 'cod-l')`, [lega])
  await come(BANDITORE, 'select public.unisciti($1)', ['cod-b'])
  await come(LETTORE, 'select public.unisciti($1)', ['cod-l'])
})

describe('la nota di un indisponibile', () => {
  it('il banditore mette fuori più giocatori insieme, con la nota', async () => {
    await come(BANDITORE, `insert into public.indisponibili (lega_id, giocatore_id, motivo, da_giornata, nota) values
      ($1, 10, 'infortunio', 4, 'adduttore, rientro dopo la sosta'), ($1, 11, 'squalifica', 4, null)
      on conflict (lega_id, giocatore_id) do update set motivo = excluded.motivo, nota = excluded.nota`, [lega])
    expect(await note(LETTORE)).toEqual([{ giocatore_id: 10, nota: 'adduttore, rientro dopo la sosta' }, { giocatore_id: 11, nota: null }])
  })

  it('ricaricando il file la nota si aggiorna, senza un doppione', async () => {
    await come(ADMIN, `insert into public.indisponibili (lega_id, giocatore_id, motivo, da_giornata, nota) values ($1, 10, 'infortunio', 4, 'rientro anticipato')
      on conflict (lega_id, giocatore_id) do update set nota = excluded.nota`, [lega])
    expect((await note(ADMIN)).find(x => x.giocatore_id === 10)!.nota).toBe('rientro anticipato')
    expect(await note(ADMIN)).toHaveLength(2)
  })

  it('un lettore non la scrive, e chi non è della lega non la vede', async () => {
    await expect(come(LETTORE, `update public.indisponibili set nota = 'mia' where lega_id = $1 returning giocatore_id`, [lega]))
      .resolves.toEqual([])                         // la policy filtra: nessuna riga toccata
    expect((await note(ADMIN)).find(x => x.giocatore_id === 10)!.nota).toBe('rientro anticipato')
    expect(await note(FUORI)).toEqual([])
  })

  it('i rientrati escono in blocco', async () => {
    await come(BANDITORE, 'delete from public.indisponibili where lega_id = $1 and giocatore_id = any($2::int[])', [lega, [10, 11]])
    expect(await note(ADMIN)).toEqual([])
  })
})
