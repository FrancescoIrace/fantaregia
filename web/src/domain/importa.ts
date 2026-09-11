/* ══ Import di listone e calendario ══════════════════════════════════
   Port di rowsToPlayers/parseCSV (src/part6.html, «Import di un listone
   aggiornato») e del convertitore del calendario di tools/dati.mjs. I file
   li porta chi usa l'app: qui c'è solo il codice che li legge.

   Le intestazioni sono riconosciute in modo tollerante, il csv rispetta le
   virgolette (i ruoli Mantra contengono ";") e il separatore si decide su
   tutte le prime righe, non sulla prima — che spesso è un titolo.        */
import type { Calendario, GiocatoreGrezzo, Ruolo } from './tipi.ts'

const RUOLI: Ruolo[] = ['P', 'D', 'C', 'A']
const HEAD = {
  id: ['id'], r: ['r', 'ruolo'], rm: ['rm', 'ruolo mantra', 'ruolim'], n: ['nome', 'giocatore'],
  s: ['squadra', 'team'], q: ['qt.a', 'qta', 'qt a', 'quotazione', 'qt.a m', 'valore'], f: ['fvm', 'fvm m'],
}
type Colonne = Record<keyof typeof HEAD, number>

function pickCols(row: unknown[]): Colonne {
  const low = row.map(c => String(c == null ? '' : c).trim().toLowerCase())
  const find = (keys: string[]) => { for (const k of keys) { const i = low.indexOf(k); if (i >= 0) return i } return -1 }
  return { id: find(HEAD.id), r: find(HEAD.r), rm: find(HEAD.rm), n: find(HEAD.n), s: find(HEAD.s), q: find(HEAD.q), f: find(HEAD.f) }
}

/** righe di un foglio (csv o xlsx) → listone nel formato di window.PLAYERS */
export function righeInGiocatori(rows: unknown[][]): GiocatoreGrezzo[] {
  let hi = -1, cols: Colonne | null = null
  for (let i = 0; i < Math.min(12, rows.length); i++) {
    const c = pickCols(rows[i] || [])
    if (c.n >= 0 && c.s >= 0 && c.q >= 0 && c.r >= 0) { hi = i; cols = c; break }
  }
  if (hi < 0 || !cols) throw new Error('non trovo le colonne Nome, Squadra, R e Qt.A')
  const out: GiocatoreGrezzo[] = [], seen = new Set<number>()
  for (let i = hi + 1; i < rows.length; i++) {
    const row = rows[i] || []
    const name = String(row[cols.n] == null ? '' : row[cols.n]).trim()
    const team = String(row[cols.s] == null ? '' : row[cols.s]).trim()
    const role = String(row[cols.r] == null ? '' : row[cols.r]).trim().toUpperCase().charAt(0) as Ruolo
    const q = Math.round(Number(row[cols.q]))
    if (!name || !team || !RUOLI.includes(role) || !(q >= 0)) continue
    let id = cols.id >= 0 ? parseInt(String(row[cols.id])) : NaN
    if (!(id > 0)) { id = 0; const key = name + '|' + team; for (let k = 0; k < key.length; k++) id = (id * 31 + key.charCodeAt(k)) | 0; id = Math.abs(id) % 900000 + 100000 }
    if (seen.has(id)) continue
    seen.add(id)
    const f = cols.f >= 0 ? Math.round(Number(row[cols.f])) : 0
    out.push([id, role, cols.rm >= 0 ? String(row[cols.rm] || '').trim() : '', name, team, q, f > 0 ? f : Math.max(1, q), 1])
  }
  if (out.length < 50) throw new Error('ho letto solo ' + out.length + ' giocatori: il file non sembra un listone')
  return out
}

/** il separatore di un csv, deciso sulle prime venti righe senza le parti fra virgolette */
export function separatoreCSV(txt: string) {
  const head = txt.split(/\r?\n/).slice(0, 20).join('\n').replace(/"[^"]*"/g, '')
  const nsemi = (head.match(/;/g) || []).length, ntab = (head.match(/\t/g) || []).length, ncom = (head.match(/,/g) || []).length
  return nsemi >= ncom && nsemi >= ntab ? ';' : (ntab >= ncom ? '\t' : ',')
}

export function parseCSV(txt: string, sep = separatoreCSV(txt)): string[][] {
  const rows: string[][] = []; let row: string[] = [], cell = '', q = false
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i]
    if (q) {
      if (c === '"') { if (txt[i + 1] === '"') { cell += '"'; i++ } else q = false }
      else cell += c
    } else if (c === '"') { q = true }
    else if (c === sep) { row.push(cell.trim()); cell = '' }
    else if (c === '\n') { row.push(cell.trim()); rows.push(row); row = []; cell = '' }
    else if (c !== '\r') { cell += c }
  }
  row.push(cell.trim())
  if (row.length > 1 || row[0]) rows.push(row)
  return rows
}

/** calendario: righe giornata;casa;ospite[;data ISO], una per partita */
export function calendarioDaRighe(righeCsv: string[][]): Calendario {
  const righe = righeCsv.filter(r => r.length >= 3 && /^\d+$/.test(r[0]))
  if (!righe.length) throw new Error('nessuna riga valida: serve giornata;casa;ospite')
  const squadre = [...new Set(righe.flatMap(r => [r[1].trim(), r[2].trim()]))].sort()
  const giornate = Math.max(...righe.map(r => +r[0]))
  const idx = new Map(squadre.map((t, i) => [t, i]))
  const fix = squadre.map(() => Array<number>(giornate).fill(0))
  const dates = Array<string | null>(giornate).fill(null)
  for (const r of righe) {
    const g = +r[0] - 1, casa = r[1].trim(), osp = r[2].trim()
    fix[idx.get(casa)!][g] = idx.get(osp)! + 1       // positivo: si gioca in casa
    fix[idx.get(osp)!][g] = -(idx.get(casa)! + 1)    // negativo: in trasferta
    if (r[3] && /^\d{4}-\d{2}-\d{2}$/.test(r[3].trim())) dates[g] = r[3].trim()
  }
  return { teams: squadre, fix, dates }
}
