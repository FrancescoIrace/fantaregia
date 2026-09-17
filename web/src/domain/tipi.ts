/* Le forme dei dati sono quelle dell'app a file singolo (src/part4.html),
   tenute identiche di proposito: il motore si porta 1:1 e lo strato che
   parla con Supabase ricompone questo stesso stato a partire dalle tabelle.
   Cambiare una forma qui vuol dire cambiare il motore: non farlo a cuor
   leggero, e rilancia il test di equivalenza.                            */

export type Ruolo = 'P' | 'D' | 'C' | 'A'

/** una riga di window.PLAYERS: [id, r, rm, nome, squadra, qt.a, fvm, convenienza] */
export type GiocatoreGrezzo = [number, Ruolo, string, string, string, number, number, number]

/** giocatore del listone, con le derivate che recompute() ci scrive sopra */
export interface Giocatore {
  id: number
  r: Ruolo
  n: string
  s: string
  q: number
  rm?: string
  f?: number
  v?: number
  /** già assegnato ma sparito dal listone aggiornato */
  out?: boolean
  rank?: number
  tit?: number
  off?: number | null
  mn?: number | null
  val?: number
}

/** fotografia del giocatore al momento dell'acquisto */
export type Snap = Pick<Giocatore, 'id' | 'r' | 'n' | 's' | 'q'>

/** window.CAL: fix[i][g-1] = indice avversario + 1, positivo in casa, negativo fuori */
export interface Calendario {
  teams: string[]
  fix: number[][]
  dates: (string | null)[]
}

/** id → [gerarchia, confermato da entrambe le fonti] */
export type Rigoristi = Record<string, [number, number]>

/** id → [Pv,Mv,Fm,Gf,Gs,Rp,Rc,R+,R-,Ass,Amm,Esp,Au,squadra] della stagione scorsa */
export type Storico = Record<string, (number | string)[]>

/** [voto, sv, gf, gs, rp, rs, au, amm, esp, ass] */
export type VotoRiga = number[]

export interface Squadra {
  id: number
  name: string
}

export interface Assegnazione {
  team: number
  price: number
  snap: Snap | null | undefined
}

export interface VoceLog {
  pid: number
  team: number
  price: number
  t: number
}

export interface VoceMovimento {
  pid: number
  da: number | null
  a: number | null
  prezzo?: number
  snap?: Snap
}

export interface Movimento {
  id: number
  g: number
  tipo: 'scambio' | 'svincolo'
  ts: number
  voci: VoceMovimento[]
  agg: Record<string, number>
  rimborso?: number
  costo?: number
}

export interface RisultatoLega {
  pa: number
  pb: number
  ga: number | null
  gb: number | null
}

/** S.lega: il calendario della lega, con i risultati quando ci sono */
export interface CalendarioLega {
  nome?: string
  teams: string[]
  off: number
  gior: [number, number][][]
  ris?: (RisultatoLega | null)[][]
}

export type VoceOut = 1 | { motivo?: string; da?: number; ts?: number; nota?: string }

/** lo stato condiviso fra tutti i partecipanti (S nell'app a file singolo) */
export interface StatoLega {
  teams: Squadra[]
  budget: number
  slots: Record<Ruolo, number>
  plan: Record<Ruolo, number>
  assign: Record<string, Assegnazione>
  log: VoceLog[]
  rev: number
  stats: Record<string, Record<string, VotoRiga>>
  votiMeta: { sheet?: string }
  out: Record<string, VoceOut>
  moves?: Movimento[]
  lega?: CalendarioLega | null
  legaMap?: Record<string, number>
  squalSalta?: Record<string, 1>
  squalOn?: boolean
  roseMeta?: { nome: string; when: number; diverse?: number } | null
}

export interface Obiettivo {
  max?: number
}

/** lo stato privato di chi guarda (ME): non si condivide con la lega */
export interface Preferenze {
  myTeam: number | null
  targets: Record<string, Obiettivo>
}
