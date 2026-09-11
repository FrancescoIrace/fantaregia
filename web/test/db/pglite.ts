/* Un Postgres in memoria con le migrazioni di supabase/migrations, e i
   pezzi che Supabase dà già pronti ricostruiti nel preludio: i ruoli
   anon/authenticated, auth.users, auth.uid(), la publication del realtime. */
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PGlite, type Transaction } from '@electric-sql/pglite'

const MIGRAZIONI = fileURLToPath(new URL('../../supabase/migrations/', import.meta.url))

const PRELUDIO = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  grant usage on schema public to anon, authenticated;
  create publication supabase_realtime;
`

export async function nuovoDb() {
  const db = new PGlite()
  await db.exec(PRELUDIO)
  for (const f of readdirSync(MIGRAZIONI).filter(f => f.endsWith('.sql')).sort())
    await db.exec(readFileSync(MIGRAZIONI + f, 'utf8'))
  return db
}

/* una transazione come la farebbe PostgREST: ruolo e utente valgono solo lì dentro */
export async function comeUtente<T = Record<string, unknown>>(db: PGlite, uid: string | null, sql: string, params: unknown[] = []): Promise<T[]> {
  return db.transaction(async (tx: Transaction) => {
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid ?? ''])
    await tx.exec(`set local role ${uid ? 'authenticated' : 'anon'}`)
    return (await tx.query<T>(sql, params)).rows
  })
}
