import type { Motore } from '../domain/motore.ts'

/* ══ Le pagine della lega, e in che ordine ═══════════════════════════
   Port di part5 §"Modalità asta". Le stesse pagine in due ordini: con
   l'asta accesa vengono prima quelle che servono a comprare, spenta
   quelle che servono a giocare le giornate. È una preferenza di chi
   guarda, quindi resta sul dispositivo: niente database, come l'ordine
   dell'infermeria e le rose chiuse.

   ORDINE e PRIME sono l'unica sorgente della disposizione, e la leggono
   in due: le schede orizzontali da scrivania e la barra in basso del
   telefono. Le PRIME quattro sono «quelle del momento» — in barra sul
   telefono, in primo piano da scrivania; le altre restano in secondo
   piano di là e nel cassetto di qua. Nessuno dei due riscrive l'elenco.

   Le chiavi sono quelle dell'originale tradotte nelle rotte di qui:
   giornate → formazioni, lega → scontri. Mercato è nuova: nell'app a
   file singolo i movimenti stavano dentro «Lega e dati», quindi non
   aveva una posizione da rispettare.

   Due cose da non confondere, sulla rotta `scontri`:
   - l'etichetta è «Giornata», perché è lì che si va a vedere chi si
     affronta questa settimana. Si chiamava «Lega», che sul telefono,
     dentro la lega, non distingueva niente;
   - il path resta `scontri`. Cambiarlo romperebbe i link già in giro.

   La Panoramica sta fuori da tutti e due gli ordini: è la rotta index e
   la casa della lega (dentro ci sono carica dati e rose ufficiali).
   Sul telefono è la prima voce del cassetto, staccata, col nome che
   dice cosa contiene — «Lega e dati». Da scrivania la scheda continua a
   chiamarsi «Panoramica», perché sopra i 900px non cambia niente.    */
export type Modo = 'asta' | 'stagione'
export type Scheda = 'asta' | 'listone' | 'titolari' | 'rose' | 'calendario'
  | 'rendimento' | 'formazioni' | 'scontri' | 'infermeria' | 'mercato'

/* Il path della rotta, il nome sulla scheda, e una riga che dice cosa
   c'è dentro — quest'ultima la usa il cassetto del telefono, dove una
   voce ha lo spazio per spiegarsi e una scheda no. */
export interface VoceScheda { path: string; testo: string; spiega: string }

export const SCHEDE: Record<Scheda, VoceScheda> = {
  asta:       { path: 'asta',       testo: 'Asta live',  spiega: 'la console di chiamata' },
  listone:    { path: 'listone',    testo: 'Listone',    spiega: 'tutti i giocatori con gli indici' },
  rose:       { path: 'rose',       testo: 'Rose',       spiega: 'le rose di tutti e i giudizi' },
  formazioni: { path: 'formazioni', testo: 'Formazioni', spiega: 'il campo, giornata per giornata' },
  scontri:    { path: 'scontri',    testo: 'Giornata',   spiega: 'chi affronti, classifica, previsioni' },
  rendimento: { path: 'rendimento', testo: 'Rendimento', spiega: 'presenze, medie, bonus' },
  titolari:   { path: 'titolari',   testo: 'Titolari',   spiega: 'chi gioca e chi no' },
  calendario: { path: 'calendario', testo: 'Calendario', spiega: 'quanto sono morbide le prossime giornate' },
  infermeria: { path: 'infermeria', testo: 'Infermeria', spiega: 'infortuni, squalifiche, diffide' },
  mercato:    { path: 'mercato',    testo: 'Mercato',    spiega: 'scambi e svincoli' },
}

/** La rotta index, che non entra in nessuno dei due ordini. */
export const PANORAMICA = { testo: 'Lega e dati', spiega: 'squadre, crediti, file da caricare, membri, inviti' }

export const ORDINE: Record<Modo, Scheda[]> = {
  asta:     ['asta', 'listone', 'titolari', 'rose', 'calendario', 'rendimento', 'formazioni', 'scontri', 'infermeria', 'mercato'],
  /* Giornata prima di Formazioni: la domanda del sabato è «chi affronto»,
     e la formazione si schiera sapendo quello. */
  stagione: ['scontri', 'formazioni', 'infermeria', 'titolari', 'mercato', 'rendimento', 'calendario', 'listone', 'rose', 'asta'],
}
export const PRIME = 4   // quante voci sono "quelle del momento"

/* alla prima apertura decide da sola: se l'asta non è finita, è modalità
   asta. Stesso conto di modoAsta() nell'originale. */
export function modoAuto(m: Motore): Modo {
  const presi = Object.keys(m.S.assign).length
  const servono = m.totalSlots() * m.S.teams.length
  return servono > 0 && presi >= servono ? 'stagione' : 'asta'
}

const chiave = (legaId: string) => `fantaregia:modo:${legaId}`

export function modoSalvato(legaId: string): Modo | null {
  try { const v = localStorage.getItem(chiave(legaId)); return v === 'asta' || v === 'stagione' ? v : null } catch { return null }
}

export function salvaModo(legaId: string, modo: Modo) {
  try { localStorage.setItem(chiave(legaId), modo) } catch { /* senza memoria locale vale per questa visita */ }
}
