/* ══ Dal database allo stato del motore ══════════════════════════════
   Le tabelle Supabase tengono i dati a righe — una per assegnazione, una
   per giornata di voti, una per movimento. Il motore degli indici vuole lo
   stato nella forma dell'app a file singolo (S e ME). Qui si passa
   dall'una all'altra e basta: nessun calcolo, così se un numero cambia fra
   le due versioni il colpevole non può essere questo file.            */
import type { IngressoMotore } from '../domain/motore.ts'
import type {
  Calendario, CalendarioLega, GiocatoreGrezzo, Movimento, Obiettivo, Rigoristi, Ruolo, Snap,
  StatoLega, Storico, VoceMovimento, VoceOut, VotoRiga,
} from '../domain/tipi.ts'

/* ── le righe, con i nomi delle colonne della migrazione ── */
export interface RigaLega {
  id: string
  nome: string
  stagione: string
  budget: number
  slots: Record<Ruolo, number>
  plan: Record<Ruolo, number>
  squal_on: boolean
  voti_meta: { sheet?: string } | null
  rose_meta: StatoLega['roseMeta']
  versione: number
  aggiornata_il: string
}
export interface RigaSquadra { id: number; nome: string; posizione: number; lega_idx: number | null }
export interface RigaAssegnazione { giocatore_id: number; squadra_id: number; prezzo: number; snap: Snap | null }
export interface RigaLog { giocatore_id: number; squadra_id: number; prezzo: number; registrata_il: string }
export interface RigaMovimento {
  id: number
  giornata: number
  tipo: 'scambio' | 'svincolo'
  voci: VoceMovimento[]
  agg: Record<string, number>
  rimborso: number | null
  costo: number | null
  registrato_il: string
}
export interface RigaIndisponibile { giocatore_id: number; motivo: string | null; da_giornata: number | null; segnato_il: string }
export interface RigaSqualificaAnnullata { giocatore_id: number; giornata: number }
export interface RigaVoti { giornata: number; voti: Record<string, VotoRiga> }
export type TipoDataset = 'listone' | 'calendario' | 'rigoristi' | 'storico' | 'calendario_lega'
export interface RigaDataset { tipo: TipoDataset; dati: unknown; meta: Record<string, unknown> }
export interface RigaPreferenze {
  mia_squadra: number | null
  obiettivi: Record<string, Obiettivo>
  formazioni: Record<string, unknown>
}

export interface RigheLega {
  lega: RigaLega
  squadre: RigaSquadra[]
  assegnazioni: RigaAssegnazione[]
  log: RigaLog[]
  movimenti: RigaMovimento[]
  indisponibili: RigaIndisponibile[]
  squalificheAnnullate: RigaSqualificaAnnullata[]
  voti: RigaVoti[]
  dataset: RigaDataset[]
  preferenze: RigaPreferenze | null
}

/** lo stato condiviso della lega, nella forma di S */
export function componiStato(r: RigheLega): StatoLega {
  const squadre = [...r.squadre].sort((a, b) => a.posizione - b.posizione)

  const legaMap: Record<string, number> = {}
  for (const s of squadre) if (s.lega_idx !== null && s.lega_idx !== undefined) legaMap[String(s.id)] = s.lega_idx

  const assign: StatoLega['assign'] = {}
  for (const a of r.assegnazioni) assign[a.giocatore_id] = { team: a.squadra_id, price: a.prezzo, snap: a.snap }

  // S.log è dal più recente, e l'app ne tiene al massimo 500
  const log = r.log
    .map(l => ({ pid: l.giocatore_id, team: l.squadra_id, price: l.prezzo, t: Date.parse(l.registrata_il) }))
    .sort((a, b) => b.t - a.t)
    .slice(0, 500)

  // S.moves è ordinato per giornata e poi per ora: ownerAt() ci conta
  const moves: Movimento[] = r.movimenti
    .map(m => {
      const mv: Movimento = { id: m.id, g: m.giornata, tipo: m.tipo, ts: Date.parse(m.registrato_il), voci: m.voci, agg: m.agg }
      if (m.rimborso !== null) mv.rimborso = m.rimborso
      if (m.costo !== null) mv.costo = m.costo
      return mv
    })
    .sort((x, y) => x.g - y.g || x.ts - y.ts)

  const out: Record<string, VoceOut> = {}
  for (const i of r.indisponibili) {
    const v: Exclude<VoceOut, 1> = { ts: Date.parse(i.segnato_il) }
    if (i.motivo !== null) v.motivo = i.motivo
    if (i.da_giornata !== null) v.da = i.da_giornata
    out[i.giocatore_id] = v
  }

  const squalSalta: Record<string, 1> = {}
  for (const s of r.squalificheAnnullate) squalSalta[`${s.giocatore_id}-${s.giornata}`] = 1

  const stats: StatoLega['stats'] = {}
  for (const v of r.voti) stats[v.giornata] = v.voti

  const calLega = r.dataset.find(d => d.tipo === 'calendario_lega')

  return {
    teams: squadre.map(s => ({ id: s.id, name: s.nome })),
    budget: r.lega.budget,
    slots: r.lega.slots,
    plan: r.lega.plan,
    assign,
    log,
    rev: r.lega.versione,
    stats,
    votiMeta: r.lega.voti_meta ?? {},
    out,
    moves,
    lega: (calLega?.dati as CalendarioLega | undefined) ?? null,
    legaMap,
    squalSalta,
    squalOn: r.lega.squal_on,
    roseMeta: r.lega.rose_meta ?? null,
  }
}

/** tutto quello che serve a creaMotore(): i file della lega, lo stato condiviso e il privato di chi guarda */
export function ingressoMotore(r: RigheLega, opz: Pick<IngressoMotore, 'finestra' | 'oggi'> = {}): IngressoMotore {
  const ds = (t: TipoDataset) => r.dataset.find(d => d.tipo === t)?.dati
  return {
    players: (ds('listone') as GiocatoreGrezzo[] | undefined) ?? [],
    cal: ds('calendario') as Calendario | undefined,
    rig: ds('rigoristi') as Rigoristi | undefined,
    hist: ds('storico') as Storico | undefined,
    stato: componiStato(r),
    me: r.preferenze ? { myTeam: r.preferenze.mia_squadra, targets: r.preferenze.obiettivi } : undefined,
    ...opz,
  }
}
