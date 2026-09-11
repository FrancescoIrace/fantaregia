/* ══ Import di listone e calendario ══════════════════════════════════
   Port di rowsToPlayers/parseCSV (src/part6.html, «Import di un listone
   aggiornato») e del convertitore del calendario di tools/dati.mjs. I file
   li porta chi usa l'app: qui c'è solo il codice che li legge.

   Le intestazioni sono riconosciute in modo tollerante, il csv rispetta le
   virgolette (i ruoli Mantra contengono ";") e il separatore si decide su
   tutte le prime righe, non sulla prima — che spesso è un titolo.        */
import type { Calendario, GiocatoreGrezzo, Ruolo, Storico, VotoRiga } from './tipi.ts'

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

/** i giocatori già in rosa che il listone nuovo non ha più restano, con la
    fotografia del momento dell'acquisto (come importFile nell'originale) */
export function unisciRimasti(nuovo: GiocatoreGrezzo[], assegnati: ({ id: number; r: Ruolo; n: string; s: string; q: number } | null | undefined)[]) {
  const ids = new Set(nuovo.map(p => p[0])), players = [...nuovo]
  let rimasti = 0
  for (const s of assegnati) {
    if (!s || ids.has(s.id)) continue
    players.push([s.id, s.r, '', s.n, s.s, s.q, s.q, 1]); ids.add(s.id); rimasti++
  }
  return { players, rimasti }
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

/* ══ Voti di giornata (parseVoti di src/part6.html) ══════════════════
   Il file dei voti è a blocchi: una riga col nome della squadra, poi i
   giocatori [Id, ruolo, nome, voto, Gf, Gs, Rp, Rs, Rf, Au, Amm, Esp, Ass].
   Il voto con l'asterisco è senza voto (sv). Rf non si somma: i rigori
   segnati sono già dentro Gf — se Rf supera Gf la riga è sospetta.   */
export interface VotiLetti {
  voti: Record<string, VotoRiga>
  info: Record<string, { n: string; s: string }>
  righe: number
  rfSospetto: number
}
export function leggiVoti(rows: unknown[][]): VotiLetti {
  const out: Record<string, VotoRiga> = {}, info: Record<string, { n: string; s: string }> = {}
  let rfSospetto = 0, righe = 0, squadra = ''
  for (const raw of rows) {
    const c = (raw || []).map(x => x === undefined ? '' : x)
    // riga con il solo nome della squadra: apre un blocco
    if (typeof c[0] === 'string' && c[0] && !c[1] && c[0].length < 26 && !/^voti|file|www|iscritti/i.test(c[0])) { squadra = c[0].trim(); continue }
    if (typeof c[0] !== 'number') continue      // intestazioni e note legali
    if (String(c[1] || '').toUpperCase() === 'ALL') continue   // allenatori
    const id = Math.round(c[0])
    const txt = String(c[3] == null ? '' : c[3]).trim()
    if (!txt) continue
    const sv = /\*/.test(txt) ? 1 : 0
    const voto = parseFloat(txt.replace('*', '').replace(',', '.'))
    if (!isFinite(voto)) continue
    const num = (i: number) => { const v = parseFloat(String(c[i])); return isFinite(v) ? v : 0 }
    const gf = num(4), rf = num(8)
    if (rf > gf) rfSospetto++      // i rigori segnati devono già essere dentro Gf
    out[id] = [voto, sv, gf, num(5), num(6), num(7), num(9), num(10), num(11), num(12)]
    info[id] = { n: String(c[2] || '').trim(), s: squadra }
    righe++
  }
  if (righe < 80) throw new Error('ho letto solo ' + righe + ' giocatori: il file non sembra quello dei voti')
  return { voti: out, info, righe, rfSospetto }
}

/** la giornata scritta nel titolo del file («3ª giornata»), guardando le prime righe di ogni foglio */
export function giornataDaTitolo(fogli: unknown[][][]): number | null {
  for (const rows of fogli) {
    for (let i = 0; i < 4 && i < rows.length; i++) {
      const m = String((rows[i] || [])[0] || '').match(/(\d{1,2})\s*[ªa°]?\s*giornata/i)
      if (m) return parseInt(m[1])
    }
  }
  return null
}

/* ══ Statistiche di una stagione conclusa (tools/dati.mjs) ═══════════
   Colonne del file ufficiale: Id, R, Rm, Nome, Squadra, Pv, Mv, Fm, Gf,
   Gs, Rp, Rc, R+, R-, Ass, Amm, Esp, Au. L'aggancio ai giocatori è per Id. */
export function storicoDaRighe(righe: unknown[][]): Storico {
  const num = (v: unknown) => { const n = parseFloat(String(v)); return isFinite(n) ? n : 0 }
  const out: Storico = {}
  for (const r of righe.filter(r => r && r[0])) {
    const id = parseInt(String(r[0])); if (!(id > 0)) continue
    const pv = num(r[5])
    out[id] = pv
      ? [pv, Math.round(num(r[6]) * 100) / 100, Math.round(num(r[7]) * 100) / 100,
        num(r[8]), num(r[9]), num(r[10]), num(r[11]), num(r[12]), num(r[13]),
        num(r[14]), num(r[15]), num(r[16]), num(r[17]), String(r[4] ?? '').trim()]
      : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, String(r[4] ?? '').trim()]
  }
  if (Object.keys(out).length < 50) throw new Error('ho letto solo ' + Object.keys(out).length + ' giocatori: il file non sembra quello delle statistiche')
  return out
}

/* ══ Calendario di serie A da openfootball ═══════════════════════════
   Fonte aperta (github.com/openfootball/football.json): partite, date e
   giornate sono fatti, non un dataset di qualcuno. I club lì hanno il
   nome completo («FC Internazionale Milano»), nel listone quello corto
   («Inter»): si tolgono sigle e anni e si confronta. Chi non si abbina
   resta col suo nome ripulito, e viene segnalato.                     */
export interface PartitaAperta { round: string; date?: string; team1: string; team2: string }

const RUMORE = /\b(fc|ac|as|ss|ssc|us|acf|afc|bc|cfc|calcio|club|hellas|\d{4})\b/g
function nucleo(nome: string) {
  const s = nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(RUMORE, ' ').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim()
  return /\binternazionale\b/.test(s) ? 'inter' : s
}

export function calendarioDaOpenfootball(partite: PartitaAperta[], squadreListone: string[] = []): { cal: Calendario; ignote: string[] } {
  const perNucleo = new Map(squadreListone.map(s => [nucleo(s), s]))
  const nomeDi = new Map<string, string>(), ignote: string[] = []
  const traduci = (club: string) => {
    if (nomeDi.has(club)) return nomeDi.get(club)!
    const k = nucleo(club)
    let nome = perNucleo.get(k)
    if (!nome) for (const [n, s] of perNucleo) if (n && k && (n.startsWith(k) || k.startsWith(n))) { nome = s; break }
    if (!nome) {
      nome = k.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
      if (squadreListone.length) ignote.push(club)
    }
    nomeDi.set(club, nome)
    return nome
  }
  const righe = partite
    .map(p => ({ g: parseInt((p.round.match(/\d+/) || ['0'])[0]), casa: traduci(p.team1), osp: traduci(p.team2), data: p.date }))
    .filter(r => r.g >= 1 && r.g <= 38)
  if (!righe.length) throw new Error('nessuna partita riconosciuta nel calendario')
  const squadre = [...new Set(righe.flatMap(r => [r.casa, r.osp]))].sort()
  const giornate = Math.max(...righe.map(r => r.g))
  const idx = new Map(squadre.map((t, i) => [t, i]))
  const fix = squadre.map(() => Array<number>(giornate).fill(0))
  const dates = Array<string | null>(giornate).fill(null)
  for (const r of righe) {
    fix[idx.get(r.casa)!][r.g - 1] = idx.get(r.osp)! + 1       // positivo: si gioca in casa
    fix[idx.get(r.osp)!][r.g - 1] = -(idx.get(r.casa)! + 1)    // negativo: in trasferta
    // la data della giornata è quella dell'ultima partita: finché si gioca, è ancora «questa»
    if (r.data && /^\d{4}-\d{2}-\d{2}$/.test(r.data) && (!dates[r.g - 1] || r.data > dates[r.g - 1]!)) dates[r.g - 1] = r.data
  }
  return { cal: { teams: squadre, fix, dates }, ignote }
}
