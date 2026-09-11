/* ══ Il motore degli indici ══════════════════════════════════════════
   Port 1:1 di src/part4.html (sezioni 2, 4-6f, 13, 18, 20, 21) e dei pezzi
   di calcolo di src/part5.html (23, 26, «Chi schierare»). Stesse formule,
   stesso ordine delle operazioni, stessi nomi: chi confronta questo file
   con l'originale deve ritrovarsi riga per riga.

   La differenza è una sola, ed è strutturale: l'originale leggeva variabili
   globali e la finestra di giornate dal DOM. Qui tutto entra da creaMotore()
   e il motore non tocca niente fuori di sé — si ricrea a ogni cambio di
   stato, e le cache vivono quanto lui.

   test/equivalenza.test.ts fa girare l'app originale in jsdom sugli stessi
   dati e pretende gli stessi numeri. Se cambi una formula qui, quel test
   deve fallire: è voluto.                                               */
import type {
  Assegnazione, Calendario, Giocatore, GiocatoreGrezzo, Movimento, Preferenze,
  Rigoristi, Ruolo, Snap, StatoLega, Storico,
} from './tipi.ts'

export const ROLES: Ruolo[] = ['P', 'D', 'C', 'A']
export const ROLENAME: Record<Ruolo, string> = { P: 'Portieri', D: 'Difensori', C: 'Centrocampisti', A: 'Attaccanti' }
/* quanto ogni ruolo Mantra spinge in avanti */
const MENT: Record<string, number> = { Por: 0, Dc: 1, Dd: 2, Ds: 2, B: 2.5, M: 3, E: 4, C: 4.5, W: 6.5, T: 6.5, A: 7.5, Pc: 8 }
export const MENTNAME: Record<string, string> = {
  Por: 'portiere', Dc: 'difensore centrale', Dd: 'terzino destro', Ds: 'terzino sinistro',
  B: 'braccetto', M: 'mediano', E: 'esterno', C: 'centrocampista centrale', W: 'ala', T: 'trequartista',
  A: 'attaccante di supporto', Pc: 'punta centrale',
}
export const MODULI: Record<string, [number, number, number]> = {
  '3-4-3': [3, 4, 3], '3-5-2': [3, 5, 2], '4-3-3': [4, 3, 3], '4-4-2': [4, 4, 2],
  '4-5-1': [4, 5, 1], '5-3-2': [5, 3, 2], '5-4-1': [5, 4, 1],
}

export const DEF: StatoLega = {
  teams: [{ id: 1, name: 'Squadra 1' }, { id: 2, name: 'Squadra 2' }, { id: 3, name: 'Squadra 3' }, { id: 4, name: 'Squadra 4' },
    { id: 5, name: 'Squadra 5' }, { id: 6, name: 'Squadra 6' }, { id: 7, name: 'Squadra 7' }, { id: 8, name: 'Squadra 8' }],
  budget: 500, slots: { P: 3, D: 8, C: 8, A: 6 }, plan: { P: 7, D: 19, C: 32, A: 42 },
  assign: {}, log: [], rev: 0, stats: {}, votiMeta: {}, out: {},
}
const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o)) as T

export interface IngressoMotore {
  players: GiocatoreGrezzo[]
  cal?: Calendario
  rig?: Rigoristi
  hist?: Storico
  stato?: Partial<StatoLega>
  me?: Partial<Preferenze>
  /** la finestra di giornate scelta nell'interfaccia (gfrom/gspan nell'originale) */
  finestra?: { from: number; span: number }
  /** "oggi": nell'app è la data del dispositivo */
  oggi?: Date
}

export type VoceRosa = { p: Giocatore; price: number }
export type Rosa = Record<Ruolo, VoceRosa[]>
export interface Forza { att: number; dif: number; n: number; w?: number; dati: boolean }
export interface Partita { g: number; opp: string; home: boolean }
export interface Parte { k: string; v: number; max: number; nota: string }

const NESSUN_MOVIMENTO: Movimento[] = []

function memo<T>(f: () => T): () => T {
  let fatto = false, v: T
  return () => { if (!fatto) { v = f(); fatto = true } return v }
}

export function creaMotore(input: IngressoMotore) {
  /* ══ 2. Dati ════════════════════════════════════════════════════════ */
  const PL: Giocatore[] = (input.players || []).map(a => ({ id: a[0], r: a[1], rm: a[2], n: a[3], s: a[4], q: a[5], f: a[6], v: a[7] }))
  const byId = new Map(PL.map(p => [p.id, p]))
  const CAL: Calendario = input.cal || { teams: [], fix: [], dates: [] }
  const RIG: Rigoristi = input.rig || {}   // id -> [gerarchia, confermato da entrambe le fonti]
  /* statistiche 2025/26, agganciate per Id: [Pv,Mv,Fm,Gf,Gs,Rp,Rc,R+,R-,Ass,Amm,Esp,Au] */
  const HIST: Storico = input.hist || {}
  const CALTEAMS = CAL.teams, CALIDX = new Map(CALTEAMS.map((t, i) => [t, i]))
  /* stato condiviso: quello della lega */
  const S: StatoLega = Object.assign(clone(DEF), input.stato || {})
  /* stato privato di chi guarda: squadra scelta, obiettivi, prezzi max */
  const ME: Preferenze = Object.assign({ myTeam: null, targets: {} }, input.me || {})
  const FIN = input.finestra || { from: 1, span: 5 }
  const gFrom = () => Math.max(1, Math.min(38, Math.trunc(FIN.from) || 1))
  const gSpan = () => Math.max(1, Math.min(38, Math.trunc(FIN.span) || 5))

  /* ══ 4. Derivate ════════════════════════════════════════════════════ */
  function meId(): number {
    if (ME.myTeam && S.teams.some(t => t.id === ME.myTeam)) return ME.myTeam
    return S.teams.length ? S.teams[0].id : 0
  }
  const isMine = (tid: number) => ME.myTeam === tid
  const totalSlots = () => ROLES.reduce((a, r) => a + S.slots[r], 0)
  function roster(tid: number): Rosa {
    const out: Rosa = { P: [], D: [], C: [], A: [] }
    for (const pid in S.assign) {
      const a = S.assign[pid]
      if (a.team === tid) {
        const p = byId.get(+pid) || a.snap
        if (p) out[p.r].push({ p, price: a.price })
      }
    }
    for (const r of ROLES) out[r].sort((a, b) => b.price - a.price || a.p.n.localeCompare(b.p.n))
    return out
  }
  function stats(tid: number) {
    const R = roster(tid); let spent = 0, count = 0
    const perRole = {} as Record<Ruolo, { spent: number; count: number }>
    for (const r of ROLES) { const s = R[r].reduce((a, x) => a + x.price, 0); perRole[r] = { spent: s, count: R[r].length }; spent += s; count += R[r].length }
    // la correzione dei movimenti va tolta dalla SPESA, non aggiunta al residuo:
    // altrimenti il residuo torna ma la spesa mostra 1075 su un budget di 1000
    spent -= aggCrediti(tid)
    const left = S.budget - spent, slotsLeft = totalSlots() - count
    return { R, spent, count, left, slotsLeft, perRole, max: slotsLeft > 0 ? Math.max(0, left - (slotsLeft - 1)) : 0 }
  }
  const teamName = (tid: number) => { const t = S.teams.find(x => x.id === tid); return t ? t.name : '?' }

  /* ══ 5. Convenienza e forze delle squadre (ricalcolate dal listone) ══ */
  let FORCEQ: Record<string, { att: number; dif: number }> = {}   // forze dalle quotazioni: il punto di partenza
  function recompute() {
    // convenienza: scostamento dall'FVM atteso per fascia di prezzo, per ruolo
    for (const role of ROLES) {
      const rs = PL.filter(p => p.r === role && p.q > 0 && p.f! > 0)
      if (rs.length < 8) { rs.forEach(p => p.v = 1); continue }
      const xs = rs.map(p => Math.log(p.q)), ys = rs.map(p => Math.log(p.f!))
      const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n
      let num = 0, den = 0
      for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2 }
      const a = den ? num / den : 1, b = my - a * mx
      rs.forEach(p => { p.v = Math.round(p.f! / Math.exp(a * Math.log(p.q) + b) * 100) / 100 })
      PL.filter(p => p.r === role && !(p.q > 0 && p.f! > 0)).forEach(p => p.v = 1)
    }
    // Titolarità dedotta dalle quotazioni: dentro squadra e ruolo, chi è quotato
    // di più è chi il mercato si aspetta in campo. Si ricalcola a ogni listone.
    const K: Record<Ruolo, number> = { P: 1, D: 4, C: 4, A: 2 }
    const squadre = [...new Set(PL.map(p => p.s))]
    for (const t of squadre) for (const role of ROLES) {
      const grp = PL.filter(p => p.s === t && p.r === role).sort((a, b) => b.q - a.q || b.f! - a.f!)
      grp.forEach((p, i) => { p.rank = i + 1 })
    }
    for (const p of PL) {
      const k = K[p.r] || 4
      p.tit = (p.rank! <= k && p.q >= 4) ? 1 : (p.rank! <= k + 3 && p.q >= 3) ? 2 : (p.q >= 2) ? 3 : 4
    }
    // Mentalità: quanto il ruolo Mantra è orientato in avanti. Media dei codici,
    // non massimo: un "C;T" sta davvero a metà fra i due, e un "Dd;E" pure.
    for (const p of PL) {
      const cs = (p.rm || '').split(';').map(x => x.trim()).filter(x => x in MENT)
      p.off = cs.length ? cs.reduce((a, x) => a + MENT[x], 0) / cs.length : null
      p.mn = p.off === null ? null : Math.max(0, Math.min(1, (p.off - 1) / 4))
    }
    // valore atteso dentro il ruolo, su scala logaritmica: conserva le distanze vere
    for (const role of ROLES) {
      const grp = PL.filter(p => p.r === role)
      if (!grp.length) continue
      const lo = Math.log(Math.max(1, Math.min(...grp.map(p => p.f || 1))))
      const hi = Math.log(Math.max(1, Math.max(...grp.map(p => p.f || 1))))
      const d = (hi - lo) || 1
      grp.forEach(p => { p.val = (Math.log(Math.max(1, p.f || 1)) - lo) / d })
    }
    // forze: attacco e difesa dalle quotazioni della rosa
    const top = (t: string, roles: Ruolo[], k: number) => PL.filter(p => p.s === t && roles.includes(p.r)).map(p => p.q).sort((x, y) => y - x).slice(0, k).reduce((a, b) => a + b, 0)
    const raw: Record<string, { att: number; dif: number }> = {}
    for (const t of CALTEAMS) raw[t] = { att: top(t, ['A'], 3) + 0.8 * top(t, ['C'], 4), dif: 1.4 * top(t, ['P'], 1) + 0.7 * top(t, ['D'], 4) }
    const zf = (key: 'att' | 'dif') => {
      const v = CALTEAMS.map(t => raw[t][key])
      const m = v.reduce((a, b) => a + b, 0) / v.length
      const sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length) || 1
      return (x: number) => (x - m) / sd
    }
    const za = zf('att'), zd = zf('dif')
    FORCEQ = {}
    for (const t of CALTEAMS) FORCEQ[t] = { att: za(raw[t].att), dif: zd(raw[t].dif) }
  }
  recompute()

  /* ══ 6. Calendario ══════════════════════════════════════════════════ */
  function fixtures(team: string, from: number, span: number): Partita[] {
    const i = CALIDX.get(team); if (i === undefined) return []
    const row = CAL.fix[i] || [], out: Partita[] = []
    for (let g = from; g < from + span && g <= 38; g++) {
      const c = row[g - 1]; if (!c) continue
      out.push({ g, opp: CALTEAMS[Math.abs(c) - 1], home: c > 0 })
    }
    return out
  }
  /* ══ Forze delle squadre: dalle quotazioni ai risultati ══════════════
     Misurato sulla serie A 2025/26 vera (28 giornate, 280 partite): la forza
     di una squadra è persistente (andata↔ritorno 0,58 in attacco, 0,55 in
     difesa), la FORMA invece non esiste (r = −0,06 sui gol fatti, −0,09 sui
     subiti). Pesando di più le partite recenti si prevede PEGGIO, in modo
     monotono. Per questo tutte le giornate pesano uguale e non c'è nessun
     fattore forma; i risultati prendono peso n/(n+10) sulle quotazioni.
     Lo studio completo è in tools/studio-forma.cjs.                      */
  const FORZA_K = 10
  /* gol fatti e subiti per squadra e giornata, ricavati dai voti già caricati */
  function golDaiVoti() {
    const out: Record<string, { g: number; casa: boolean; avv: string; gf: number; gs: number }[]> = {}
    for (const g of giornateGiocate()) {
      const V = S.stats[g] || {}
      const gio: Record<string, { gf: number; gs: number; au: number }> = {}
      for (const pid in V) {
        const p = byId.get(+pid) || S.assign[pid]?.snap; if (!p || !p.s) continue
        const a = V[pid]
        const t = gio[p.s] || (gio[p.s] = { gf: 0, gs: 0, au: 0 })
        t.gf += a[2] || 0; t.gs += a[3] || 0; t.au += a[6] || 0
      }
      for (const t in gio) {
        const f = fixtures(t, g, 1)[0]; if (!f) continue
        const avv = gio[f.opp]
        out[t] = out[t] || []
        out[t].push({
          g, casa: f.home, avv: f.opp,
          gf: gio[t].gf + (avv ? avv.au : 0),        // gli autogol avversari sono gol nostri
          gs: gio[t].gs,
        })
      }
    }
    return out
  }
  /* attacco e difesa moltiplicativi stimati dai risultati, poi mescolati
     con le quotazioni secondo quante giornate ci sono */
  function calcForze(): Record<string, Forza> {
    const F: Record<string, Forza> = {}
    for (const t of CALTEAMS) F[t] = { att: (FORCEQ[t] || { att: 0 }).att, dif: (FORCEQ[t] || { dif: 0 }).dif, n: 0, dati: false }
    const R = golDaiVoti()
    const squadre = CALTEAMS.filter(t => R[t] && R[t].length)
    // se una squadra manca dai voti (turno rinviato, file parziale) resta sulle
    // sue quotazioni invece di far saltare tutto il calcolo
    if (squadre.length < Math.max(8, CALTEAMS.length - 4)) return F
    let tot = 0, np = 0
    for (const t of squadre) for (const x of R[t]) { tot += x.gf; np++ }
    const mu = np ? tot / np : 1.3
    const att: Record<string, number> = {}, dif: Record<string, number> = {}; let hf = 1.15
    for (const t of squadre) { att[t] = 1; dif[t] = 1 }
    for (let it = 0; it < 20; it++) {
      for (const t of squadre) {
        let nf = 0, df = 0, ns = 0, ds = 0
        for (const x of R[t]) {
          nf += x.gf; df += mu * dif[x.avv] * (x.casa ? hf : 1)
          ns += x.gs; ds += mu * att[x.avv] * (x.casa ? 1 : hf)
        }
        if (df > 0) att[t] = Math.max(0.25, Math.min(3, nf / df))
        if (ds > 0) dif[t] = Math.max(0.25, Math.min(3, ns / ds))
      }
      let nh = 0, dh = 0
      for (const t of squadre) for (const x of R[t]) if (x.casa) { nh += x.gf; dh += mu * att[t] * dif[x.avv] }
      if (dh > 0) hf = Math.max(0.9, Math.min(1.5, nh / dh))
    }
    /* dai moltiplicatori agli scarti standard, così la scala resta quella di prima */
    const z = (vals: Record<string, number>) => {
      const v = Object.values(vals)
      const m = v.reduce((a, b) => a + b, 0) / v.length
      const sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length) || 1
      return (x: number) => (x - m) / sd
    }
    const za = z(att), zd = z(dif)
    for (const t of squadre) {
      const n = R[t].length, w = n / (n + FORZA_K)
      const q = FORCEQ[t] || { att: 0, dif: 0 }
      F[t] = {
        att: (1 - w) * q.att + w * za(att[t]),
        dif: (1 - w) * q.dif - w * zd(dif[t]),   // dif alta = subisce poco: il segno si gira
        n, w, dati: true,
      }
    }
    return F
  }
  const forze = memo(calcForze)
  /* difficoltà 1 (facile) … 5 (proibitiva) per una singola partita */
  function fixDiff(opp: string, off: boolean, home: boolean): number {
    const F = forze()[opp]; if (!F) return 3
    const z = off ? F.dif : F.att         // a chi attacca pesa la difesa avversaria
    const d = 3 + z * 1.05 - (home ? 0.35 : -0.15)
    return Math.max(1, Math.min(5, d))
  }
  const isOff = (role: Ruolo) => role === 'C' || role === 'A'
  /* appetibilità 1…5, 5 = calendario più morbido */
  function calScore(team: string, role: Ruolo, from: number, span: number): number | null {
    const fx = fixtures(team, from, span); if (!fx.length) return null
    const off = isOff(role)
    return 6 - fx.reduce((a, f) => a + fixDiff(f.opp, off, f.home), 0) / fx.length
  }

  /* ══ 6c. Rendimento: voti di giornata già giocati ═══════════════════
     S.stats = { "3": { idGiocatore: [voto, sv, gf, gs, rp, rs, au, amm, esp, ass] } }
     Il fantavoto segue lo schema classico: gol +3, assist +1, rigore parato +3,
     rigore sbagliato −3, autogol −2, ammonizione −0,5, espulsione −1, gol subito −1.
     La colonna Rf del file non viene sommata: i rigori segnati sono già dentro Gf. */
  const fvOf = (a: number[]) => a[0] + 3 * a[2] - a[3] + 3 * a[4] - 3 * a[5] - 2 * a[6] - 0.5 * a[7] - a[8] + a[9]
  const giornateGiocate = memo(() => Object.keys(S.stats || {}).map(Number).sort((a, b) => a - b))
  const _scache = new Map<number, StatGiocatore | null>()
  function statFor(id: number): StatGiocatore | null {
    if (_scache.has(id)) return _scache.get(id)!
    const v = statCalc(id); _scache.set(id, v); return v
  }
  function statCalc(id: number): StatGiocatore | null {
    const gs = giornateGiocate(); if (!gs.length) return null
    let pres = 0, sv = 0, sumV = 0, nV = 0, sumF = 0, gf = 0, ass = 0, amm = 0, esp = 0, sub = 0, rp = 0, rs = 0, au = 0, cs = 0, conBonus = 0
    const serie: (VoceSerie | null)[] = []
    for (const g of gs) {
      const a = S.stats[g][id]; if (!a) { serie.push(null); continue }
      const fv = fvOf(a)
      pres++; sumF += fv
      serie.push({ g, fv, v: a[0], sv: a[1], gf: a[2], sub: a[3], rp: a[4], rs: a[5], au: a[6], amm: a[7], esp: a[8], ass: a[9] })
      if (a[1]) sv++; else { sumV += a[0]; nV++ }
      gf += a[2]; sub += a[3]; rp += a[4]; rs += a[5]; au += a[6]; amm += a[7]; esp += a[8]; ass += a[9]
      if (a[3] === 0) cs++                       // porta inviolata, ha senso solo per i portieri
      if (a[2] || a[9] || a[4]) conBonus++         // giornate in cui ha portato un bonus
    }
    if (!pres) return { pres: 0, su: gs.length, serie }
    const ok = serie.filter(pieno)
    const best = ok.reduce<VoceSerie | null>((a, x) => !a || x.fv > a.fv ? x : a, null)
    const worst = ok.reduce<VoceSerie | null>((a, x) => !a || x.fv < a.fv ? x : a, null)
    const mv = nV ? sumV / nV : null
    const fm = sumF / pres
    return {
      pres, su: gs.length, sv, mv, fm,
      gf, ass, amm, esp, sub, rp, rs, au, cs,
      conBonus,
      bonus: (3 * gf + ass + 3 * rp) / pres,               // quanto aggiunge al voto, per presenza
      malus: (sub + 0.5 * amm + esp + 2 * au + 3 * rs) / pres,   // quanto toglie, per presenza
      scarto: mv === null ? null : fm - mv,              // il vero valore aggiunto oltre la pagella
      best, worst, serie,
    }
  }
  /* forma: fantamedia delle ultime N presenze contro quella di tutta la stagione */
  function formaOf(id: number, n?: number) {
    const st = statFor(id); if (!st || st.pres < 2) return null
    const ok = st.serie.filter(pieno)
    const k = n || 3
    // se le ultime N presenze sono tutte le sue presenze, il confronto è con
    // sé stesso e darebbe sempre zero: la forma esiste solo da lì in poi
    if (ok.length <= k) return null
    const last = ok.slice(-k)
    if (last.length < 2) return null
    const fmLast = last.reduce((a, x) => a + x.fv, 0) / last.length
    return { fm: fmLast, delta: fmLast - st.fm!, n: last.length }
  }

  /* ══ 6b. Titolarità, rigori, appetibilità ═══════════════════════════ */
  const TITLAB: Record<number, string> = { 1: 'titolare', 2: 'ballottaggio', 3: 'panchina', 4: 'fuori lista' }
  const TITW: Record<number, number> = { 1: 1, 2: 0.6, 3: 0.25, 4: 0.05 }
  const rigOf = (p: Giocatore) => RIG[p.id] || null

  /* ── Titolarità: dalla stima ai fatti ────────────────────────────────
     Finché non ci sono voti, la titolarità è dedotta dalle quotazioni. Poi
     il campo ha l'ultima parola: una presenza con voto vale una titolarità
     piena, una senza voto (uno spezzone) vale un terzo. La fiducia nei dati
     cresce con le giornate e diventa piena alla sesta.                   */
  const TITFULL = 6

  /* ── La stagione scorsa: aggancio per Id, esatto ── */
  const HK = ['pv', 'mv', 'fm', 'gf', 'gs', 'rp', 'rc', 'rpiu', 'rmeno', 'ass', 'amm', 'esp', 'au', 'sq'] as const
  function annoScorso(id: number): AnnoScorso | null {
    const a = HIST[id]; if (!a || !a[0]) return null
    const o = {} as Record<string, number | string>
    HK.forEach((k, i) => o[k] = a[i] || 0)
    const h = o as unknown as AnnoScorso
    h.su = 38
    h.bonus = (3 * h.gf + h.ass + 3 * h.rp) / h.pv          // quanto aggiungeva al voto, per presenza
    h.scarto = h.fm - h.mv                                  // il valore oltre la pagella
    h.cart = (h.amm + 2 * h.esp) / h.pv                     // rischio cartellini per presenza
    return h
  }
  /* mediane di ruolo fra chi ha giocato almeno 15 partite */
  const medieRuolo = memo(() => {
    const out = {} as Record<Ruolo, { n: number; fm: number | null; mv: number | null; bonus: number | null; cart: number | null; pv: number | null }>
    for (const r of ROLES) {
      const v = PL.filter(p => p.r === r).map(p => annoScorso(p.id)).filter((h): h is AnnoScorso => !!h && h.pv >= 15)
      const med = (arr: number[]) => {
        if (!arr.length) return null; const s = [...arr].sort((a, b) => a - b)
        return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
      }
      out[r] = { n: v.length, fm: med(v.map(h => h.fm)), mv: med(v.map(h => h.mv)),
        bonus: med(v.map(h => h.bonus)), cart: med(v.map(h => h.cart)), pv: med(v.map(h => h.pv)) }
    }
    return out
  })
  /* posizione nel ruolo, fra chi ha giocato almeno 15 partite */
  function rangoFm(p: Giocatore) {
    const h = annoScorso(p.id); if (!h || h.pv < 15) return null
    const v = PL.filter(x => x.r === p.r).map(x => ({ id: x.id, h: annoScorso(x.id) }))
      .filter((x): x is { id: number; h: AnnoScorso } => !!x.h && x.h.pv >= 15).sort((a, b) => b.h.fm - a.h.fm)
    const i = v.findIndex(x => x.id === p.id)
    return i < 0 ? null : { pos: i + 1, su: v.length }
  }
  /* presenze dell'anno scorso tradotte in titolarità 0..1:
     30 partite su 38 è un titolare pieno, sotto le 6 è uno che non gioca */
  const titStorica = (h: AnnoScorso) => Math.max(0, Math.min(1, (h.pv - 6) / 24))

  function titFatti(id: number) {
    const st = statFor(id)
    if (!st || !st.su) return null
    const pieno = (st.pres || 0) - (st.sv || 0), spezzoni = st.sv || 0
    return { su: st.su, pres: st.pres || 0, pieno, sv: spezzoni,
      quota: Math.max(0, Math.min(1, (pieno + 0.35 * spezzoni) / st.su)) }
  }
  /* Il punto di partenza mette insieme la quotazione (guarda avanti) e le
     presenze dell'anno scorso (guardano indietro ma sono un fatto): 60 e 40,
     perché si correlano solo 0,50 — ciascuna dice qualcosa che l'altra no. */
  function titPrior(p: Giocatore) {
    const base = TITW[p.tit || 3]
    const h = annoScorso(p.id)
    if (!h) return base
    return 0.6 * base + 0.4 * titStorica(h)
  }
  function titW(p: Giocatore): number {
    if (isOut(p.id)) return 0
    const base = titPrior(p)
    const f = titFatti(p.id)
    if (!f) return base
    const fid = Math.min(1, f.su / TITFULL)
    return (1 - fid) * base + fid * f.quota
  }
  const titLiv = (w: number) => w >= 0.75 ? 1 : w >= 0.45 ? 2 : w >= 0.12 ? 3 : 4
  /* stato mostrato: livello, se viene dai fatti, e la frase che lo spiega */
  function titStato(p: Giocatore): TitStato {
    if (isOut(p.id)) return { w: 0, liv: 4, dati: false, out: true, breve: 'indisponibile', nota: 'segnato indisponibile' }
    const w = titW(p), f = titFatti(p.id), h = annoScorso(p.id)
    if (!f) {
      const liv = h ? titLiv(w) : (p.tit || 3)
      return { w, liv, dati: false, out: false, storico: !!h,
        breve: h ? TITLAB[liv] + ' · ' + h.pv + ' pres. nel 25/26' : TITLAB[liv],
        nota: h ? TITLAB[liv] + ' · quotazioni e ' + h.pv + ' presenze nel 2025/26'
          : TITLAB[p.tit || 3] + ' secondo le quotazioni' }
    }
    const liv = titLiv(w)
    const pezzi = f.pieno + ' ' + (f.pieno === 1 ? 'partita giocata' : 'partite giocate')
      + (f.sv ? ' e ' + f.sv + ' spezzone' + (f.sv === 1 ? '' : 'i') : '') + ' su ' + f.su
    return { w, liv, dati: true, out: false, storico: !!annoScorso(p.id),
      breve: TITLAB[liv] + ' · ' + f.pres + ' su ' + f.su, nota: TITLAB[liv] + ' · ' + pezzi }
  }
  /* «indisponibile adesso» = segnato a mano, oppure squalificato per la
     prossima giornata. Gli indici e la formazione automatica guardano qui. */
  const isOut = (id: number) => !!(S.out && S.out[id]) || squalificatoA(id, nextG())
  /* Mentalità: una parola al posto delle sigle, misurata DENTRO il ruolo. */
  const MENTCUT: Partial<Record<Ruolo, [number, number]>> = { D: [1.5, 3.0], C: [3.75, 5.5] }
  function mentLabel(p: Giocatore) {
    const cut = MENTCUT[p.r]
    if (!cut || p.off === null || p.off === undefined) return null   // portieri e attaccanti: spingono tutti
    if (p.off <= cut[0]) return { k: 'cop', t: 'copertura' }
    if (p.off < cut[1]) return { k: 'equ', t: 'equilibrata' }
    return { k: 'off', t: 'offensiva' }
  }
  /* 0–100: quanto vale volerlo, mettendo insieme le cose che il prezzo non dice.
     Ai difensori 8 punti dei 35 del valore passano alla mentalità: è l'unico ruolo
     in cui, a parità di prezzo, spingere in avanti rende più di quanto il listino
     lasci intendere (correlazione +0,29 col residuo, contro +0,01 dei centrocampisti). */
  function appetParts(p: Giocatore, from: number, span: number): Parte[] {
    const cs = calScore(p.s, p.r, from, span)
    const e = rigOf(p)
    const rb = e ? (({ 1: 1, 2: 0.55 } as Record<number, number>)[e[0]] || 0.3) : 0
    const cal = cs === null ? 0.5 : (cs - 1) / 4
    const dif = p.r === 'D' && p.mn !== undefined && p.mn !== null
    const out: Parte[] = [
      { k: 'titolarità', v: 40 * titW(p), max: 40, nota: titStato(p).breve },
      { k: 'valore nel ruolo', v: (dif ? 27 : 35) * (p.val || 0), max: dif ? 27 : 35, nota: 'FVM ' + (p.f || 0) },
      { k: 'calendario', v: 15 * cal, max: 15, nota: cs === null ? 'non disponibile' : cs.toFixed(1) + ' su 5' },
      { k: 'rigori', v: 10 * rb, max: 10, nota: e ? (e[0] + 'º rigorista') : 'non tira' },
    ]
    if (dif) out.push({ k: 'mentalità', v: 8 * p.mn!, max: 8, nota: mentLabel(p)?.t || '' })
    return out
  }
  function appet(p: Giocatore, from: number, span: number) {
    return Math.round(appetParts(p, from, span).reduce((a, x) => a + x.v, 0))
  }

  /* ══ 6d. Prezzo atteso e stato del mercato ══════════════════════════
     Le quotazioni del listone sono un indice, non un prezzo: sommate fanno
     circa metà dei crediti che girano in una lega. Il prezzo atteso li
     trasforma in crediti veri, tarati su QUESTA lega — budget, numero di
     squadre, slot per reparto e piano di spesa. I crediti di ogni reparto
     si spartiscono fra i giocatori che verranno davvero presi: ognuno parte
     da 1 credito, il resto va in proporzione a quanto la sua quotazione
     supera quella del giocatore "da un credito", preso all'85% della lista.

     L'esponente è tarato sui prezzi medi delle aste vere (fantacalcio-online.com):
     Lautaro 84, Malen 80, Thuram 71, Ramos 70, Hojlund 70 — il modello li
     ricostruisce entro il 5%. Sui portieri vale 1: in porta gioca uno solo
     dei tre. NON toccare senza rifare la taratura (tools/taratura-prezzi.cjs). */
  const PRICE_ALPHA: Record<Ruolo, number> = { P: 1.0, D: 0.5, C: 0.5, A: 0.5 }, PRICE_CUT = 0.85
  const byQdesc = (a: Giocatore, b: Giocatore) => (b.q - a.q) || (b.f! - a.f!) || a.n.localeCompare(b.n)
  /* distribuisce `crediti` sul pool, dal più caro al meno caro */
  function spreadCredits(pool: Giocatore[], crediti: number, out: Map<number, number>) {
    const n = pool.length; if (!n) return out
    const alpha = PRICE_ALPHA[pool[0].r] || 0.5
    const repl = pool[Math.min(n - 1, Math.max(0, Math.round(n * PRICE_CUT) - 1))].q
    const w = (p: Giocatore) => Math.pow(Math.max(0, p.q - repl), alpha)
    const tot = pool.reduce((a, p) => a + w(p), 0)
    const extra = Math.max(0, crediti - n)
    for (const p of pool) out.set(p.id, tot > 0 ? 1 + w(p) / tot * extra : 1 + extra / n)
    return out
  }
  let _PS = new Map<number, number>(), _PD = new Map<number, number>(), _PDon = false
  function buildPrices() {
    const T = S.teams.length || 1
    // il piano di spesa è modificabile a mano e non sempre fa 100: qui va normalizzato,
    // altrimenti i prezzi coprirebbero solo una parte dei crediti della lega
    const psum = ROLES.reduce((a, r) => a + Math.max(0, S.plan[r] || 0), 0)
    const quotaPiano = (r: Ruolo) => psum > 0 ? Math.max(0, S.plan[r] || 0) / psum : (S.slots[r] || 0) / (totalSlots() || 1)
    /* ── listino: come sarebbe se l'asta cominciasse adesso ── */
    _PS = new Map()
    for (const r of ROLES) {
      const arr = PL.filter(p => p.r === r).sort(byQdesc)
      const n = Math.min(T * (S.slots[r] || 0), arr.length)
      spreadCredits(arr.slice(0, n), S.budget * T * quotaPiano(r), _PS)
    }
    /* ── prezzo di adesso: crediti ancora in mano alle squadre, spartiti
          fra i giocatori ancora liberi che entreranno nelle rose ── */
    const preso = new Set(Object.keys(S.assign).map(Number))
    let crediti = 0, slotTot = 0; const slotR: Record<Ruolo, number> = { P: 0, D: 0, C: 0, A: 0 }
    for (const t of S.teams) {
      const st = stats(t.id)
      // i crediti di una squadra già al completo non possono più muovere il mercato
      if (st.slotsLeft > 0) crediti += Math.max(0, st.left)
      for (const r of ROLES) { const k = Math.max(0, (S.slots[r] || 0) - st.perRole[r].count); slotR[r] += k; slotTot += k }
    }
    _PD = new Map(); _PDon = false
    if (!slotTot) return
    const pool = {} as Record<Ruolo, Giocatore[]>; let valTot = 0; const valR = {} as Record<Ruolo, number>
    for (const r of ROLES) {
      pool[r] = PL.filter(p => p.r === r && !preso.has(p.id)).sort(byQdesc).slice(0, slotR[r])
      valR[r] = pool[r].reduce((a, p) => a + (_PS.get(p.id) || 1), 0)
      valTot += valR[r]
    }
    const extra = Math.max(0, crediti - slotTot)
    for (const r of ROLES) {
      if (!pool[r].length) continue
      const quota = valTot > 0 ? valR[r] / valTot : slotR[r] / slotTot
      spreadCredits(pool[r], pool[r].length + quota * extra, _PD)
    }
    _PDon = preso.size > 0
  }
  const prices = memo(() => { buildPrices(); return _PS })
  /* prezzo di listino: quanto dovrebbe costare in questa lega */
  function attesa(id: number) { const v = prices().get(id); return v ? Math.max(1, Math.round(v)) : 1 }
  /* prezzo di adesso: null se non è più in gioco (già preso o fuori dai posti rimasti) */
  function attesaOra(id: number) { prices(); if (!_PDon) return null; const v = _PD.get(id); return v ? Math.max(1, Math.round(v)) : null }
  /* quanto la lega sta pagando sopra o sotto il listino */
  function mercato() {
    prices()
    let pagato = 0, atteso = 0, n = 0
    for (const pid in S.assign) { const a = S.assign[pid]; pagato += a.price; atteso += attesa(+pid); n++ }
    if (n < 4 || atteso <= 0) return null
    return { n, pagato, atteso, infl: pagato / atteso - 1 }
  }
  /* affare/salasso su un prezzo pagato (dealTag nell'originale, senza l'HTML) */
  function esitoPrezzo(pid: number, price: number): { tipo: 'affare' | 'salasso'; atteso: number } | null {
    const a = attesa(pid); if (!a) return null
    const d = price / a - 1
    if (d <= -0.3) return { tipo: 'affare', atteso: a }
    if (d >= 0.45) return { tipo: 'salasso', atteso: a }
    return null
  }

  /* ══ 6e. Scarsità ═══════════════════════════════════════════════════
     Offerta = titolari ancora liberi. Domanda = quanti titolari le squadre
     devono ancora prendere, non gli slot totali: le ultime caselle si
     riempiono con giocatori da un credito e non muovono il mercato. Il
     rapporto è la pressione: sopra 1 i prezzi partono.                  */
  const TITSTART: Record<Ruolo, number> = { P: 1, D: 4, C: 4, A: 2 }   // quanti titolari servono davvero per reparto
  function fasciaPrezzo(id: number) {
    const a = attesa(id), b = S.budget || 500
    return a >= 0.08 * b ? 'top' : a >= 0.03 * b ? 'medio' : 'basso'
  }
  function scarsita() {
    const out = {} as Record<Ruolo, { liberi: number; tit: number; fasce: Record<'top' | 'medio' | 'basso', number>;
      domanda: number; slot: number; mieiTit: number; mieiSlot: number; press: number }>
    for (const r of ROLES) {
      const liberi = PL.filter(p => p.r === r && !S.assign[p.id] && !isOut(p.id))
      const tit = liberi.filter(p => titStato(p).liv === 1)
      const fasce = { top: 0, medio: 0, basso: 0 }
      for (const p of tit) fasce[fasciaPrezzo(p.id)]++
      let domanda = 0, slot = 0, mieiTit = 0, mieiSlot = 0
      const me = meId()
      for (const t of S.teams) {
        const R = roster(t.id)
        const presi = R[r].length
        const presiTit = R[r].filter(x => { const g = byId.get(x.p.id); return g && titStato(g).liv === 1 }).length
        const mancaSlot = Math.max(0, (S.slots[r] || 0) - presi)
        const mancaTit = Math.min(mancaSlot, Math.max(0, (TITSTART[r] || 1) - presiTit))
        domanda += mancaTit; slot += mancaSlot
        if (t.id === me) { mieiTit = mancaTit; mieiSlot = mancaSlot }
      }
      out[r] = { liberi: liberi.length, tit: tit.length, fasce,
        domanda, slot, mieiTit, mieiSlot,
        press: tit.length > 0 ? domanda / tit.length : (domanda ? Infinity : 0) }
    }
    return out
  }
  const pressLab = (v: number) => v === Infinity ? 'nessuno rimasto' : v >= 1.6 ? 'altissima' : v >= 1 ? 'alta' : v >= 0.6 ? 'normale' : 'bassa'
  /* quanti giocatori equivalenti restano liberi: stesso ruolo, prezzo atteso
     entro il 30%, e almeno la stessa titolarità */
  function alternative(p: Giocatore) {
    const a = attesa(p.id), liv = titStato(p).liv
    return PL.filter(x => x.r === p.r && x.id !== p.id && !S.assign[x.id] && !isOut(x.id)
        && titStato(x).liv <= liv
        && attesa(x.id) >= a * 0.7 && attesa(x.id) <= a * 1.3)
      .sort((x, y) => appet(y, gFrom(), gSpan()) - appet(x, gFrom(), gSpan()))
  }

  /* ══ 6f. Riepilogo d'asta e giudizio delle rose ═════════════════════
     Nessun modello linguistico: il giudizio è calcolato dagli stessi indici
     visti durante l'asta, e le frasi nascono da soglie sui numeri. Il
     pregio è che è verificabile: ogni voce del voto dice da dove viene.  */

  /* prezzo atteso anche per chi non è nel listone in uso: si stima dalla
     quotazione registrata al momento dell'acquisto, sulla curva del suo ruolo */
  function attesaSnap(p: Giocatore | Snap) {
    if (byId.has(p.id)) return attesa(p.id)
    const P = prices()
    const stessi = PL.filter(x => x.r === p.r && P.has(x.id)).sort((a, b) => a.q - b.q)
    if (!stessi.length) return 1
    let vicino = stessi[0]
    for (const x of stessi) { if (Math.abs(x.q - p.q) <= Math.abs(vicino.q - p.q)) vicino = x }
    return Math.max(1, Math.round(P.get(vicino.id)!))
  }
  /* l'undici migliore possibile con i moduli ammessi */
  function undiciTipo(tid: number) {
    const R = roster(tid), from = gFrom(), span = gSpan()
    const val = (p: Giocatore) => byId.has(p.id) ? appet(byId.get(p.id)!, from, span) : 35   // senza dati, valore prudente
    const ord = {} as Record<Ruolo, Giocatore[]>
    for (const r of ROLES) ord[r] = R[r].map(x => x.p).sort((a, b) => val(b) - val(a))
    let best: { mod: string; xi: Giocatore[]; somma: number } | null = null
    for (const mod in MODULI) {
      const [d, c, a] = MODULI[mod]
      const need: Record<Ruolo, number> = { P: 1, D: d, C: c, A: a }
      if (ROLES.some(r => ord[r].length < need[r])) continue
      const xi = ROLES.flatMap(r => ord[r].slice(0, need[r]))
      const somma = xi.reduce((s, p) => s + val(p), 0)
      if (!best || somma > best.somma) best = { mod, xi, somma }
    }
    if (!best) { const xi = ROLES.flatMap(r => ord[r]).slice(0, 11); best = { mod: '—', xi, somma: xi.reduce((s, p) => s + val(p), 0) } }
    const b = best
    const media = b.xi.length ? b.somma / b.xi.length : 0
    const resto = ROLES.flatMap(r => R[r].map(x => x.p)).filter(p => !b.xi.includes(p))
    const mediaResto = resto.length ? resto.reduce((s, p) => s + val(p), 0) / resto.length : 0
    return { ...b, media, resto, mediaResto }
  }
  const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
  /* rapporto medio fra prezzi attesi e prezzi pagati su tutta la lega */
  const mediaLega = memo(() => {
    let pag = 0, att = 0
    for (const pid in S.assign) {
      const a = S.assign[pid], p = byId.get(+pid) || a.snap; if (!p) continue
      pag += a.price; att += attesaSnap(p)
    }
    return pag > 0 ? att / pag : 1
  })
  function giudizio(tid: number) {
    const R = roster(tid), st = stats(tid), from = gFrom(), span = gSpan()
    const tutti = ROLES.flatMap(r => R[r].map(x => ({ p: x.p, price: x.price })))
    if (!tutti.length) return null
    const u = undiciTipo(tid)
    const noti = tutti.filter(x => byId.has(x.p.id))
    const cop = tutti.length ? noti.length / tutti.length : 0

    /* quanto ha pagato rispetto ai prezzi attesi */
    const pagato = tutti.reduce((a, x) => a + x.price, 0)
    const atteso = tutti.reduce((a, x) => a + attesaSnap(x.p), 0)
    /* Il confronto va normalizzato sulla lega: i prezzi attesi sono tarati sui
       giocatori che il modello si aspetta vengano comprati. Senza normalizzare
       risulterebbe che hanno pagato troppo tutti. Così il confronto è con gli
       altri, che è la domanda vera: chi ha comprato meglio? */
    const M = mediaLega()
    const resa = (pagato > 0 ? atteso / pagato : 1) / (M || 1)

    /* titolarità e rigoristi */
    const liv = (p: Giocatore) => byId.has(p.id) ? titStato(byId.get(p.id)!).liv : 3
    const titolari = tutti.filter(x => liv(x.p) === 1).length
    const panchinari = tutti.filter(x => liv(x.p) >= 3).length
    const rig = tutti.filter(x => byId.has(x.p.id) && rigOf(byId.get(x.p.id)!) && rigOf(byId.get(x.p.id)!)![0] === 1).length
    const portiereTit = R.P.some(x => liv(x.p) === 1)

    /* rischi: quanto pesa il giocatore più caro, e quanto la rosa dipende da un club */
    const caro = tutti.reduce((m, x) => x.price > m.price ? x : m, tutti[0])
    const concentr = S.budget > 0 ? caro.price / S.budget : 0
    const perClub: Record<string, number> = {}; for (const x of u.xi) perClub[x.s] = (perClub[x.s] || 0) + 1
    const clubMax: [string, number] = Object.entries(perClub).sort((a, b) => b[1] - a[1])[0] || ['', 0]

    /* calendario delle prossime giornate per l'undici */
    const cs = u.xi.map(p => calScore(p.s, p.r, from, span)).filter((x): x is number => x !== null)
    const cal = cs.length ? cs.reduce((a, b) => a + b, 0) / cs.length : null

    /* fantamedia della stagione scorsa dell'undici, dove c'è */
    const fmv = u.xi.map(p => annoScorso(p.id)).filter((h): h is AnnoScorso => !!h && h.pv >= 15).map(h => h.fm)
    const fmXI = fmv.length >= 6 ? fmv.reduce((a, b) => a + b, 0) / fmv.length : null

    /* spesa per reparto contro il piano */
    const dev = {} as Record<Ruolo, { reale: number; piano: number; d: number }>
    for (const r of ROLES) {
      const q = pagato ? st.perRole[r].spent / pagato * 100 : 0
      dev[r] = { reale: Math.round(q), piano: S.plan[r] || 0, d: Math.round(q - (S.plan[r] || 0)) }
    }

    const parti: Parte[] = [
      { k: 'undici tipo', v: 40 * clamp01((u.media - 45) / 40), max: 40, nota: u.mod + ' · appetibilità media ' + u.media.toFixed(0) },
      { k: 'profondità', v: 15 * clamp01((u.mediaResto - 30) / 35), max: 15, nota: 'i 14 di scorta valgono ' + u.mediaResto.toFixed(0) },
      { k: 'prezzi pagati', v: 20 * clamp01((resa - 0.82) / 0.36), max: 20,
        nota: (resa >= 1 ? 'ha comprato il ' + Math.round((resa - 1) * 100) + '% meglio della media della lega'
          : 'ha pagato il ' + Math.round((1 / resa - 1) * 100) + '% più della media della lega') },
      { k: 'titolari veri', v: 15 * clamp01((titolari - 6) / 9), max: 15, nota: titolari + ' su ' + tutti.length },
      { k: 'rigoristi', v: Math.min(5, rig * 2.5), max: 5, nota: rig ? rig + ' primi rigoristi' : 'nessun rigorista' },
      { k: 'rischio', v: 5 * clamp01(1 - (Math.max(0, concentr - 0.22) / 0.25) - (Math.max(0, clubMax[1] - 4) / 5)), max: 5,
        nota: (concentr >= 0.25 ? Math.round(concentr * 100) + '% del budget su ' + caro.p.n : 'spesa distribuita')
          + (clubMax[1] >= 5 ? ' · ' + clubMax[1] + " dall'" + clubMax[0] : '') },
    ]
    const voto = Math.round(parti.reduce((a, x) => a + x.v, 0))

    /* ── le frasi: solo cose che i numeri dicono davvero ── */
    const pro: string[] = [], contro: string[] = []
    if (u.media >= 72) pro.push(`undici tipo da ${u.media.toFixed(0)} di appetibilità media, roba da primi posti`)
    else if (u.media >= 62) pro.push(`undici tipo solido, ${u.media.toFixed(0)} di appetibilità media`)
    if (resa >= 1.1) pro.push(`ha comprato meglio di tutti: ${Math.round((resa - 1) * 100)}% sopra la media della lega nel rapporto fra valore e crediti spesi`)
    if (titolari >= 14) pro.push(`${titolari} titolari veri su ${tutti.length}: può ruotare senza perderci`)
    if (rig >= 2) pro.push(`${rig} primi rigoristi in rosa`)
    if (fmXI !== null && fmXI >= 6.6) pro.push(`l'undici ha una fantamedia 25/26 di ${fmXI.toFixed(2)}`)
    if (u.mediaResto >= 55) pro.push(`panchina vera: anche i 14 di scorta valgono ${u.mediaResto.toFixed(0)}`)
    if (cal !== null && cal >= 3.4) pro.push(`calendario morbido all'inizio (${cal.toFixed(1)} su 5)`)
    if (portiereTit && R.P.length >= 2 && dev.P.reale <= 8) pro.push(`portiere titolare senza svenarsi (${dev.P.reale}% del budget)`)

    if (u.media < 58) contro.push(`undici tipo sotto la media della lega (${u.media.toFixed(0)})`)
    if (resa <= 0.9) contro.push(`ha pagato il ${Math.round((1 / resa - 1) * 100)}% più della media della lega per lo stesso valore: circa ${Math.round(pagato - pagato * resa)} crediti buttati`)
    if (titolari <= 9) contro.push(`solo ${titolari} titolari veri: ${panchinari} di questi 25 rischiano di non giocare mai`)
    if (!portiereTit) contro.push(`nessun portiere dato per titolare`)
    if (rig === 0) contro.push(`nessun rigorista di prima scelta`)
    if (concentr >= 0.28) contro.push(`${Math.round(concentr * 100)}% del budget su un solo giocatore (${caro.p.n}, ${caro.price}): se si fa male è finita`)
    if (clubMax[1] >= 5) contro.push(`${clubMax[1]} degli undici vengono dalla stessa squadra (${clubMax[0]}): rosa legata a come gira quel club`)
    if (u.mediaResto <= 40) contro.push(`panchina povera (${u.mediaResto.toFixed(0)}): un infortunio e la formazione si scopre`)
    if (cal !== null && cal <= 2.7) contro.push(`avvio di calendario duro (${cal.toFixed(1)} su 5)`)
    for (const r of ROLES) {
      if (dev[r].d >= 14) contro.push(`${ROLENAME[r].toLowerCase()}: ${dev[r].reale}% del budget contro il ${dev[r].piano}% del piano`)
      if (dev[r].d <= -12 && r !== 'P') contro.push(`${ROLENAME[r].toLowerCase()} tirati via: ${dev[r].reale}% del budget contro il ${dev[r].piano}%`)
    }
    if (cop < 0.9) contro.push(`${tutti.length - noti.length} giocatori non sono nel listone in uso: per loro il giudizio va a stima`)

    return { voto, parti, pro, contro, xi: u.xi, mod: u.mod,
      media: u.media, mediaResto: u.mediaResto, pagato, atteso, resa,
      titolari, rig, caro, concentr, club: clubMax,
      cal, fmXI, dev, cop, n: tutti.length }
  }
  /* la classifica dei giudizi */
  function giudizi() {
    return S.teams.map(t => ({ t, g: giudizio(t.id) }))
      .filter((x): x is { t: typeof x.t; g: NonNullable<typeof x.g> } => !!x.g)
      .sort((a, b) => b.g.voto - a.g.voto)
  }

  /* ══ 13. Calendario di lega ═════════════════════════════════════════
     Il calendario della lega dice CHI affronti; quello di serie A dice
     quanto è dura per i tuoi giocatori.
     S.lega = {teams:[nomi di lega], off:2, gior:[[[iCasa,iOsp],…] × 36], nome}
     S.legaMap = {idSquadraAsta: indiceNelCalendarioDiLega}
     L'offset è quanto va aggiunto alla giornata di lega per avere quella
     di serie A.                                                          */
  const legaOn = () => !!(S.lega && S.lega.gior && S.lega.gior.length && S.lega.teams)
  const legaGiornate = () => legaOn() ? S.lega!.gior.length : 0
  const legaSerieA = (gl: number) => Math.max(1, Math.min(38, gl + (S.lega?.off || 0)))
  const legaIdx = (tid: number) => { const m = S.legaMap || {}; const v = m[tid]; return (v === undefined || v === null || v < 0) ? null : v }
  function legaTid(i: number) {
    const m = S.legaMap || {}
    for (const tid in m) if (m[tid] === i) return +tid
    return null
  }
  const legaNome = (i: number) => (legaOn() && S.lega!.teams[i]) || '—'
  /* le partite di una giornata, tradotte in squadre dell'asta dove si può */
  function legaPartite(gl: number) {
    if (!legaOn()) return []
    const gg = S.lega!.gior[gl - 1] || []
    return gg.map(([a, b]) => ({
      casaI: a, ospI: b,
      casa: legaTid(a), osp: legaTid(b),
      casaNome: legaNome(a), ospNome: legaNome(b),
    }))
  }
  /* chi affronto alla giornata di lega gl */
  function legaAvv(tid: number, gl: number): Avversario | null {
    const i = legaIdx(tid); if (i === null) return null
    for (const p of legaPartite(gl)) {
      if (p.casaI === i) return { i: p.ospI, tid: p.osp, nome: p.ospNome, casa: true, gl, ga: legaSerieA(gl) }
      if (p.ospI === i) return { i: p.casaI, tid: p.casa, nome: p.casaNome, casa: false, gl, ga: legaSerieA(gl) }
    }
    return null
  }
  const legaTutte = (tid: number) => { const out: Avversario[] = []; for (let g = 1; g <= legaGiornate(); g++) { const a = legaAvv(tid, g); if (a) out.push(a) } return out }

  /* ══ 13b. Quanto ci si aspetta che faccia una rosa ═══════════════════
     Stima, non previsione. Per ogni giocatore del miglior undici: la
     pagella media, i bonus corretti dalla partita di serie A di quella
     giornata, e la probabilità che giochi davvero. Accanto alla media lo
     SCARTO: i gol come eventi rari pesano 3 e portano varianza 9λ, e da lì
     viene la probabilità di vincere lo scontro.                        */
  const MV_BASE: Record<Ruolo, number> = { P: 6.0, D: 5.95, C: 6.0, A: 5.95 }
  function attesoGiocatore(p: Giocatore | null | undefined, ga: number) {
    if (!p) return null
    const st = statFor(p.id), h = annoScorso(p.id)
    let mv: number, bon: number, lam: number, laa: number, fonte: string
    // NB: statCalc non restituisce `pv` (le presenze stanno in `pres`), quindi
    // questo ramo non scatta mai e si ripiega sempre sulla stagione scorsa.
    // È così anche nell'originale: portato identico per restare 1:1. Va
    // corretto nei due posti insieme, rilanciando il test di equivalenza.
    if (st && st.pv! >= 4) {                                  // abbastanza giornate quest'anno
      mv = st.mv!; bon = st.fm! - st.mv!; fonte = "quest'anno"
      lam = (st.gf || 0) / st.pv!; laa = (st.ass || 0) / st.pv!
    } else if (h && h.pv >= 8) {                              // altrimenti la stagione scorsa
      mv = h.mv; bon = h.scarto; fonte = '2025/26'
      lam = (h.gf + h.rp) / h.pv; laa = h.ass / h.pv
      if (st && st.pv) { const w = st.pv / 4; mv = (1 - w) * mv + w * st.mv!; bon = (1 - w) * bon + w * (st.fm! - st.mv!) }
    } else {                                                  // nuovo o senza storia: prior di ruolo
      mv = MV_BASE[p.r]; fonte = 'stima dal ruolo'
      const q = Math.max(1, p.q || 1)
      bon = p.r === 'A' ? 0.9 * Math.min(1.6, q / 16) : p.r === 'C' ? 0.45 * Math.min(1.6, q / 14) : p.r === 'D' ? 0.25 : 0.15
      lam = p.r === 'A' ? bon / 3.2 : p.r === 'C' ? bon / 4 : 0.03; laa = lam * 0.5
    }
    // la partita di serie A di quella giornata sposta i bonus, non la pagella
    let mult = 1
    const fx = p.s ? fixtures(p.s, ga, 1)[0] : null
    if (fx) { const d = fixDiff(fx.opp, isOff(p.r), fx.home); mult = 1 + (3 - d) * 0.12 }   // 1 facile → ~1,24
    bon = bon * mult; lam = lam * mult; laa = laa * mult
    const fv = mv + bon
    // varianza: la pagella oscilla poco, i bonus tanto
    const varia = 0.42 + 9 * lam + 1 * laa + (p.r === 'P' ? 0.9 : p.r === 'D' ? 0.55 : 0.25)
    return { fv, mv, bon, sd: Math.sqrt(varia), gioca: titW(p), fonte, mult, fx }
  }
  type Atteso = NonNullable<ReturnType<typeof attesoGiocatore>>
  /* il punteggio atteso di una squadra a una data giornata di serie A */
  function attesoRosa(tid: number, ga: number) {
    // la rosa di QUELLA giornata: per le giornate passate tiene conto di scambi e svincoli
    const R = rosterAt(tid, ga)
    const noti = (r: Ruolo) => R[r].map(x => byId.get(x.p.id) || x.p)
    const val = (p: Giocatore) => { const a = attesoGiocatore(p, ga); return a ? a.fv * Math.max(0.15, a.gioca) : 0 }
    const ord = {} as Record<Ruolo, Giocatore[]>
    for (const r of ROLES) ord[r] = noti(r).slice().sort((a, b) => val(b) - val(a))
    let best: { mod: string; xi: Giocatore[]; s: number } | null = null
    for (const mod in MODULI) {
      const [d, c, a] = MODULI[mod]; const need: Record<Ruolo, number> = { P: 1, D: d, C: c, A: a }
      if (ROLES.some(r => ord[r].length < need[r])) continue
      const xi = ROLES.flatMap(r => ord[r].slice(0, need[r]))
      const s = xi.reduce((t, p) => t + val(p), 0)
      if (!best || s > best.s) best = { mod, xi, s }
    }
    if (!best) { const xi = ROLES.flatMap(r => ord[r]).slice(0, 11); best = { mod: '—', xi, s: xi.reduce((t, p) => t + val(p), 0) } }
    const b = best
    // chi non gioca lascia il posto a una riserva del suo ruolo: qui il costo del cambio
    const panca = {} as Record<Ruolo, Atteso | null>
    for (const r of ROLES) {
      const dentro = new Set(b.xi.map(p => p.id))
      const fuori = ord[r].filter(p => !dentro.has(p.id)); panca[r] = fuori.length ? attesoGiocatore(fuori[0], ga) : null
    }
    let media = 0, varTot = 0; const righe: { p: Giocatore; a: Atteso; atteso: number }[] = []
    for (const p of b.xi) {
      const a = attesoGiocatore(p, ga); if (!a) continue
      const ris = panca[p.r], fvRis = ris ? ris.fv * 0.92 : 5.6      // la riserva rende un po' meno
      const g = Math.max(0, Math.min(1, a.gioca))
      const m = g * a.fv + (1 - g) * fvRis
      media += m
      // varianza del giocatore più quella di "gioca o non gioca"
      varTot += g * a.sd * a.sd + g * (1 - g) * Math.pow(a.fv - fvRis, 2)
      righe.push({ p, a, atteso: m })
    }
    righe.sort((x, y) => y.atteso - x.atteso)
    return { mod: b.mod, media, sd: Math.sqrt(varTot), xi: righe,
      perRuolo: ROLES.reduce((o, r) => { o[r] = righe.filter(x => x.p.r === r).reduce((s, x) => s + x.atteso, 0); return o }, {} as Record<Ruolo, number>) }
  }
  /* funzione di ripartizione normale: serve per la probabilità di vincere */
  function normCdf(z: number) {
    const t = 1 / (1 + 0.2316419 * Math.abs(z))
    const d = 0.3989423 * Math.exp(-z * z / 2)
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
    return z > 0 ? 1 - p : p
  }
  /* lo scontro di una giornata: chi è favorito, di quanto, e cosa conviene fare */
  const _scCache = new Map<string, Scontro | null>()
  function scontro(tid: number, gl: number): Scontro | null {
    const k = tid + '|' + gl; if (_scCache.has(k)) return _scCache.get(k)!
    const avv = legaAvv(tid, gl)
    let out: Scontro | null = null
    if (avv) {
      const ga = avv.ga
      const mia = attesoRosa(tid, ga)
      const sua = avv.tid ? attesoRosa(avv.tid, ga) : null
      if (sua) {
        const diff = mia.media - sua.media
        const sd = Math.sqrt(mia.sd * mia.sd + sua.sd * sua.sd) || 1
        const pv = normCdf(diff / sd)
        out = { avv, ga, mia, sua, diff, sd, pVinco: pv,
          // sotto: alzare la varianza aiuta. sopra: abbassarla.
          strategia: pv < 0.42 ? 'rischio' : pv > 0.58 ? 'prudenza' : 'pari',
          durezza: sua.media }
      } else out = { avv, ga, mia, sua: null }
    }
    _scCache.set(k, out)
    return out
  }
  type AttesoRosa = ReturnType<typeof attesoRosa>
  interface Scontro {
    avv: Avversario; ga: number; mia: AttesoRosa; sua: AttesoRosa | null
    diff?: number; sd?: number; pVinco?: number; strategia?: 'rischio' | 'prudenza' | 'pari'; durezza?: number
  }
  /* ══ 13c. I giocatori pericolosi dell'avversario ═════════════════════
     Pericoloso è chi può farti male in una domenica sola: l'ordine è per
     TETTO — media più 1,28 scarti, il valore superato una volta su dieci. */
  function pericolosi(tid: number | null, ga: number, quanti?: number) {
    if (!tid) return []
    const R = attesoRosa(tid, ga)
    return R.xi.map(x => {
      const a = x.a, e = rigOf(x.p)
      const tetto = x.atteso + 1.28 * a.sd
      const perche: string[] = []
      if (e && e[0] === 1) perche.push('tira i rigori')
      const st = statFor(x.p.id), h = annoScorso(x.p.id)
      // NB: stesso `pv` inesistente di attesoGiocatore, portato identico
      const lam = st && st.pv! >= 4 ? (st.gf || 0) / st.pv! : (h && h.pv >= 8 ? (h.gf + h.rp) / h.pv : 0)
      if (lam >= 0.35) perche.push('segna spesso')
      else if (lam >= 0.18) perche.push('va spesso a segno')
      if (a.mult >= 1.15) perche.push('partita morbida')
      else if (a.mult <= 0.85) perche.push('partita dura')
      if (!perche.length && a.gioca >= 0.9) perche.push('gioca sempre')   // solo se non c'è di meglio da dire
      return { p: x.p, a, atteso: x.atteso, tetto, rig: e && e[0] === 1,
        perche: perche.slice(0, 2).join(' · ') || 'titolare' }
    }).sort((x, y) => y.tetto - x.tetto).slice(0, quanti || 5)
  }
  /* la giornata nera: avversario forte E calendario di serie A cattivo per i miei */
  function legaIncroci(tid: number) {
    const out = []
    for (let g = 1; g <= legaGiornate(); g++) {
      const s = scontro(tid, g); if (!s || !s.sua) continue
      // quanto è dura la giornata di serie A per il mio undici
      const dur = s.mia.xi.length
        ? s.mia.xi.reduce((a, x) => a + (x.a.fx ? fixDiff(x.a.fx.opp, isOff(x.p.r), x.a.fx.home) : 3), 0) / s.mia.xi.length
        : 3
      out.push({ gl: g, ga: s.ga, avv: s.avv, pVinco: s.pVinco!, diff: s.diff!,
        durSerieA: dur, mia: s.mia.media, sua: s.sua.media,
        // 0 = giornata comoda, 100 = da incubo
        nera: Math.round(clamp01((1 - s.pVinco!) * 0.62 + ((dur - 2) / 2.2) * 0.38) * 100) })
    }
    return out
  }

  /* ══ 18. Mercato: scambi e svincoli (lettura) ═══════════════════════
     S.assign dice chi possiede un giocatore ADESSO. Accanto c'è il registro
     dei movimenti, S.moves = [{ id, g, tipo, ts, voci:[{pid, da, a, prezzo}],
     agg:{tid:delta} }]: g è la giornata DA CUI il movimento vale. Il possesso
     a una certa giornata si ricava all'indietro, disfacendo i movimenti
     successivi. Le scritture (registraScambio, registraSvincolo, annulla)
     diventano operazioni sul database, non stanno nel motore.           */
  const moves = () => Array.isArray(S.moves) ? S.moves : NESSUN_MOVIMENTO
  const nextG = () => { const g = giornateGiocate(); return Math.min(38, (g.length ? Math.max(...g) : 0) + 1) }
  /* chi possedeva questo giocatore alla giornata g (null = nessuno) */
  function ownerAt(pid: number | string, g: number) {
    const a = S.assign[pid]
    let cur = a ? a.team : null
    const ms = moves()
    for (let i = ms.length - 1; i >= 0; i--) {
      const m = ms[i]; if (m.g <= g) break                 // già ordinati per giornata
      for (const v of m.voci) if (+v.pid === +pid) cur = v.da
    }
    return cur
  }
  /* la rosa di una squadra a una certa giornata */
  function rosterAt(tid: number, g: number): Rosa {
    const out: Rosa = { P: [], D: [], C: [], A: [] }
    const visti = new Set<number>()
    const metti = (pid: number | string) => {
      if (visti.has(+pid)) return; visti.add(+pid)
      if (ownerAt(pid, g) !== tid) return
      const a = S.assign[pid]
      const p = giocatoreDi(pid); if (!p) return
      out[p.r].push({ p, price: a ? (a.price || 0) : prezzoStorico(pid) })
    }
    for (const pid in S.assign) metti(pid)
    for (const m of moves()) for (const v of m.voci) metti(v.pid)   // anche chi è uscito
    for (const r of ROLES) out[r].sort((a, b) => b.price - a.price || a.p.n.localeCompare(b.p.n))
    return out
  }
  /* I crediti residui sono budget meno la somma dei prezzi in rosa; con i
     movimenti quel conto va corretto, altrimenti uno scambio alla pari fra
     un giocatore da 65 e uno da 156 farebbe crollare il residuo di chi
     riceve senza che abbia pagato niente. */
  function aggCrediti(tid: number) {
    let a = 0
    for (const m of moves()) if (m.agg && m.agg[tid]) a += m.agg[tid]
    return a
  }
  const prezzoDi = (pid: number | string) => { const a = S.assign[pid]; return a ? (a.price || 0) : prezzoStorico(pid) }
  /* il prezzo di chi non è più in nessuna rosa: lo tiene il movimento che l'ha portato fuori */
  function prezzoStorico(pid: number | string) {
    const ms = moves()
    for (let i = ms.length - 1; i >= 0; i--) for (const v of ms[i].voci)
      if (+v.pid === +pid && v.prezzo !== undefined) return v.prezzo
    return 0
  }
  function giocatoreDi(pid: number | string): Giocatore | null {
    const a: Assegnazione | undefined = S.assign[pid]
    if (a && (byId.get(+pid) || a.snap)) return byId.get(+pid) || a.snap!
    if (byId.get(+pid)) return byId.get(+pid)!
    for (const m of moves()) for (const v of m.voci) if (+v.pid === +pid && v.snap) return v.snap
    return null
  }
  /* i controlli prima di scrivere: non sono formalità, uno scambio fra ruoli
     diversi lascia una rosa fuori regola e te ne accorgi la domenica */
  function verificaScambio(pidA: number, pidB: number) {
    const a = S.assign[pidA], b = S.assign[pidB]
    const pa = giocatoreDi(pidA), pb = giocatoreDi(pidB)
    if (!a || !b) return 'uno dei due giocatori non è in nessuna rosa'
    if (!pa || !pb) return 'non trovo uno dei due giocatori nel listone'
    if (a.team === b.team) return 'sono già nella stessa squadra'
    if (pa.r !== pb.r) return `ruoli diversi (${pa.r} e ${pb.r}): la lega scambia ruolo per ruolo`
    return null
  }
  function verificaSvincolo(tid: number, pidFuori: number, pidDentro: number) {
    const a = S.assign[pidFuori]
    if (!a || a.team !== tid) return 'il giocatore da svincolare non è in questa rosa'
    if (S.assign[pidDentro]) return 'il giocatore da prendere è già in una rosa'
    const pf = giocatoreDi(pidFuori), pd = byId.get(+pidDentro)
    if (!pd) return 'il giocatore da prendere non è nel listone'
    if (pf && pd.r !== pf.r) return `ruoli diversi (${pf.r} esce, ${pd.r} entra): gli slot non tornerebbero`
    return null
  }
  /* i movimenti che riguardano una squadra, dal più recente */
  const moviDi = (tid: number) => moves().filter(m => m.voci.some(v => v.da === tid || v.a === tid)).slice().reverse()

  /* ══ 20. Che giornata è oggi ════════════════════════════════════════
     «La prima giornata non ancora giocata», dalla data del dispositivo e
     da quella di ogni giornata nel calendario; mai sotto le giornate di
     cui ci sono già i voti. Senza date, giornate caricate + 1.          */
  const OGGI = input.oggi || new Date()
  function giornataOggi() {
    const oggi = new Date(OGGI.getTime()); oggi.setHours(0, 0, 0, 0)
    const D = CAL.dates || []
    let daData: number | null = null, conDate = 0
    for (let g = 1; g <= D.length; g++) {
      const s = D[g - 1]; if (!s) continue
      conDate++
      if (daData === null) {
        const d = new Date(s + 'T00:00:00')
        if (!isNaN(d.getTime()) && d.getTime() >= oggi.getTime()) daData = g
      }
    }
    if (daData === null && conDate) daData = D.length      // stagione finita: resta l'ultima
    const g = Math.max(daData || 0, nextG() || 1)
    return Math.max(1, Math.min(38, g))
  }
  /* la stessa giornata, nella numerazione della lega */
  function legaOggi() {
    if (!legaOn()) return 1
    const g = giornataOggi() - (S.lega!.off || 0)
    return Math.max(1, Math.min(legaGiornate(), g))
  }

  /* ══ 21. I risultati veri della serie A ══════════════════════════════
     Stanno già dentro il file dei voti: gol fatti, gol subiti dai portieri,
     autogol all'avversario. Le due strade si controllano a vicenda.     */
  const risultati = memo(() => {
    const R = golDaiVoti(), per: Record<string, { t: string; x: { g: number; casa: boolean; avv: string; gf: number; gs: number } }[]> = {}
    for (const t of CALTEAMS) for (const x of (R[t] || [])) {
      (per[x.g] = per[x.g] || []).push({ t, x })
    }
    const out: Record<number, { casa: string; osp: string; gc: number; go: number; torna: boolean | null }[]> = {}
    for (const g in per) {
      const viste = new Set<string>(), lista: { casa: string; osp: string; gc: number; go: number; torna: boolean | null }[] = []
      for (const { t, x } of per[g]) {
        if (viste.has(t) || viste.has(x.avv)) continue
        viste.add(t); viste.add(x.avv)
        const avv = per[g].find(y => y.t === x.avv)
        // il controllo incrociato: i miei gol sono i suoi subiti
        const torna = avv ? (avv.x.gs === x.gf && avv.x.gf === x.gs) : null
        lista.push(x.casa ? { casa: t, osp: x.avv, gc: x.gf, go: x.gs, torna }
          : { casa: x.avv, osp: t, gc: x.gs, go: x.gf, torna })
      }
      out[+g] = lista
    }
    return out
  })
  const risultatiDi = (g: number) => risultati()[g] || []
  /* la classifica, dalle giornate di cui ci sono i voti */
  function classificaSerieA() {
    const R = golDaiVoti(), T: Record<string, { t: string; pt: number; g: number; v: number; n: number; p: number; gf: number; gs: number }> = {}
    for (const t of CALTEAMS) T[t] = { t, pt: 0, g: 0, v: 0, n: 0, p: 0, gf: 0, gs: 0 }
    for (const t of CALTEAMS) for (const x of (R[t] || [])) {
      const a = T[t]; a.g++; a.gf += x.gf; a.gs += x.gs
      if (x.gf > x.gs) { a.v++; a.pt += 3 } else if (x.gf === x.gs) { a.n++; a.pt++ } else a.p++
    }
    return Object.values(T).filter(x => x.g)
      .sort((a, b) => b.pt - a.pt || (b.gf - b.gs) - (a.gf - a.gs) || b.gf - a.gf || a.t.localeCompare(b.t))
  }
  /* quanto pesano ormai i risultati nella stima delle forze */
  function pesoRisultati() {
    const n = giornateGiocate().length
    return n ? n / (n + FORZA_K) : 0
  }

  /* ══ 23. I risultati della lega (da part5) ═══════════════════════════
     Il calendario porta con sé i fantapunti di ogni scontro e il risultato
     in gol: da lì la classifica, e la verifica delle previsioni — perché
     una previsione che nessuno controlla non è una previsione.          */
  const legaRis = () => legaOn() && Array.isArray(S.lega!.ris) ? S.lega!.ris! : []
  const legaGiocate = () => {
    const R = legaRis(), out: number[] = []
    R.forEach((r, i) => { if (r && r.some(x => x)) out.push(i + 1) }); return out
  }
  /* lo scontro vero di una squadra a una giornata di lega */
  function esitoDi(tid: number, gl: number) {
    const i = legaIdx(tid); if (i === null || i === undefined || i < 0) return null
    const ps = (S.lega!.gior || [])[gl - 1], rs = legaRis()[gl - 1]
    if (!ps || !rs) return null
    for (let k = 0; k < ps.length; k++) {
      const [a, b] = ps[k], r = rs[k]; if (!r) continue
      if (a === i) return { casa: true, avvIdx: b, pf: r.pa, pc: r.pb, gf: r.ga, gc: r.gb }
      if (b === i) return { casa: false, avvIdx: a, pf: r.pb, pc: r.pa, gf: r.gb, gc: r.ga }
    }
    return null
  }
  /* la classifica di lega: punti, poi i fantapunti totali come si usa */
  function classificaLega() {
    if (!legaOn()) return []
    const T = S.lega!.teams.map((n, i) => ({ i, nome: n, tid: legaTid(i), pt: 0, g: 0, v: 0, n: 0, p: 0,
      gf: 0, gs: 0, pf: 0, pc: 0 }))
    const gg = legaGiocate()
    for (const gl of gg) {
      const ps = S.lega!.gior[gl - 1], rs = legaRis()[gl - 1]
      ps.forEach(([a, b], k) => {
        const r = rs[k]; if (!r) return
        const A = T[a], B = T[b]; if (!A || !B) return
        A.g++; B.g++
        A.pf += r.pa || 0; A.pc += r.pb || 0; B.pf += r.pb || 0; B.pc += r.pa || 0
        if (r.ga !== null && r.gb !== null) { A.gf += r.ga; A.gs += r.gb; B.gf += r.gb; B.gs += r.ga }
        const va = r.ga !== null ? r.ga : (r.pa || 0), vb = r.gb !== null ? r.gb : (r.pb || 0)
        if (va > vb) { A.v++; A.pt += 3; B.p++ }
        else if (va < vb) { B.v++; B.pt += 3; A.p++ }
        else { A.n++; B.n++; A.pt++; B.pt++ }
      })
    }
    return T.filter(x => x.g).sort((a, b) => b.pt - a.pt || (b.gf - b.gs) - (a.gf - a.gs) || b.pf - a.pf || a.nome.localeCompare(b.nome))
  }
  /* la verifica: per ogni giornata giocata, cosa si aspettava l'app e com'è andata */
  function verifica(tid: number) {
    const out: VoceVerifica[] = []; if (!legaOn()) return out
    for (const gl of legaGiocate()) {
      const e = esitoDi(tid, gl); if (!e) continue
      const s = scontro(tid, gl)
      out.push({ gl, ga: legaSerieA(gl), avv: e.avvIdx, casa: e.casa,
        pf: e.pf, pc: e.pc, gf: e.gf, gc: e.gc,
        atteso: s && s.mia ? s.mia.media : null, attesoAvv: s && s.sua ? s.sua.media : null,
        pVinco: s ? (s.pVinco as number) : null,
        vinta: e.gf !== null ? (e.gf > e.gc! ? 1 : e.gf < e.gc! ? -1 : 0) : (e.pf > e.pc ? 1 : e.pf < e.pc ? -1 : 0) })
    }
    return out
  }
  function sintesiVerifica(v: VoceVerifica[]) {
    const con = v.filter(x => x.atteso !== null)
    if (!con.length) return null
    let sc = 0, scAvv = 0, nAvv = 0
    for (const x of con) { sc += x.pf - x.atteso!; if (x.attesoAvv !== null) { scAvv += x.pc - x.attesoAvv; nAvv++ } }
    const centrate = con.filter(x => x.pVinco !== null && ((x.pVinco >= 0.5 && x.vinta >= 0) || (x.pVinco < 0.5 && x.vinta <= 0))).length
    return { n: con.length, scarto: sc / con.length, scartoAvv: nAvv ? scAvv / nAvv : null, centrate }
  }

  /* ══ 26. Infermeria: infortuni, squalifiche, diffide (da part5) ═══════
     Le squalifiche NON si contano a gialli consecutivi: in serie A si
     sommano sulla stagione e scattano alla 5ª ammonizione, poi alla 9ª,
     13ª, 16ª, 18ª, e dalla 19ª a ogni giallo. La doppia ammonizione diventa
     espulsione e quei gialli non contano; il rosso vale da una giornata
     in su, ma quante lo decide il giudice sportivo — resta a mano.
     Tutto si RICAVA dai voti, non si accumula: caricando le giornate in
     disordine, o togliendone una, il conto resta giusto.               */
  const SOGLIE = [5, 9, 13, 16, 18]
  const scattaA = (n: number) => SOGLIE.includes(n) || n >= 19
  const diffidatoA = (n: number) => scattaA(n + 1)
  const cartellini = memo(() => {
    const out: Record<string, { amm: number; esp: number; stop: { g: number; n: number }[]; rossi: number[] }> = {}
    for (const g of giornateGiocate()) {
      const V = S.stats[g] || {}
      for (const pid in V) {
        const a = V[pid], amm = a[7] || 0, esp = a[8] || 0
        const o = out[pid] || (out[pid] = { amm: 0, esp: 0, stop: [], rossi: [] })
        // doppia ammonizione: i gialli sono già stati "spesi" nel rosso
        const contano = (esp > 0 && amm > 0) ? 0 : amm
        for (let k = 0; k < contano; k++) {
          o.amm++
          if (scattaA(o.amm)) o.stop.push({ g: g + 1, n: o.amm })
        }
        if (esp > 0) { o.esp += esp; o.rossi.push(g) }
      }
    }
    return out
  })
  const saltata = (pid: number | string, g: number) => !!(S.squalSalta && S.squalSalta[pid + '-' + g])
  /* le squalifiche ancora da scontare: quelle la cui giornata non è caricata */
  const squalifiche = memo(() => {
    if (S.squalOn === false) return []
    const gg = giornateGiocate(), C = cartellini(), out: { pid: number; g: number; n: number }[] = []
    for (const pid in C) for (const s of C[pid].stop) {
      if (s.g > 38 || gg.includes(s.g) || saltata(pid, s.g)) continue   // già scontata, o annullata
      out.push({ pid: +pid, g: s.g, n: s.n })
    }
    return out.sort((a, b) => a.g - b.g)
  })
  const squalificatoA = (pid: number | string, g: number) => squalifiche().some(s => s.pid === +pid && s.g === g)
  /* chi è a un giallo dalla squalifica */
  function diffidati() {
    const C = cartellini(), out: { pid: number; amm: number }[] = []
    for (const pid in C) if (diffidatoA(C[pid].amm)) out.push({ pid: +pid, amm: C[pid].amm })
    return out.sort((a, b) => b.amm - a.amm)
  }
  /* i rossi da controllare a mano */
  function rossiDaVedere() {
    const C = cartellini(), gg = giornateGiocate(), ultima = gg.length ? Math.max(...gg) : 0, out: { pid: number; g: number }[] = []
    for (const pid in C) {
      const r = C[pid].rossi
      if (r.length && r[r.length - 1] === ultima) out.push({ pid: +pid, g: ultima })
    }
    return out
  }
  /* S.out era una mappa di 1; ora la voce può essere un oggetto con motivo
     e giornata, e il vecchio 1 continua a valere come "fuori" senza dettagli */
  const infoOut = (id: number | string) => { const v = S.out && S.out[id]; return (v && typeof v === 'object') ? v : (v ? {} : null) }
  /* chi rigioca è guarito: appena ricompare nei voti l'indisponibilità cade.
     Qui solo il calcolo; toglierli è una scrittura sul database. */
  function rientri() {
    const gg = giornateGiocate(), out: { pid: number; g: number }[] = []
    for (const id in (S.out || {})) {
      const inf: { da?: number } = infoOut(id) || {}, da = inf.da || 0
      for (const g of gg) if (g >= da && S.stats[g] && S.stats[g][id]) { out.push({ pid: +id, g }); break }
    }
    return out
  }

  /* ══ Chi schierare (da part5) ════════════════════════════════════════
     Il punteggio di giornata è l'appetibilità ristretta a quella partita,
     più la forma recente. Resta 0–100, così due ruoli restano confrontabili. */
  function dayParts(p: Giocatore, g: number): Parte[] {
    const parts = appetParts(p, g, 1)
    if (giornateGiocate().length) {
      const f = formaOf(p.id, 3)
      parts.push({ k: 'forma', max: 8,
        v: f ? 8 * Math.max(0, Math.min(1, (f.delta + 2) / 4)) : 4,
        nota: f ? ((f.delta >= 0 ? '+' : '−') + Math.abs(f.delta).toFixed(1) + ' sulle ultime ' + f.n)
          : 'non abbastanza partite' })
    }
    return parts
  }
  function dayScore(p: Giocatore, g: number) {
    if (isOut(p.id)) return 0
    const parts = dayParts(p, g)
    const tot = parts.reduce((a, x) => a + x.v, 0), max = parts.reduce((a, x) => a + x.max, 0)
    return max ? Math.round(tot / max * 100) : 0
  }
  /* la riga di motivazione: cosa lo tiene su, e cosa lo tira giù */
  function dayWhy(p: Giocatore, g: number) {
    if (isOut(p.id)) return 'indisponibile'
    const parts = dayParts(p, g)
    const pro = parts.filter(x => x.v / x.max >= 0.7).sort((a, b) => b.v / b.max - a.v / a.max)
    const con = parts.filter(x => x.v / x.max <= 0.3).sort((a, b) => a.v / a.max - b.v / b.max)
    const dice = (x: Parte) => ({ 'titolarità': titStato(p).dati ? 'gioca sempre' : 'titolare',
      'valore nel ruolo': 'vale nel ruolo', 'calendario': 'calendario facile',
      'rigori': 'tira i rigori', 'mentalità': 'spinge avanti', 'forma': 'in forma' } as Record<string, string>)[x.k] || x.k
    const male = (x: Parte) => ({ 'titolarità': 'gioca poco', 'valore nel ruolo': 'vale poco nel ruolo',
      'calendario': 'calendario duro', 'rigori': '', 'mentalità': '', 'forma': 'fuori forma' } as Record<string, string>)[x.k] || ''
    const su = pro.slice(0, 2).map(dice).filter(Boolean)
    const giu = con.map(male).filter(Boolean).slice(0, 1)
    return [...su, ...giu].join(' · ') || 'niente di speciale'
  }
  const ordRuolo = (r: Ruolo) => ({ P: 0, D: 1, C: 2, A: 3 } as Record<string, number>)[r] ?? 9
  /* «Schiera la migliore» (autoFill nell'originale): per reparto i più alti
     di punteggio di giornata fra i disponibili; la panchina per reparto,
     e dentro ogni reparto davanti chi rende di più. */
  function formazioneAutomatica(g: number, mod = '3-4-3') {
    const R = roster(meId())
    const [d, c, a] = MODULI[mod], need: Record<Ruolo, number> = { P: 1, D: d, C: c, A: a }
    const taken = new Set<number>()
    const start = {} as Record<Ruolo, (number | null)[]>
    for (const r of ROLES) {
      const pool = R[r].map(x => x.p).filter(p => !isOut(p.id)).sort((x, y) => dayScore(y, g) - dayScore(x, g))
      start[r] = []
      for (let i = 0; i < need[r]; i++) {
        const p = pool.find(z => !taken.has(z.id))
        if (p) { taken.add(p.id); start[r].push(p.id) } else start[r].push(null)
      }
    }
    const bench = ROLES.flatMap(r => R[r].map(x => x.p)).filter(p => !taken.has(p.id))
      .sort((x, y) => ordRuolo(x.r) - ordRuolo(y.r) || dayScore(y, g) - dayScore(x, g)).map(p => p.id)
    return { mod, start, bench }
  }

  /* ══ Rose ufficiali della lega: il confronto (da part4, sezione 20) ═══
     Il file delle rose che la lega pubblica dopo l'asta è la versione
     firmata: qui si confronta con le assegnazioni e si riconoscono i
     movimenti nascosti. Solo lettura: allineare è una scrittura.       */
  function indiceNomi() {
    const m = new Map<string, Giocatore[]>(), corti = new Map<string, Giocatore[]>()
    const metti = (p: Giocatore | null | undefined) => {
      if (!p || !p.n) return
      const k = normNome(p.n)
      if (!m.has(k)) m.set(k, [])
      if (!m.get(k)!.some(x => +x.id === +p.id)) m.get(k)!.push(p)
      const c = normNome(p.n.replace(/\s+\S{1,4}\.?$/, ''))         // via l'iniziale finale
      if (c && c !== k) {
        if (!corti.has(c)) corti.set(c, [])
        if (!corti.get(c)!.some(x => +x.id === +p.id)) corti.get(c)!.push(p)
      }
    }
    for (const p of PL) metti(p)
    // chi è sparito dalle quotazioni ma resta in rosa non deve risultare «non riconosciuto»
    for (const pid in S.assign) metti(giocatoreDi(pid))
    for (const mv of moves()) for (const v of mv.voci) if (v.snap) metti(v.snap)
    return { pieni: m, corti }
  }
  function trovaGiocatore(nome: string, ix?: ReturnType<typeof indiceNomi>) {
    ix = ix || indiceNomi(); const k = normNome(nome)
    let c = ix.pieni.get(k)
    if (c && c.length === 1) return c[0]
    if (c && c.length > 1) return null                 // omonimi: meglio dirlo che indovinare
    c = ix.corti.get(k)
    if (c && c.length === 1) return c[0]
    return null
  }
  /* Abbinare le squadre del file a quelle dell'asta: prima il nome, poi la
     sovrapposizione delle rose — due colonne della stessa squadra condividono
     venti giocatori su venticinque, due che non c'entrano ne condividono uno. */
  function abbinaRose(nomi: string[], rose?: SquadraFile[]) {
    const out: Record<number, number> = {}, presi = new Set<number>(), usati = new Set<string>()
    const prendi = (j: number, tid: number) => { out[j] = tid; presi.add(j); usati.add(String(tid)) }
    // 1. il nome uguale, dal calendario o dall'asta: è una scelta dell'utente
    const nomeLega = (tid: number) => {
      if (!legaOn()) return null
      const i = legaIdx(tid); return (i === null || i === undefined || i < 0) ? null : S.lega!.teams[i]
    }
    for (const t of S.teams) {
      const cand = [nomeLega(t.id), t.name].filter(Boolean).map(normNome)
      const j = nomi.findIndex((n, k) => !presi.has(k) && cand.includes(normNome(n)))
      if (j >= 0) prendi(j, t.id)
    }
    // 2. il resto per sovrapposizione di rose
    if (rose) {
      const ix = indiceNomi()
      const setFile = rose.map(sq => {
        const s = new Set<number>()
        for (const g of sq.gio) { const p = trovaGiocatore(g.n, ix); if (p) s.add(+p.id) } return s
      })
      const setApp = new Map(S.teams.map(t => [String(t.id), new Set<number>()]))
      for (const pid in S.assign) { const s = setApp.get(String(S.assign[pid].team)); if (s) s.add(+pid) }
      const coppie: { j: number; tid: number; k: number }[] = []
      nomi.forEach((_n, j) => {
        if (presi.has(j) || !setFile[j].size) return
        const p: { j: number; tid: number; k: number }[] = []
        for (const t of S.teams) {
          if (usati.has(String(t.id))) continue
          let k = 0; for (const pid of setFile[j]) if (setApp.get(String(t.id))!.has(pid)) k++
          p.push({ j, tid: t.id, k })
        }
        p.sort((a, b) => b.k - a.k)
        if (!p.length) return
        const secondo = p[1] ? p[1].k : 0
        // quasi mezza rosa in comune, e il doppio del secondo classificato
        if (p[0].k >= Math.max(8, Math.round(setFile[j].size * 0.45)) && p[0].k >= 2 * secondo) coppie.push(p[0])
      })
      coppie.sort((a, b) => b.k - a.k)
      for (const c of coppie) { if (presi.has(c.j) || usati.has(String(c.tid))) continue; prendi(c.j, c.tid) }
    }
    return out
  }
  /* Il confronto. Nessuna scrittura: solo il verdetto, voce per voce. */
  function confrontoRose(file: FileRose) {
    const map = abbinaRose(file.squadre.map(s => s.nome), file.squadre)
    const ix = indiceNomi()
    const righe: RigaConfronto[] = [], senza: string[] = []
    const vistiPid = new Set<number>(), tidIgnoti = new Set<string>()
    file.squadre.forEach((sq, i) => {
      const tid = map[i]
      if (tid === undefined) { if (sq.gio.length) senza.push(sq.nome); return }
      if (!sq.gio.length) return                    // squadra che non ha ancora fatto l'asta
      for (const g of sq.gio) {
        const p = trovaGiocatore(g.n, ix)
        if (!p) { righe.push({ stato: 'ignoto', nome: g.n, cr: g.cr, tid }); tidIgnoti.add(String(tid)); continue }
        vistiPid.add(+p.id)
        const a = S.assign[p.id]
        if (!a) righe.push({ stato: 'solofile', pid: p.id, p, cr: g.cr, tid })
        else if (String(a.team) !== String(tid)) righe.push({ stato: 'squadra', pid: p.id, p, cr: g.cr, tid, era: a.team, prezzoApp: a.price || 0 })
        else if ((a.price || 0) !== g.cr) righe.push({ stato: 'prezzo', pid: p.id, p, cr: g.cr, tid, prezzoApp: a.price || 0 })
        else righe.push({ stato: 'ok', pid: p.id, p, cr: g.cr, tid })
      }
    })
    // chi nell'app sta in una squadra abbinata ma nel file non c'è
    const tidCoperti = new Set(file.squadre.map((s, i) => s.gio.length ? map[i] : undefined)
      .filter(x => x !== undefined).map(String))
    for (const pid in S.assign) {
      if (vistiPid.has(+pid)) continue
      const a = S.assign[pid]
      if (!tidCoperti.has(String(a.team))) continue
      const p = giocatoreDi(pid); if (!p) continue
      // se in quella squadra c'è un nome non riconosciuto, potrebbe essere lui scritto diverso
      righe.push({ stato: 'soloapp', pid: +pid, p, cr: a.price || 0, tid: a.team, dubbio: tidIgnoti.has(String(a.team)) })
    }
    const conta: Record<RigaConfronto['stato'], number> = { ok: 0, prezzo: 0, squadra: 0, solofile: 0, soloapp: 0, ignoto: 0 }
    for (const r of righe) conta[r.stato]++
    const dubbi = righe.filter(r => r.stato === 'soloapp' && r.dubbio).length
    // i totali di spesa, squadra per squadra: somma secca dei prezzi in rosa
    const totali: { tid: number; nomeFile: string; file: number; app: number }[] = []
    file.squadre.forEach((sq, i) => {
      const tid = map[i]; if (tid === undefined || !sq.gio.length) return
      let somma = 0; for (const pid in S.assign) if (String(S.assign[pid].team) === String(tid)) somma += S.assign[pid].price || 0
      totali.push({ tid, nomeFile: sq.nome, file: sq.totale, app: somma })
    })
    return { map, righe, conta, senza, totali, dubbi,
      diverse: conta.prezzo + conta.squadra + conta.solofile + conta.soloapp - dubbi }
  }
  /* i movimenti nascosti dentro il confronto: uno esce e un altro entra
     nella stessa squadra e ruolo, o due si scambiano di posto. Riscriverli
     come correzioni cancellerebbe chi faceva i punti per chi.          */
  function movimentiProposti(cmp: ReturnType<typeof confrontoRose>) {
    const usati = new Set<number>(), scambi: { a: RigaConfronto; b: RigaConfronto }[] = []
    const svincoli: { tid: number | string; fuori: RigaConfronto; dentro: RigaConfronto }[] = []
    const sq = cmp.righe.filter(r => r.stato === 'squadra')
    for (const a of sq) {
      if (usati.has(a.pid!)) continue
      const b = sq.find(x => !usati.has(x.pid!) && x.pid !== a.pid &&
        String(x.tid) === String(a.era) && String(x.era) === String(a.tid) && x.p!.r === a.p!.r)
      if (!b) continue
      if (!S.assign[a.pid!] || !S.assign[b.pid!]) continue
      usati.add(a.pid!); usati.add(b.pid!)
      scambi.push({ a, b })
    }
    // svincoli: dentro la stessa squadra, uno che esce e uno che entra
    const perSq = new Map<string, { fuori: RigaConfronto[]; dentro: RigaConfronto[] }>()
    const metti = (tid: number, k: 'fuori' | 'dentro', r: RigaConfronto) => {
      const s = String(tid)
      if (!perSq.has(s)) perSq.set(s, { fuori: [], dentro: [] }); perSq.get(s)![k].push(r)
    }
    for (const r of cmp.righe) {
      if (r.stato === 'soloapp' && !r.dubbio) metti(r.tid, 'fuori', r)
      else if (r.stato === 'solofile' && byId.has(+r.pid!)) metti(r.tid, 'dentro', r)
    }
    for (const [tid, g] of perSq) {
      for (const ruolo of ROLES) {
        const f = g.fuori.filter(x => x.p!.r === ruolo).sort((x, y) => y.cr - x.cr)
        const d = g.dentro.filter(x => x.p!.r === ruolo).sort((x, y) => y.cr - x.cr)
        for (let i = 0; i < Math.min(f.length, d.length); i++)
          svincoli.push({ tid: isNaN(+tid) ? tid : +tid, fuori: f[i], dentro: d[i] })
      }
    }
    return { scambi, svincoli, quanti: scambi.length + svincoli.length }
  }

  return {
    PL, byId, S, CAL, finestra: { from: gFrom(), span: gSpan() },
    meId, isMine, totalSlots, roster, stats, teamName,
    fixtures, golDaiVoti, forze, fixDiff, isOff, calScore,
    fvOf, giornateGiocate, statFor, formaOf,
    TITLAB, rigOf, annoScorso, medieRuolo, rangoFm, titFatti, titPrior, titW, titLiv, titStato,
    isOut, mentLabel, appetParts, appet,
    prices, attesa, attesaOra, mercato, esitoPrezzo,
    fasciaPrezzo, scarsita, pressLab, alternative,
    attesaSnap, undiciTipo, mediaLega, giudizio, giudizi,
    legaOn, legaGiornate, legaSerieA, legaIdx, legaTid, legaNome, legaPartite, legaAvv, legaTutte,
    attesoGiocatore, attesoRosa, normCdf, scontro, pericolosi, legaIncroci,
    moves, nextG, ownerAt, rosterAt, aggCrediti, prezzoDi, prezzoStorico, giocatoreDi,
    verificaScambio, verificaSvincolo, moviDi,
    giornataOggi, legaOggi,
    risultati, risultatiDi, classificaSerieA, pesoRisultati,
    legaRis, legaGiocate, esitoDi, classificaLega, verifica, sintesiVerifica,
    cartellini, squalifiche, squalificatoA, diffidati, rossiDaVedere, infoOut, rientri,
    dayParts, dayScore, dayWhy, formazioneAutomatica,
    indiceNomi, trovaGiocatore, abbinaRose, confrontoRose, movimentiProposti,
  }
}

export type Motore = ReturnType<typeof creaMotore>

export interface VoceSerie {
  g: number; fv: number; v: number; sv: number; gf: number; sub: number
  rp: number; rs: number; au: number; amm: number; esp: number; ass: number
}
export interface StatGiocatore {
  pres: number; su: number; serie: (VoceSerie | null)[]
  sv?: number; mv?: number | null; fm?: number
  gf?: number; ass?: number; amm?: number; esp?: number; sub?: number; rp?: number; rs?: number; au?: number; cs?: number
  conBonus?: number; bonus?: number; malus?: number; scarto?: number | null
  best?: VoceSerie | null; worst?: VoceSerie | null
  /** non viene mai scritto: vedi la nota in attesoGiocatore */
  pv?: number
}
export interface AnnoScorso {
  pv: number; mv: number; fm: number; gf: number; gs: number; rp: number; rc: number; rpiu: number; rmeno: number
  ass: number; amm: number; esp: number; au: number; sq: string | number
  su: number; bonus: number; scarto: number; cart: number
}
export interface TitStato { w: number; liv: number; dati: boolean; out: boolean; storico?: boolean; breve: string; nota: string }
export interface Avversario { i: number; tid: number | null; nome: string; casa: boolean; gl: number; ga: number }
export interface VoceVerifica {
  gl: number; ga: number; avv: number; casa: boolean; pf: number; pc: number; gf: number | null; gc: number | null
  atteso: number | null; attesoAvv: number | null; pVinco: number | null; vinta: number
}
export interface SquadraFile { nome: string; gio: { n: string; cr: number }[]; totale: number }
export interface FileRose { squadre: SquadraFile[]; quando: number }
export interface RigaConfronto {
  stato: 'ok' | 'prezzo' | 'squadra' | 'solofile' | 'soloapp' | 'ignoto'
  tid: number; cr: number
  pid?: number; p?: Giocatore; nome?: string; era?: number; prezzoApp?: number; dubbio?: boolean
}

function pieno<T>(x: T | null): x is T { return !!x }

export function normNome(s: string | null | undefined) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '') }

/* Il foglio ROSE è a colonne affiancate: ogni squadra occupa un nome e un
   «costo», intestati in cima, con i giocatori sotto fino alla riga «totale». */
export function parseRoseLega(rows: unknown[][], quando = Date.now()): FileRose {
  const cel = (r: number, c: number) => { const v = (rows[r] || [])[c]; return v === undefined || v === null ? '' : String(v).trim() }
  // l'intestazione è la prima riga con almeno due «costo»
  let h = -1
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    let k = 0; const larg = (rows[i] || []).length
    for (let c = 0; c < larg; c++) if (/^costo$/i.test(cel(i, c))) k++
    if (k >= 2) { h = i; break }
  }
  if (h < 0) throw new Error('non trovo la riga di intestazione con le colonne «costo»: il file non sembra quello delle rose')
  const blocchi: { nome: string; cn: number; cp: number }[] = []
  const larg = (rows[h] || []).length
  for (let c = 0; c + 1 < larg; c++)
    if (/^costo$/i.test(cel(h, c + 1)) && cel(h, c)) blocchi.push({ nome: cel(h, c), cn: c, cp: c + 1 })
  if (!blocchi.length) throw new Error("l'intestazione c'è ma non ci sono squadre sopra le colonne «costo»")
  const squadre = blocchi.map(b => {
    const gio: { n: string; cr: number }[] = []; let tot: number | null = null
    for (let j = h + 1; j < rows.length; j++) {
      const n = cel(j, b.cn)
      if (!n) break
      if (/^totale$/i.test(n)) { tot = parseInt(cel(j, b.cp)) || 0; break }
      gio.push({ n, cr: parseInt(cel(j, b.cp)) || 0 })
    }
    return { nome: b.nome, gio, totale: tot === null ? gio.reduce((s, g) => s + g.cr, 0) : tot }
  })
  if (!squadre.some(s => s.gio.length)) throw new Error('le colonne ci sono ma sono tutte vuote')
  return { squadre, quando }
}
