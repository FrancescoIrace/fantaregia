/* ══ Il file degli indisponibili su tutte le leghe che gestisci ═══════
   Ogni lega ha il suo listone, la sua rosa e i suoi infortunati: la stessa
   riga del file può entrare in una, essere già fuori in un'altra, e non
   esistere nella terza. Quindi la proposta si fa lega per lega, con il
   motore di quella lega, e solo dopo si applica.

   Si scrive solo dove lo si può già fare: le stesse funzioni e la stessa
   RLS di «Infermeria», admin e banditori di quella lega. Non c'è una
   scrittura fra leghe: c'è la stessa scrittura ripetuta per ognuna delle tue. */
import { creaMotore } from '../domain/motore.ts'
import {
  contestoLega, proponi, riassuntoProposta, vociDaScrivere, type Proposta, type VoceFile,
} from '../domain/indisponibili.ts'
import { ingressoMotore } from './componi.ts'
import { caricaRighe, importaIndisponibili } from './lega.ts'

export interface LegaGestita { id: string; nome: string }

export type Preparata = { lega: LegaGestita } & (
  | { stato: 'pronta'; proposta: Proposta; fuori: ReturnType<typeof vociDaScrivere>['fuori']; rientrati: ReturnType<typeof vociDaScrivere>['rientrati']; notaMancante: boolean }
  | { stato: 'senza-listone' }
  | { stato: 'errore'; testo: string }
)

/** la proposta per una lega. Un errore in una non ferma le altre: torna come stato di quella. */
export async function preparaLega(lega: LegaGestita, utenteId: string, voci: VoceFile[]): Promise<Preparata> {
  try {
    const righe = await caricaRighe(lega.id, utenteId)
    const m = creaMotore(ingressoMotore(righe))
    // senza listone ogni nome del file sarebbe «non riconosciuto»: meglio dire che manca il listone
    if (!m.PL.length) return { lega, stato: 'senza-listone' }
    const { giocatori, fuoriOra } = contestoLega(m)
    const proposta = proponi(voci, giocatori, fuoriOra)
    return { lega, stato: 'pronta', proposta, ...vociDaScrivere(proposta, m, m.nextG()), notaMancante: !!righe.notaMancante }
  } catch (e) {
    return { lega, stato: 'errore', testo: (e as Error).message }
  }
}

/** scrive la proposta di una lega; le omonimie e i nomi non riconosciuti non entrano, come in Infermeria */
export async function applicaLega(p: Extract<Preparata, { stato: 'pronta' }>) {
  const { storico } = await importaIndisponibili(p.lega.id, p.fuori, p.rientrati, !p.notaMancante)
  return { parti: riassuntoProposta(p.proposta), storico }
}
