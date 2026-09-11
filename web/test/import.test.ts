/* ══ Import dall'app a file singolo: andata e ritorno ═════════════════
   Una lega sintetica completa viene esportata come l'app la esporta — la
   pagina con i dati dentro, costruita come build.sh — poi letta, importata
   in Postgres con importa_lega(), riletta dalle tabelle e ricomposta.
   Deve tornare la stessa lega, e soprattutto il motore deve dare gli
   stessi numeri prima e dopo: l'import non può cambiare un indice.    */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { assemblaPagina } from './legacy.ts'
import { completa, costruisciLega } from './lega-sintetica.ts'
import { comeUtente, nuovoDb } from './db/pglite.ts'
import { calendarioDaRighe, parseCSV, righeInGiocatori } from '../src/domain/importa.ts'
import { creaMotore } from '../src/domain/motore.ts'
import { leggiFileApp, preparaImport } from '../src/data/importa-app.ts'
import { componiStato, ingressoMotore, type RigheLega } from '../src/data/componi.ts'
import type { Calendario, GiocatoreGrezzo, Rigoristi, StatoLega, Storico } from '../src/domain/tipi.ts'

const ESEMPI = fileURLToPath(new URL('../../esempi/', import.meta.url))
const UTENTE = '00000000-0000-4000-8000-0000000000e1'
const FIN = { from: 3, span: 5 }

let players: GiocatoreGrezzo[], cal: Calendario, rig: Rigoristi, hist: Storico
let S: StatoLega, html: string, db: PGlite, righe: RigheLega
const nuovoId = new Map<number, number>()
const T = (tid: number | null) => tid === null ? null : nuovoId.get(tid)!

/* le righe come le legge caricaRighe(), ma dal Postgres in memoria */
async function leggiRighe(lega: string): Promise<RigheLega> {
  const q = async <R>(sql: string) => (await comeUtente<Record<string, unknown>>(db, UTENTE, sql, [lega]))
    .map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v instanceof Date ? v.toISOString() : v])) as R)
  const [l] = await q<RigheLega['lega']>('select id, nome, stagione, budget, slots, plan, squal_on, voti_meta, rose_meta, versione, aggiornata_il from public.leghe where id = $1')
  return {
    lega: l,
    squadre: await q('select id::int as id, nome, posizione, lega_idx from public.squadre where lega_id = $1 order by posizione'),
    assegnazioni: await q('select giocatore_id, squadra_id::int as squadra_id, prezzo, snap from public.assegnazioni where lega_id = $1'),
    log: await q('select giocatore_id, squadra_id::int as squadra_id, prezzo, registrata_il from public.log_asta where lega_id = $1'),
    movimenti: await q('select id::int as id, giornata, tipo, voci, agg, rimborso, costo, registrato_il from public.movimenti where lega_id = $1'),
    indisponibili: await q('select giocatore_id, motivo, da_giornata, segnato_il from public.indisponibili where lega_id = $1'),
    squalificheAnnullate: await q('select giocatore_id, giornata from public.squalifiche_annullate where lega_id = $1'),
    voti: await q('select giornata, voti from public.voti_giornata where lega_id = $1'),
    dataset: await q('select tipo::text as tipo, dati, meta from public.dataset where lega_id = $1'),
    preferenze: null,
  }
}

beforeAll(async () => {
  players = righeInGiocatori(parseCSV(readFileSync(ESEMPI + 'listone-esempio.csv', 'utf8')))
  cal = calendarioDaRighe(parseCSV(readFileSync(ESEMPI + 'calendario-esempio.csv', 'utf8')))
  const base = costruisciLega(players, cal)
  rig = base.rig; hist = base.hist
  S = completa(base.shared, players) as StatoLega
  html = assemblaPagina({ players, cal, rig, hist, shared: S }, false)
  db = await nuovoDb()
  await db.query('insert into auth.users (id, email) values ($1, $2)', [UTENTE, 'mario.rossi@example.com'])
})

describe('import dall\'app a file singolo', () => {
  it('legge la pagina scaricata: listone, calendario, rigoristi, storico e lega', () => {
    const f = leggiFileApp(html)
    expect(f.origine).toBe('pagina')
    expect(f.players).toEqual(players)
    expect(f.cal).toEqual(cal)
    expect(f.rig).toEqual(rig)
    expect(f.hist).toEqual(hist)
    expect(f.shared).toEqual(S)
  })

  it('legge anche il backup .json, e dice perché un file non va', () => {
    const b = leggiFileApp(JSON.stringify({ shared: S, meta: { name: 'x' } }, null, 1))
    expect(b.origine).toBe('backup')
    expect(b.shared).toEqual(S)
    expect(b.players).toEqual([])
    const vuota = assemblaPagina({ players, cal, rig, hist, shared: null }, false)
    expect(() => leggiFileApp(vuota)).toThrow(/non contiene una lega/)
    expect(() => leggiFileApp('<html>altro</html>')).toThrow(/non sembra una pagina/)
    expect(() => leggiFileApp('{"a": 1}')).toThrow(/non è un backup/)
  })

  it('importa_lega: la lega torna identica, con le squadre rinumerate', async () => {
    const { pacchetto, riepilogo } = preparaImport(leggiFileApp(html))
    expect(riepilogo).toMatchObject({ squadre: 10, giornate: 10, movimenti: 2, indisponibili: 3, calendario: true, calendarioLega: true, avvisi: [] })
    const [{ importa_lega: lega }] = await comeUtente<{ importa_lega: string }>(db, UTENTE,
      'select public.importa_lega($1, $2::jsonb)', ['Lega importata', JSON.stringify(pacchetto)])
    righe = await leggiRighe(lega)
    righe.squadre.forEach((s, i) => nuovoId.set(S.teams[i].id, s.id))

    const R = componiStato(righe)
    expect(R.teams).toEqual(S.teams.map(t => ({ id: T(t.id), name: t.name })))
    expect([R.budget, R.slots, R.plan, R.squalOn]).toEqual([S.budget, S.slots, S.plan, true])
    expect(R.assign).toEqual(Object.fromEntries(Object.entries(S.assign).map(([pid, a]) => [pid, { ...a, team: T(a.team) }])))
    expect(R.log).toEqual(S.log.map(l => ({ ...l, team: T(l.team) })))
    expect(R.stats).toEqual(S.stats)
    expect(R.lega).toEqual(S.lega)
    expect(R.legaMap).toEqual(Object.fromEntries(Object.entries(S.legaMap!).map(([tid, i]) => [String(T(+tid)), i])))
    expect(R.squalSalta).toEqual(S.squalSalta)
    const senzaId = (ms: StatoLega['moves']) => ms!.map(({ id: _id, ...m }) => m)
    expect(senzaId(R.moves)).toEqual(senzaId(S.moves!.map(m => ({
      ...m,
      voci: m.voci.map(v => ({ ...v, da: T(v.da), a: T(v.a) })),
      agg: Object.fromEntries(Object.entries(m.agg).map(([tid, d]) => [String(T(+tid)), d])),
    }))))
    const out = (o: StatoLega['out']) => Object.fromEntries(Object.entries(o).map(([k, v]) =>
      [k, typeof v === 'object' ? { motivo: v.motivo, da: v.da } : { motivo: undefined, da: undefined }]))
    expect(out(R.out)).toEqual(out(S.out))
    const [m] = await comeUtente<{ ruolo: string; nome: string }>(db, UTENTE, 'select ruolo, nome from public.membri where lega_id = $1', [lega])
    expect(m).toEqual({ ruolo: 'admin', nome: 'mario.rossi' })
  })

  it('il motore dà gli stessi numeri prima e dopo l\'import', () => {
    const prima = creaMotore({ players, cal, rig, hist, stato: S, finestra: FIN })
    const dopo = creaMotore(ingressoMotore(righe, { finestra: FIN }))
    for (const t of S.teams) {
      const n = T(t.id)!
      const st = (x: ReturnType<typeof prima.stats>) => [x.spent, x.left, x.max, x.count, x.perRole]
      expect(st(dopo.stats(n))).toEqual(st(prima.stats(t.id)))
      const g = (x: ReturnType<typeof prima.giudizio>) => x && [x.voto, x.parti, x.pro, x.contro, x.resa]
      expect(g(dopo.giudizio(n))).toEqual(g(prima.giudizio(t.id)))
      expect(dopo.attesoRosa(n, 5).media).toBe(prima.attesoRosa(t.id, 5).media)
      expect(dopo.scontro(n, 2)?.pVinco).toBe(prima.scontro(t.id, 2)?.pVinco)
      expect(dopo.legaIncroci(n).map(x => x.nera)).toEqual(prima.legaIncroci(t.id).map(x => x.nera))
    }
    for (const p of prima.PL) {
      const q = dopo.byId.get(p.id)!
      expect([dopo.attesa(p.id), dopo.attesaOra(p.id), dopo.titW(q), dopo.appet(q, 3, 5)])
        .toEqual([prima.attesa(p.id), prima.attesaOra(p.id), prima.titW(p), prima.appet(p, 3, 5)])
    }
    expect(dopo.scarsita()).toEqual(prima.scarsita())
    expect(dopo.mercato()).toEqual(prima.mercato())
    expect(dopo.squalifiche()).toEqual(prima.squalifiche())
    expect(dopo.forze()).toEqual(prima.forze())
  })

  it('un\'assegnazione a una squadra che non esiste più resta fuori, con un avviso', () => {
    const S2 = structuredClone(S)
    S2.assign[123456] = { team: 99, price: 5, snap: { id: 123456, r: 'A', n: 'Orfano O.', s: 'Alfa', q: 3 } }
    const { pacchetto, riepilogo } = preparaImport({ ...leggiFileApp(html), shared: S2 })
    expect(pacchetto.assegnazioni.some(a => a.giocatore_id === 123456)).toBe(false)
    expect(riepilogo.avvisi).toEqual([expect.stringContaining('Orfano O.')])
  })
})
