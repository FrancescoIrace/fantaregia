/* ══ Gli indisponibili da un file ════════════════════════════════════
   Un csv o un xlsx con una riga per giocatore — nome;stato;nota — come lo
   produce la routine che ogni giorno cerca infortuni e squalifiche di
   serie A. Qui si legge il file e si prepara una PROPOSTA: chi entra in
   infermeria, chi c'è già e cambia nota, chi rientra, e quello che non
   torna. Non si scrive niente: la proposta si guarda e poi si conferma.

   Niente si scarta in silenzio. Un nome che non si riconosce, due
   giocatori con lo stesso nome, uno stato che non si capisce: finiscono
   in un elenco a parte, con la riga del file, perché li si sistemi a mano.

   I nomi si confrontano senza accenti, maiuscole e punteggiatura. Non con
   normNome() del motore, che le lettere accentate le butta via invece di
   togliere l'accento — «Çalhanoğlu» diventava «alhanolu» e non combaciava
   con «Calhanoglu» — e che resta com'è per non toccare il port 1:1.     */
import type { Giocatore } from './tipi.ts'

/** il motivo che si salva: lo stesso vocabolario di segnaIndisponibile() */
export type Motivo = 'infortunio' | 'squalifica' | 'espulsione' | 'indisponibile'

export interface VoceFile { riga: number; nome: string; stato: string; nota: string }

/** minuscole, niente accenti, niente spazi e punteggiatura */
export const piega = (s: unknown) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '')

/* ── leggere il file ── */

/** Le righe del file: l'intestazione si cerca (nome, stato, nota, in qualunque
    ordine); se non c'è, le colonne sono nome, stato, nota nell'ordine. */
export function leggiFileIndisponibili(righe: unknown[][]): VoceFile[] {
  const cella = (r: unknown[], i: number) => (i < 0 ? '' : String(r[i] ?? '').trim())
  let testa = -1, iNome = 0, iStato = 1, iNota = 2
  for (let i = 0; i < Math.min(righe.length, 10); i++) {
    const t = (righe[i] || []).map(piega)
    if (t.includes('nome')) {
      testa = i; iNome = t.indexOf('nome')
      iStato = t.findIndex(x => x === 'stato' || x === 'motivo')
      iNota = t.findIndex(x => x === 'nota' || x === 'note' || x === 'dettaglio')
      break
    }
  }
  const out: VoceFile[] = []
  for (let i = testa + 1; i < righe.length; i++) {
    const r = righe[i] || []
    const nome = cella(r, iNome)
    if (!nome) continue
    out.push({ riga: i + 1, nome, stato: cella(r, iStato), nota: cella(r, iNota) })
  }
  return out
}

/* ── capire lo stato ── */

/* Tre valori, e solo quelli: «infortunio» e «squalifica» mettono fuori,
   «rientrato» rimette disponibile. Maiuscole, accenti e spazi non contano.
   Qualunque altra cosa non si indovina: finisce fra gli stati che non si
   capiscono, con la sua riga, e non si applica. Scelta di Francesco
   (17/09/2026): la routine scrive solo questi tre, e una regola stretta si
   controlla meglio di un elenco di sinonimi. */
type Stato = { tipo: 'fuori'; motivo: Motivo } | { tipo: 'rientro' }
const STATI: Record<string, Stato> = {
  infortunio: { tipo: 'fuori', motivo: 'infortunio' },
  squalifica: { tipo: 'fuori', motivo: 'squalifica' },
  rientrato: { tipo: 'rientro' },
}
/** i valori che il file può avere nella colonna stato, per l'interfaccia */
export const STATI_VALIDI = Object.keys(STATI)

/** fuori con un motivo, rientrato, o null se lo stato non è uno dei tre */
export function capisciStato(stato: string): Stato | null {
  return STATI[piega(stato)] ?? null
}

/* ── riconoscere i nomi ── */

/** senza l'iniziale finale: «Martinez L.» → «martinez» */
const senzaIniziale = (n: string) => n.replace(/\s+\S{1,3}\.?$/, '')
const iniziale = (n: string) => { const m = /\s+(\S{1,3})\.?$/.exec(n); return m ? piega(m[1])[0] ?? '' : '' }

export type Esito = { tipo: 'trovato'; p: Giocatore } | { tipo: 'omonimi'; candidati: Giocatore[] } | { tipo: 'nessuno' }

export function indiceGiocatori(giocatori: Giocatore[]) {
  const pieni = new Map<string, Giocatore[]>(), corti = new Map<string, Giocatore[]>()
  const metti = (m: Map<string, Giocatore[]>, k: string, p: Giocatore) => {
    if (!k) return
    const l = m.get(k) ?? []
    if (!l.some(x => x.id === p.id)) l.push(p)
    m.set(k, l)
  }
  for (const p of giocatori) {
    if (!p?.n) continue
    metti(pieni, piega(p.n), p)
    const c = piega(senzaIniziale(p.n))
    if (c !== piega(p.n)) metti(corti, c, p)
  }
  return { pieni, corti }
}

/** Il nome del file contro il listone. Prima il nome intero, poi senza
    l'iniziale, poi parola per parola («Lautaro Martinez» → «Martinez L.»),
    usando l'altra parola come iniziale per scegliere fra gli omonimi. */
export function riconosci(nome: string, ix: ReturnType<typeof indiceGiocatori>): Esito {
  const esito = (l: Giocatore[] | undefined): Esito | null =>
    !l?.length ? null : l.length === 1 ? { tipo: 'trovato', p: l[0] } : { tipo: 'omonimi', candidati: l }
  const k = piega(nome)
  const diretto = esito(ix.pieni.get(k)) ?? esito(ix.corti.get(k))
  if (diretto) return diretto

  const parole = nome.split(/[\s.]+/).map(piega).filter(x => x.length >= 2)
  if (parole.length < 2) return { tipo: 'nessuno' }
  const insieme = new Map<number, Giocatore>()
  for (const w of parole) for (const p of [...(ix.pieni.get(w) ?? []), ...(ix.corti.get(w) ?? [])]) insieme.set(p.id, p)
  const tutti = [...insieme.values()]
  if (tutti.length <= 1) return esito(tutti) ?? { tipo: 'nessuno' }
  // omonimi: tiene chi ha l'iniziale di una delle altre parole
  const conIniziale = tutti.filter(p => {
    const i = iniziale(p.n), cognome = piega(senzaIniziale(p.n))
    return !!i && parole.some(w => w !== cognome && w[0] === i)
  })
  return conIniziale.length === 1 ? { tipo: 'trovato', p: conIniziale[0] } : { tipo: 'omonimi', candidati: tutti }
}

/* ── la proposta ── */

export interface Entra { pid: number; p: Giocatore; motivo: Motivo; nota: string; riga: number }
export interface Aggiorna extends Entra { prima: { motivo?: string; nota?: string } }
export interface Rientra { pid: number; p: Giocatore; nota: string; riga: number }
export interface Proposta {
  entrano: Entra[]
  aggiornati: Aggiorna[]
  rientrano: Rientra[]
  /** «rientrato» per chi non era fuori: non c'è niente da togliere, si segnala e basta */
  nonFuori: (VoceFile & { p: Giocatore })[]
  /** già fuori con lo stesso motivo e la stessa nota: niente da fare */
  invariati: { p: Giocatore; riga: number; perche: string }[]
  nonTrovati: VoceFile[]
  omonimi: (VoceFile & { candidati: Giocatore[] })[]
  statiIgnoti: VoceFile[]
}

export function proponi(voci: VoceFile[], giocatori: Giocatore[], fuoriOra: (pid: number) => { motivo?: string; nota?: string } | null): Proposta {
  const ix = indiceGiocatori(giocatori)
  const pr: Proposta = { entrano: [], aggiornati: [], rientrano: [], nonFuori: [], invariati: [], nonTrovati: [], omonimi: [], statiIgnoti: [] }
  const visti = new Map<number, number>()      // un giocatore scritto due volte: vale l'ultima riga
  for (const v of voci) {
    const stato = capisciStato(v.stato)
    if (!stato) { pr.statiIgnoti.push(v); continue }
    const e = riconosci(v.nome, ix)
    if (e.tipo === 'nessuno') { pr.nonTrovati.push(v); continue }
    if (e.tipo === 'omonimi') { pr.omonimi.push({ ...v, candidati: e.candidati }); continue }
    const p = e.p
    if (visti.has(p.id)) togli(pr, p.id)
    visti.set(p.id, v.riga)
    aggiungi(pr, p, stato, v, fuoriOra(p.id))
  }
  return pr
}

/** Una voce scelta a mano fra gli omonimi entra nella proposta come le altre. */
export function scegliOmonimo(pr: Proposta, riga: number, p: Giocatore, fuoriOra: (pid: number) => { motivo?: string; nota?: string } | null): Proposta {
  const v = pr.omonimi.find(x => x.riga === riga)
  if (!v) return pr
  const nuova: Proposta = { ...pr, entrano: [...pr.entrano], aggiornati: [...pr.aggiornati], rientrano: [...pr.rientrano],
    nonFuori: [...pr.nonFuori], invariati: [...pr.invariati], omonimi: pr.omonimi.filter(x => x.riga !== riga) }
  togli(nuova, p.id)
  aggiungi(nuova, p, capisciStato(v.stato)!, v, fuoriOra(p.id))
  return nuova
}

function togli(pr: Proposta, pid: number) {
  pr.entrano = pr.entrano.filter(x => x.pid !== pid)
  pr.aggiornati = pr.aggiornati.filter(x => x.pid !== pid)
  pr.rientrano = pr.rientrano.filter(x => x.pid !== pid)
  pr.nonFuori = pr.nonFuori.filter(x => x.p.id !== pid)
  pr.invariati = pr.invariati.filter(x => x.p.id !== pid)
}

function aggiungi(pr: Proposta, p: Giocatore, stato: Stato, v: VoceFile, ora: { motivo?: string; nota?: string } | null) {
  if (stato.tipo === 'rientro') {
    if (ora) pr.rientrano.push({ pid: p.id, p, nota: v.nota, riga: v.riga })
    else pr.nonFuori.push({ ...v, p })
    return
  }
  const voce = { pid: p.id, p, motivo: stato.motivo, nota: v.nota, riga: v.riga }
  if (!ora) pr.entrano.push(voce)
  else if ((ora.motivo ?? '') === stato.motivo && (ora.nota ?? '') === v.nota) pr.invariati.push({ p, riga: v.riga, perche: 'già fuori, con la stessa nota' })
  else pr.aggiornati.push({ ...voce, prima: ora })
}

/** quante scritture farà la conferma */
export const daApplicare = (pr: Proposta) => pr.entrano.length + pr.aggiornati.length + pr.rientrano.length

/** come si legge un motivo in Infermeria */
export function etichettaMotivo(motivo: string | undefined) {
  if (motivo === 'espulsione') return 'espulso'
  if (motivo === 'squalifica') return 'squalificato'
  if (motivo === 'indisponibile') return 'indisponibile'
  return 'infortunato'
}
