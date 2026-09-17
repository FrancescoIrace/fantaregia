/* rientra(): un rientro sposta la riga di indisponibili nello storico, con
   la nota di quando era uscito e quella del rientro. Chi non scrive non
   sposta niente, chi non era fuori non lascia traccia. */
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { comeUtente, nuovoDb } from './pglite.ts'

const ADMIN = '00000000-0000-4000-8000-00000000006a'
const BANDITORE = '00000000-0000-4000-8000-00000000006b'
const LETTORE = '00000000-0000-4000-8000-00000000006c'
const FUORI = '00000000-0000-4000-8000-00000000006d'

let db: PGlite, lega: string
const come = <T = Record<string, unknown>>(uid: string | null, sql: string, params: unknown[] = []) => comeUtente<T>(db, uid, sql, params)
const rientra = (uid: string, voci: { giocatore_id: number; nota?: string | null }[]) =>
  come<{ rientra: number }>(uid, 'select public.rientra($1, $2::jsonb)', [lega, JSON.stringify(voci)]).then(r => r[0].rientra)
const fuori = async () => (await come<{ giocatore_id: number }>(ADMIN,
  'select giocatore_id from public.indisponibili where lega_id = $1 order by 1', [lega])).map(x => x.giocatore_id)
const storico = (uid = ADMIN) => come<Record<string, unknown>>(uid,
  'select giocatore_id, motivo, da_giornata, nota_uscita, nota from public.rientri where lega_id = $1 order by giocatore_id', [lega])

beforeAll(async () => {
  db = await nuovoDb()
  await db.query('insert into auth.users (id, email) values ($1, $2), ($3, $4), ($5, $6), ($7, $8)',
    [ADMIN, 'a@example.com', BANDITORE, 'b@example.com', LETTORE, 'l@example.com', FUORI, 'f@example.com'])
  const [r] = await come<{ crea_lega: string }>(ADMIN, `select public.crea_lega('Rientri', array['Uno', 'Due'], 500)`)
  lega = r.crea_lega
  await come(ADMIN, `insert into public.inviti (lega_id, ruolo, codice) values ($1, 'banditore', 'cod-b'), ($1, 'lettore', 'cod-l')`, [lega])
  await come(BANDITORE, 'select public.unisciti($1)', ['cod-b'])
  await come(LETTORE, 'select public.unisciti($1)', ['cod-l'])
  await come(ADMIN, `insert into public.indisponibili (lega_id, giocatore_id, motivo, da_giornata, nota) values
    ($1, 10, 'infortunio', 3, 'lesione al bicipite femorale'), ($1, 11, 'squalifica', 4, null), ($1, 12, 'infortunio', 5, null)`, [lega])
})

describe('rientra', () => {
  it('un lettore non fa rientrare nessuno', async () => {
    expect(await rientra(LETTORE, [{ giocatore_id: 10, nota: 'no' }])).toBe(0)
    expect(await fuori()).toEqual([10, 11, 12])
    expect(await storico()).toEqual([])
  })

  it('il banditore: escono da indisponibili e restano nello storico, con le due note', async () => {
    expect(await rientra(BANDITORE, [
      { giocatore_id: 10, nota: 'torna disponibile dopo la lesione al bicipite femorale' },
      { giocatore_id: 11, nota: '  ' },                 // una nota vuota non si salva come testo vuoto
      { giocatore_id: 99, nota: 'non era fuori' },      // nessuna riga: non c'era niente da cui rientrare
    ])).toBe(2)
    expect(await fuori()).toEqual([12])
    expect(await storico(LETTORE)).toEqual([
      { giocatore_id: 10, motivo: 'infortunio', da_giornata: 3, nota_uscita: 'lesione al bicipite femorale',
        nota: 'torna disponibile dopo la lesione al bicipite femorale' },
      { giocatore_id: 11, motivo: 'squalifica', da_giornata: 4, nota_uscita: null, nota: null },
    ])
  })

  it('chi non è della lega non vede lo storico, e nessuno lo scrive a mano senza permessi', async () => {
    expect(await storico(FUORI)).toEqual([])
    await expect(come(LETTORE, `insert into public.rientri (lega_id, giocatore_id) values ($1, 12)`, [lega])).rejects.toThrow()
  })
})
