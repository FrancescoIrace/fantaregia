/* ══ Lo schema, su un Postgres vero ══════════════════════════════════
   Le migrazioni di supabase/migrations girano su PGlite (Postgres in
   memoria), con i pezzi che Supabase dà già pronti ricostruiti nel
   preludio: i ruoli anon/authenticated, auth.uid(), la publication del
   realtime. Poi quattro utenti provano a fare quello che possono e quello
   che non possono: admin, banditore, lettore, estraneo.               */
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PGlite, type Transaction } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'

const MIGRAZIONI = fileURLToPath(new URL('../../supabase/migrations/', import.meta.url))

const PRELUDIO = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  grant usage on schema public to anon, authenticated;
  create publication supabase_realtime;
`

const ADMIN = '00000000-0000-4000-8000-00000000000a'
const BANDITORE = '00000000-0000-4000-8000-00000000000b'
const LETTORE = '00000000-0000-4000-8000-00000000000c'
const ESTRANEO = '00000000-0000-4000-8000-00000000000d'

/* un listone minuscolo e inventato: serve solo a far sapere al database i ruoli */
const LISTONE = [[1, 'P', 'Por', 'Portiere Uno', 'Alfa', 10, 50, 1], [2, 'P', 'Por', 'Portiere Due', 'Alfa', 5, 20, 1],
  [3, 'D', 'Dc', 'Difensore Tre', 'Beta', 8, 30, 1], [4, 'A', 'Pc', 'Punta Quattro', 'Beta', 30, 200, 1]]
const snap = (id: number) => { const p = LISTONE.find(x => x[0] === id)!; return JSON.stringify({ id, r: p[1], n: p[3], s: p[4], q: p[5] }) }

let db: PGlite

/* una transazione come la farebbe PostgREST: ruolo e utente valgono solo lì dentro */
async function come<T = Record<string, unknown>>(uid: string | null, sql: string, params: unknown[] = []): Promise<T[]> {
  return db.transaction(async (tx: Transaction) => {
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid ?? ''])
    await tx.exec(`set local role ${uid ? 'authenticated' : 'anon'}`)
    return (await tx.query<T>(sql, params)).rows
  })
}
const fallisce = (p: Promise<unknown>, msg: RegExp) => expect(p).rejects.toThrow(msg)

let lega: string
let squadre: number[]

beforeAll(async () => {
  db = new PGlite()
  await db.exec(PRELUDIO)
  for (const f of readdirSync(MIGRAZIONI).filter(f => f.endsWith('.sql')).sort())
    await db.exec(readFileSync(MIGRAZIONI + f, 'utf8'))
  await db.query('insert into auth.users (id) values ($1), ($2), ($3), ($4)', [ADMIN, BANDITORE, LETTORE, ESTRANEO])
})

describe('schema Supabase: permessi, conflitti, regole d\'asta', () => {
  it('crea_lega: chi la crea è admin e le squadre ci sono, in ordine', async () => {
    const [r] = await come<{ crea_lega: string }>(ADMIN, `select public.crea_lega('Lega di prova', array['Uno', 'Due', 'Tre'], 500)`)
    lega = r.crea_lega
    squadre = (await come<{ id: number }>(ADMIN, 'select id::int as id from public.squadre where lega_id = $1 order by posizione', [lega])).map(x => x.id)
    expect(squadre).toHaveLength(3)
    expect(await come(ADMIN, 'select ruolo from public.membri where lega_id = $1', [lega])).toEqual([{ ruolo: 'admin' }])
    await fallisce(come(ADMIN, `insert into public.leghe (nome) values ('di nascosto')`), /row-level security/)
  })

  it('inviti: si entra con il ruolo scritto nell\'invito, e solo con un codice valido', async () => {
    const [b] = await come<{ codice: string }>(ADMIN, `insert into public.inviti (lega_id, ruolo) values ($1, 'banditore') returning codice`, [lega])
    const [l] = await come<{ codice: string }>(ADMIN, `insert into public.inviti (lega_id, ruolo) values ($1, 'lettore') returning codice`, [lega])
    await come(BANDITORE, 'select public.unisciti($1)', [b.codice])
    await come(LETTORE, 'select public.unisciti($1)', [l.codice])
    expect(await come(ADMIN, 'select utente_id, ruolo from public.membri where lega_id = $1 order by utente_id', [lega])).toEqual([
      { utente_id: ADMIN, ruolo: 'admin' }, { utente_id: BANDITORE, ruolo: 'banditore' }, { utente_id: LETTORE, ruolo: 'lettore' }])
    await fallisce(come(ESTRANEO, `select public.unisciti('nonesiste')`), /invito non valido/)
    // gli inviti li vede e li crea solo l'admin
    expect(await come(BANDITORE, 'select * from public.inviti')).toEqual([])
    await fallisce(come(LETTORE, `insert into public.inviti (lega_id) values ($1)`, [lega]), /row-level security/)
  })

  it('chi non è della lega non vede niente, e anon non entra nemmeno (vincolo di licenza)', async () => {
    await come(ADMIN, `insert into public.dataset (lega_id, tipo, dati) values ($1, 'listone', $2::jsonb)`, [lega, JSON.stringify(LISTONE)])
    await come(ADMIN, `insert into public.voti_giornata (lega_id, giornata, voti) values ($1, 1, '{"4": [7, 0, 1, 0, 0, 0, 0, 0, 0, 0]}')`, [lega])
    for (const t of ['leghe', 'membri', 'squadre', 'dataset', 'voti_giornata', 'assegnazioni', 'preferenze'])
      expect(await come(ESTRANEO, `select * from public.${t}`)).toEqual([])
    await fallisce(come(null, 'select * from public.voti_giornata'), /permission denied/)
    await fallisce(come(null, `select public.crea_lega('x', array['a', 'b'])`), /permission denied/)
    await fallisce(come(ESTRANEO, 'insert into public.assegnazioni (lega_id, giocatore_id, squadra_id, prezzo) values ($1, 4, $2, 5)', [lega, squadre[0]]), /row-level security/)
    expect(await come(LETTORE, 'select giornata from public.voti_giornata')).toEqual([{ giornata: 1 }])
  })

  it('asta: il banditore assegna, il lettore no, e lo stesso giocatore non va a due squadre', async () => {
    await come(BANDITORE, 'select public.assegna($1, 1, $2, 10, $3::jsonb)', [lega, squadre[0], snap(1)])
    await fallisce(come(LETTORE, 'select public.assegna($1, 3, $2, 5, $3::jsonb)', [lega, squadre[0], snap(3)]), /sola lettura/)
    // il secondo banditore arriva un attimo dopo: errore esplicito, niente sovrascrittura
    await fallisce(come(ADMIN, 'select public.assegna($1, 1, $2, 12, $3::jsonb)', [lega, squadre[1], snap(1)]), /già assegnato/)
    expect(await come(LETTORE, 'select giocatore_id, squadra_id::int as squadra_id, prezzo from public.assegnazioni'))
      .toEqual([{ giocatore_id: 1, squadra_id: squadre[0], prezzo: 10 }])
    expect(await come(LETTORE, 'select giocatore_id, prezzo from public.log_asta')).toEqual([{ giocatore_id: 1, prezzo: 10 }])
  })

  it('asta: tetto d\'offerta e reparto pieno, con le regole e i messaggi dell\'app', async () => {
    // 500 crediti, 25 posti, 10 spesi → restano 24 posti da almeno 1: tetto 490 − 23 = 467
    await fallisce(come(BANDITORE, 'select public.assegna($1, 3, $2, 468, $3::jsonb)', [lega, squadre[0], snap(3)]), /Uno può offrire al massimo 467/)
    await come(BANDITORE, 'select public.assegna($1, 3, $2, 467, $3::jsonb)', [lega, squadre[0], snap(3)])
    await come(BANDITORE, 'select public.libera($1, 3)', [lega])
    await come(ADMIN, `update public.leghe set slots = '{"P":1,"D":8,"C":8,"A":6}' where id = $1`, [lega])
    await fallisce(come(BANDITORE, 'select public.assegna($1, 2, $2, 1, $3::jsonb)', [lega, squadre[0], snap(2)]), /Uno: reparto P già pieno/)
    // il ruolo lo dice il listone, non la fotografia mandata dal client
    const finto = JSON.stringify({ id: 2, r: 'A', n: 'Portiere Due', s: 'Alfa', q: 5 })
    await fallisce(come(BANDITORE, 'select public.assegna($1, 2, $2, 1, $3::jsonb)', [lega, squadre[0], finto]), /reparto P già pieno/)
  })

  it('libera: toglie l\'assegnazione e le sue voci del registro', async () => {
    await come(BANDITORE, 'select public.libera($1, 1)', [lega])
    expect(await come(LETTORE, 'select * from public.assegnazioni')).toEqual([])
    expect(await come(LETTORE, 'select * from public.log_asta')).toEqual([])
    await fallisce(come(BANDITORE, 'select public.libera($1, 1)', [lega]), /non è assegnato/)
  })

  it('impostazioni: la versione sale, e chi parte da una versione vecchia non sovrascrive', async () => {
    const [{ versione: v }] = await come<{ versione: number }>(ADMIN, 'select versione from public.leghe where id = $1', [lega])
    expect(await come(BANDITORE, 'update public.leghe set budget = 600 where id = $1 and versione = $2 returning versione', [lega, v])).toEqual([{ versione: v + 1 }])
    expect(await come(ADMIN, 'update public.leghe set budget = 700 where id = $1 and versione = $2 returning versione', [lega, v])).toEqual([])
    expect(await come(LETTORE, 'update public.leghe set budget = 1 where id = $1 returning id', [lega])).toEqual([])
    expect(await come(LETTORE, 'select budget from public.leghe')).toEqual([{ budget: 600 }])
  })

  it('preferenze: ognuno vede e scrive solo le sue', async () => {
    await come(BANDITORE, `insert into public.preferenze (lega_id, mia_squadra, obiettivi) values ($1, $2, '{"4": {"max": 30}}')`, [lega, squadre[1]])
    expect(await come(ADMIN, 'select * from public.preferenze')).toEqual([])
    expect(await come(BANDITORE, 'select mia_squadra::int as mia_squadra, obiettivi from public.preferenze'))
      .toEqual([{ mia_squadra: squadre[1], obiettivi: { 4: { max: 30 } } }])
    await fallisce(come(ADMIN, 'insert into public.preferenze (lega_id, utente_id) values ($1, $2)', [lega, BANDITORE]), /row-level security/)
  })

  it('membri: i ruoli li cambia l\'admin, l\'ultimo admin resta, chi vuole esce', async () => {
    expect(await come(LETTORE, `update public.membri set ruolo = 'admin' where utente_id = $1 returning ruolo`, [LETTORE])).toEqual([])
    expect(await come(ADMIN, `update public.membri set ruolo = 'banditore' where lega_id = $1 and utente_id = $2 returning ruolo`, [lega, LETTORE]))
      .toEqual([{ ruolo: 'banditore' }])
    await fallisce(come(ADMIN, `update public.membri set ruolo = 'lettore' where lega_id = $1 and utente_id = $2`, [lega, ADMIN]), /ultimo admin/)
    await come(LETTORE, 'delete from public.membri where lega_id = $1 and utente_id = $2', [lega, LETTORE])
    expect(await come(LETTORE, 'select * from public.leghe')).toEqual([])
  })

  it('cancellare la lega porta via tutto, e la cancella solo l\'admin', async () => {
    expect(await come(BANDITORE, 'delete from public.leghe where id = $1 returning id', [lega])).toEqual([])
    await come(ADMIN, 'delete from public.leghe where id = $1', [lega])
    const conta = async (t: string) => (await db.query<{ n: number }>(`select count(*)::int as n from public.${t}`)).rows[0].n
    for (const t of ['leghe', 'membri', 'squadre', 'dataset', 'voti_giornata', 'preferenze', 'inviti']) expect(await conta(t)).toBe(0)
  })
})
