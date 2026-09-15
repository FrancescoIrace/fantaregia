/* ══ Il calendario di lega ═══════════════════════════════════════════
   Port di parseCalLega/proponiAbbinamenti (src/part6.html, «Import del
   calendario di lega») e della riconciliazione che pickCalLega faceva
   prima di sovrascrivere S.lega.

   Questo file è l'unica fonte dei risultati di lega: il motore non li
   calcola, e non potrebbe. Le formazioni degli altri sono private, e la
   conversione fantapunti → gol dipende da regole di lega che l'app non
   conosce. Da qui vengono classificaLega() e verifica().

   Niente DOM e niente stato globale: le squadre dell'asta entrano come
   parametro, la scrittura la fa chi chiama.                            */
import type { CalendarioLega, RisultatoLega } from './tipi.ts'

/** quello che il file dice oltre al calendario: serve solo a raccontarlo */
export interface LetturaCalLega {
  cal: CalendarioLega
  giocate: number      // giornate con almeno un risultato
  prime: number        // la prima giornata di lega trovata nel file
  offMisto: boolean    // l'aggancio alla serie A non è costante nel file
  avvisi: string[]     // al massimo quattro
}

/* Il file è un foglio a blocchi: ogni blocco si apre con «Nª Giornata
   lega» e, tre colonne più in là, «Mª Giornata serie a»; sotto ci sono le
   partite, casa nella colonna del titolo e ospite tre colonne dopo. I
   blocchi stanno affiancati a coppie, quindi si scandisce tutta la riga,
   non solo la prima colonna.                                           */
export function parseCalLega(rows: unknown[][]): LetturaCalLega {
  const cel = (r: number, c: number) => {
    const v = (rows[r] || [])[c]
    return v === undefined || v === null ? '' : String(v).trim()
  }
  const blocchi: { gl: number; ga: number | null; riga: number; col: number }[] = []
  for (let i = 0; i < rows.length; i++) {
    const larg = (rows[i] || []).length
    for (let c = 0; c < larg; c++) {
      const m = cel(i, c).match(/^(\d+)\s*[ªa°]?\s*giornata\s+lega/i)
      if (!m) continue
      let ga: number | null = null
      for (let k = c + 1; k < Math.min(c + 5, larg); k++) {
        const m2 = cel(i, k).match(/^(\d+)\s*[ªa°]?\s*giornata\s+serie/i)
        if (m2) { ga = parseInt(m2[1]); break }
      }
      blocchi.push({ gl: parseInt(m[1]), ga, riga: i, col: c })
    }
  }
  if (!blocchi.length) throw new Error('non trovo nessuna riga tipo «1ª Giornata lega»: il file non sembra un calendario di lega')

  const nomi = new Map<string, number>(), gior = new Map<number, [string, string][]>(), off: number[] = []
  const idx = (n: string) => { if (!nomi.has(n)) nomi.set(n, nomi.size); return nomi.get(n)! }
  /* Le colonne fra le due squadre non sono decorazione: sono i fantapunti,
     e cinque colonne più in là c'è il risultato in gol dello scontro. Prima
     dell'inizio valgono «0», «0» e «-»; a stagione avviata «79.5», «69.5»
     e «3-1». Da qui vengono classifica e verifica delle previsioni.      */
  const esiti = new Map<number, (RisultatoLega | null)[]>()
  const num = (v: string) => { const x = parseFloat(String(v).replace(',', '.')); return isFinite(x) ? x : null }
  for (const b of blocchi) {
    const part: [string, string][] = [], res: (RisultatoLega | null)[] = []
    for (let j = b.riga + 1; j < rows.length; j++) {
      const casa = cel(j, b.col), osp = cel(j, b.col + 3)
      if (!casa || !osp) break
      if (/giornata/i.test(casa)) break
      part.push([casa, osp])
      const pa = num(cel(j, b.col + 1)), pb = num(cel(j, b.col + 2))
      const m = cel(j, b.col + 4).match(/^(\d+)\s*[-–]\s*(\d+)$/)
      // giocata solo se c'è un risultato o dei fantapunti veri
      res.push((m || pa || pb) ? { pa: pa as number, pb: pb as number, ga: m ? +m[1] : null, gb: m ? +m[2] : null } : null)
      if (part.length >= 32) break
    }
    if (!part.length) continue
    gior.set(b.gl, part)
    esiti.set(b.gl, res)
    if (b.ga) off.push(b.ga - b.gl)
  }
  if (gior.size < 2) throw new Error('ho letto solo ' + gior.size + ' giornate')

  // le partite arrivano come nomi: qui diventano indici
  for (const [, ps] of gior) for (const [a, b] of ps) { idx(a); idx(b) }
  const teams = [...nomi.keys()]
  const ordinate = [...gior.keys()].sort((a, b) => a - b)
  const fix = ordinate.map(g => gior.get(g)!.map(([a, b]) => [nomi.get(a)!, nomi.get(b)!] as [number, number]))

  // l'offset dovrebbe essere lo stesso ovunque; se non lo è, si prende il più frequente
  const cnt: Record<number, number> = {}
  off.forEach(o => { cnt[o] = (cnt[o] || 0) + 1 })
  const chiavi = Object.keys(cnt)
  const offv = off.length ? +chiavi.sort((a, b) => cnt[+b] - cnt[+a])[0] : 0
  const offMisto = off.length > 0 && chiavi.length > 1

  // controlli: ogni giornata deve avere metà squadre di partite, e nessuno due volte
  const avvisi: string[] = []
  const attese = Math.floor(teams.length / 2)
  fix.forEach((ps, i) => {
    if (ps.length !== attese) avvisi.push(`la giornata ${ordinate[i]} ha ${ps.length} partite invece di ${attese}`)
    const visti = new Set<number>()
    for (const [a, b] of ps) {
      if (visti.has(a) || visti.has(b)) avvisi.push(`alla giornata ${ordinate[i]} una squadra compare due volte`)
      visti.add(a); visti.add(b)
    }
  })

  const ris = ordinate.map(g => esiti.get(g) || [])
  const giocate = ris.reduce((a, r) => a + (r.some(x => x) ? 1 : 0), 0)
  return {
    cal: { teams, off: offv, gior: fix, ris },
    giocate, prime: ordinate[0], offMisto, avvisi: avvisi.slice(0, 4),
  }
}

/** una squadra dell'asta come la vede l'abbinamento: il nome e i colpi grossi */
export interface SquadraAsta {
  tid: number
  nome: string
  colpi: { nome: string; prezzo: number }[]
}

const normNome = (s: unknown) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '')

/* Proposta di abbinamento: prima il nome uguale o quasi, poi l'indizio
   delle rose — chi ha comprato Thuram sta bene in «I Duran Thuram».     */
export function proponiAbbinamenti(squadre: SquadraAsta[], teams: string[]): Record<string, number> {
  const out: Record<string, number> = {}, presi = new Set<number>()
  const punteggio = (t: SquadraAsta, nome: string) => {
    const a = normNome(t.nome), b = normNome(nome)
    let p = 0
    if (a === b) p += 100
    else if (a && b && (a.includes(b) || b.includes(a))) p += 60
    else {                                   // prefisso comune di almeno 4 lettere
      let k = 0
      while (k < a.length && k < b.length && a[k] === b[k]) k++
      if (k >= 4) p += 30 + k
    }
    /* Indizio dalle rose, ma solo sui colpi grossi: una squadra si chiama
       come il suo giocatore simbolo, mai come il riempitivo da un credito.
       Senza questa regola «Giorgio» finiva su «mazzocchi» per un giocatore
       pagato 1, e «Thuram K.» a un credito rubava «I Duran Thuram» a chi
       aveva comprato il vero Thuram a 241.                               */
    for (const x of [...t.colpi].sort((u, v) => v.prezzo - u.prezzo).slice(0, 3)) {
      if (x.prezzo < 25) continue
      const cog = normNome((x.nome || '').split(/[ .]/)[0])
      if (cog.length >= 5 && b.includes(cog)) p += 34 + Math.min(12, Math.round(x.prezzo / 25))
    }
    return p
  }
  const coppie: { tid: number; i: number; p: number }[] = []
  for (const t of squadre) teams.forEach((nome, i) => { const p = punteggio(t, nome); if (p > 0) coppie.push({ tid: t.tid, i, p }) })
  coppie.sort((a, b) => b.p - a.p)
  for (const c of coppie) {
    if (out[c.tid] !== undefined || presi.has(c.i)) continue
    if (c.p < 28) continue                   // sotto questa soglia è tirare a indovinare
    out[c.tid] = c.i; presi.add(c.i)
  }
  return out
}

/** cosa è successo agli abbinamenti ricaricando il calendario */
export interface Riallineamento {
  map: Record<string, number>
  rinominate: string[]   // «vecchio → nuovo», a incroci identici
  persi: string[]        // nomi abbinati che nel file nuovo non ci sono più
  rifatto: boolean       // gli incroci sono diversi da quelli di prima
  tenuti: number         // abbinamenti recuperati per nome dopo un rifacimento
  aveva: boolean         // c'era già un calendario abbinato
}

/* Ricaricando il calendario a stagione iniziata i nomi possono essere
   cambiati: i partecipanti rinominano la squadra quando vogliono. Va letto
   PRIMA di sovrascrivere il calendario, altrimenti si finisce a confrontare
   il calendario nuovo con se stesso.                                    */
export function riallinea(
  prima: CalendarioLega | null | undefined,
  primaMap: Record<string, number>,
  nuovo: CalendarioLega,
  squadre: SquadraAsta[],
): Riallineamento {
  const primaGior = prima?.gior ?? null, primaTeams = prima?.teams ?? null
  const aveva = !!(primaGior && primaGior.length && Object.keys(primaMap).length)
  const stessaStruttura = aveva && primaGior!.length === nuovo.gior.length
    && JSON.stringify(primaGior) === JSON.stringify(nuovo.gior)
  const rinominate: string[] = [], persi: string[] = []
  if (stessaStruttura && primaTeams) nuovo.teams.forEach((n, i) => {
    if (primaTeams[i] && primaTeams[i] !== n) rinominate.push(`${primaTeams[i]} → ${n}`)
  })

  if (stessaStruttura && Object.values(primaMap).every(i => i >= 0 && i < nuovo.teams.length)) {
    // gli incroci sono identici: gli indici valgono ancora
    return { map: { ...primaMap }, rinominate, persi, rifatto: false, tenuti: Object.keys(primaMap).length, aveva }
  }
  if (aveva && primaTeams) {
    // il calendario è cambiato: si tiene quello che si può, per nome
    const map: Record<string, number> = {}, presi = new Set<number>()
    for (const tid in primaMap) {
      const nome = primaTeams[primaMap[tid]]
      const j = nome ? nuovo.teams.indexOf(nome) : -1
      if (j >= 0 && !presi.has(j)) { map[tid] = j; presi.add(j) }
      else if (nome) persi.push(nome)
    }
    const tenuti = Object.keys(map).length
    const prop = proponiAbbinamenti(squadre, nuovo.teams)
    for (const tid in prop) if (map[tid] === undefined && !presi.has(prop[tid])) { map[tid] = prop[tid]; presi.add(prop[tid]) }
    return { map, rinominate, persi, rifatto: true, tenuti, aveva }
  }
  return { map: proponiAbbinamenti(squadre, nuovo.teams), rinominate, persi, rifatto: false, tenuti: 0, aveva }
}
