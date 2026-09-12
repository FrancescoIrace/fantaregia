/* Le operazioni di mercato su un Postgres vero: uno scambio non muove i
   crediti di nessuno, uno svincolo li muove del rimborso meno il prezzo
   pagato a suo tempo, e annullare rimette tutto com'era. */
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { comeUtente, nuovoDb } from './pglite.ts'

const ADMIN = '00000000-0000-4000-8000-00000000001a'
const LETTORE = '00000000-0000-4000-8000-00000000001c'

/* listone inventato: due difensori, un centrocampista, un attaccante libero */
const LISTONE = [
  [1, 'D', 'Dc', 'Difensore Uno', 'Alfa', 20, 100, 1],
  [2, 'D', 'Dc', 'Difensore Due', 'Beta', 12, 60, 1],
  [3, 'C', 'C', 'Centro Tre', 'Alfa', 15, 80, 1],
  [4, 'D', 'Dc', 'Difensore Libero', 'Gamma', 8, 40, 1],
]
const snap = (id: number) => { const p = LISTONE.find(x => x[0] === id)!; return { id, r: p[1], n: p[3], s: p[4], q: p[5] } }

let db: PGlite, lega: string, sq: number[]
const come = <T = Record<string, unknown>>(uid: string | null, sql: string, params: unknown[] = []) => comeUtente<T>(db, uid, sql, params)
const fallisce = (p: Promise<unknown>, msg: RegExp) => expect(p).rejects.toThrow(msg)
const residuo = async (i: number) => (await come<{ c: number }>(ADMIN, 'select public.crediti_residui($1, $2) as c', [lega, sq[i]]))[0].c
const rose = async () => come<{ giocatore_id: number; squadra_id: number; prezzo: number }>(ADMIN,
  'select giocatore_id, squadra_id::int as squadra_id, prezzo from public.assegnazioni where lega_id = $1 order by giocatore_id', [lega])

beforeAll(async () => {
  db = await nuovoDb()
  await db.query('insert into auth.users (id, email) values ($1, $2), ($3, $4)', [ADMIN, 'admin@example.com', LETTORE, 'lettore@example.com'])
  const [r] = await come<{ crea_lega: string }>(ADMIN, `select public.crea_lega('Mercato', array['Uno', 'Due'], 500)`)
  lega = r.crea_lega
  sq = (await come<{ id: number }>(ADMIN, 'select id::int as id from public.squadre where lega_id = $1 order by posizione', [lega])).map(x => x.id)
  await come(ADMIN, `insert into public.dataset (lega_id, tipo, dati) values ($1, 'listone', $2::jsonb)`, [lega, JSON.stringify(LISTONE)])
  await come(ADMIN, `insert into public.inviti (lega_id, ruolo, codice) values ($1, 'lettore', 'cod-lettore')`, [lega])
  await come(LETTORE, 'select public.unisciti($1)', ['cod-lettore'])
  // le rose di partenza: 1 e 3 alla prima squadra, 2 alla seconda
  for (const [pid, i, prezzo] of [[1, 0, 60], [3, 0, 40], [2, 1, 20]] as const)
    await come(ADMIN, 'insert into public.assegnazioni (lega_id, giocatore_id, squadra_id, prezzo, snap) values ($1, $2, $3, $4, $5::jsonb)',
      [lega, pid, sq[i], prezzo, JSON.stringify(snap(pid))])
})

describe('mercato', () => {
  it('scambio: i due si scambiano di squadra e i crediti non si muovono', async () => {
    const prima = [await residuo(0), await residuo(1)]
    await come(ADMIN, 'select public.registra_scambio($1, 1, 2, 6)', [lega])
    expect(await rose()).toEqual([
      { giocatore_id: 1, squadra_id: sq[1], prezzo: 60 },
      { giocatore_id: 2, squadra_id: sq[0], prezzo: 20 },
      { giocatore_id: 3, squadra_id: sq[0], prezzo: 40 },
    ])
    expect([await residuo(0), await residuo(1)]).toEqual(prima)
    const [mov] = await come<{ tipo: string; giornata: number; agg: Record<string, number> }>(ADMIN, 'select tipo, giornata, agg from public.movimenti where lega_id = $1', [lega])
    expect(mov).toMatchObject({ tipo: 'scambio', giornata: 6 })
    expect(mov.agg).toEqual({ [sq[0]]: -40, [sq[1]]: 40 })   // 20 − 60 e 60 − 20
  })

  it('scambio: rifiuta ruoli diversi, stessa squadra, chi non è in rosa e chi è in sola lettura', async () => {
    await fallisce(come(ADMIN, 'select public.registra_scambio($1, 2, 3, 6)', [lega]), /stessa squadra/)
    await fallisce(come(ADMIN, 'select public.registra_scambio($1, 1, 3, 6)', [lega]), /ruoli diversi/)
    await fallisce(come(ADMIN, 'select public.registra_scambio($1, 1, 4, 6)', [lega]), /non è in nessuna rosa/)
    await fallisce(come(ADMIN, 'select public.registra_scambio($1, 1, 2, 44)', [lega]), /giornata/)
    await fallisce(come(LETTORE, 'select public.registra_scambio($1, 1, 2, 6)', [lega]), /sola lettura/)
  })

  it('svincolo: chi esce libera i crediti pattuiti, chi entra costa, e il conto torna', async () => {
    const prima = await residuo(0)
    // la prima squadra svincola il 2 (pagato 20) con rimborso 15 e prende il 4 per 7
    await come(ADMIN, 'select public.registra_svincolo($1, $2, 2, 4, 15, 7, 8, $3::jsonb)', [lega, sq[0], JSON.stringify(snap(4))])
    expect(await residuo(0)).toBe(prima + 15 - 7)
    const r = await rose()
    expect(r.find(x => x.giocatore_id === 2)).toBeUndefined()
    expect(r.find(x => x.giocatore_id === 4)).toMatchObject({ squadra_id: sq[0], prezzo: 7 })
  })

  it('svincolo: rifiuta ruoli diversi, chi è già preso e i crediti che non bastano', async () => {
    await fallisce(come(ADMIN, 'select public.registra_svincolo($1, $2, 3, 2, 0, 1, 8, $3::jsonb)', [lega, sq[0], JSON.stringify(snap(2))]), /già in una rosa|ruoli diversi/)
    await fallisce(come(ADMIN, 'select public.registra_svincolo($1, $2, 1, 4, 0, 1, 8, $3::jsonb)', [lega, sq[0], JSON.stringify(snap(4))]), /non è in questa rosa/)
    await fallisce(come(ADMIN, 'select public.registra_svincolo($1, $2, 4, 2, 0, 100000, 8, $3::jsonb)', [lega, sq[0], JSON.stringify(snap(2))]), /non bastano i crediti|già in una rosa/)
  })

  it('annullare rimette le rose e i crediti come stavano', async () => {
    const movimenti = await come<{ id: number; tipo: string }>(ADMIN, 'select id::int as id, tipo from public.movimenti where lega_id = $1 order by id', [lega])
    expect(movimenti).toHaveLength(2)
    for (const mv of movimenti.slice().reverse()) await come(ADMIN, 'select public.annulla_movimento($1, $2)', [lega, mv.id])
    expect(await rose()).toEqual([
      { giocatore_id: 1, squadra_id: sq[0], prezzo: 60 },
      { giocatore_id: 2, squadra_id: sq[1], prezzo: 20 },
      { giocatore_id: 3, squadra_id: sq[0], prezzo: 40 },
    ])
    expect([await residuo(0), await residuo(1)]).toEqual([500 - 100, 500 - 20])
    expect(await come(ADMIN, 'select * from public.movimenti where lega_id = $1', [lega])).toEqual([])
  })
})
