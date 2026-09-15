/* ============================================================
   FANTAREGIA — colore squadra
   ------------------------------------------------------------
   Scrive --fr-marchio, --fr-marchio-ink e --fr-marchio-velo
   partendo dalla tinta scelta dall'utente, correggendola per il
   fondo su cui finisce. La tonalità resta quella scelta: si
   muove solo la luminosità, e solo quanto basta a leggerla.

   Da richiamare: alla prima apertura, a ogni cambio di tinta e
   a ogni cambio di tema.
   ============================================================ */

const CONTRASTO_MINIMO = 3.6;   // tinta contro il fondo del pannello
const VICINANZA_TINTA  = 22;    // gradi entro cui si collide con su/giù
const VICINANZA_LEGA   = 14;    // gradi entro cui due squadre si confondono
const SATURAZIONE_MINIMA = .18; // sotto, la tonalità non vuol dire più niente
const PASSO = .08, GIRI_MAX = 20;

export const TINTE_PRONTE: [string, string][] = [
  ['#F2B03D', 'ambra'], ['#E1523D', 'granata'], ['#3E7BD6', 'cobalto'],
  ['#2AA79B', 'petrolio'], ['#8DBF3F', 'oliva'], ['#C77DD8', 'prugna'],
  ['#E68A4E', 'rame'], ['#4FC0E8', 'ghiaccio'], ['#D94F8A', 'ciclamino'],
  ['#9AA6AD', 'grafite'],
]

/* I poli della correzione sono il bianco e il nero PURI: mescolare con
   quelli scala di pari passo massimo e minimo di ogni canale, e la
   tonalità resta esatta. Mescolando con l'inchiostro scuro dei token
   (#131A20, che è appena azzurrato) la tinta deriverebbe — oliva
   perdeva 2,6 gradi scendendo sul bianco. */
const POLO_CHIARO = '#FFFFFF', POLO_SCURO = '#000000'
/* Gli inchiostri veri, quelli che finiscono scritti nel token. */
const INK_CHIARO = '#FFFFFF', INK_SCURO = '#131A20'

/* ---------- colore, funzioni di base ---------- */

const versoRgb = (h: string): [number, number, number] => {
  const s = h.replace('#', '')
  const p = s.length === 3 ? [0, 1, 2].map(i => s[i] + s[i]) : [0, 2, 4].map(i => s.slice(i, i + 2))
  return p.map(x => parseInt(x, 16)) as [number, number, number]
}

const versoHex = (rgb: number[]) =>
  '#' + rgb.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')

export function luminosita(hex: string) {
  const c = versoRgb(hex).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4) })
  return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]
}

export function contrasto(a: string, b: string) {
  const l1 = luminosita(a), l2 = luminosita(b)
  return (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05)
}

function mescola(hex: string, verso: string, quanto: number) {
  const a = versoRgb(hex), b = versoRgb(verso)
  return versoHex(a.map((v, i) => v + (b[i] - v) * quanto))
}

export function tonalita(hex: string) {
  const [r, g, b] = versoRgb(hex).map(v => v / 255)
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  if (!d) return 0
  const x = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return (x * 60 + 360) % 360
}

export function saturazione(hex: string) {
  const [r, g, b] = versoRgb(hex).map(v => v / 255)
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  return max ? (max - min) / max : 0
}

const distanzaTonale = (a: number, b: number) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d }

/**
 * Due tinte si confondono? La sola tonalità non basta: un grigio ha
 * tonalità 0, che non vuol dire "rosso" — vuol dire "non ha tonalità".
 * Senza questo controllo #888888 veniva accusato di somigliare al rosso
 * dei cali, e "grafite" di rubare il posto a "cobalto".
 */
function siConfondono(a: string, b: string, gradi: number) {
  const sa = saturazione(a) >= SATURAZIONE_MINIMA, sb = saturazione(b) >= SATURAZIONE_MINIMA
  if (!sa || !sb) return !sa && !sb          // due grigi sì, un grigio e un colore no
  return distanzaTonale(tonalita(a), tonalita(b)) < gradi
}

/* ---------- correzione ---------- */

/** vero se sul fondo dato si legge meglio l'inchiostro scuro */
export const fondoChiaro = (fondo: string) => contrasto(fondo, POLO_SCURO) > contrasto(fondo, POLO_CHIARO)

/**
 * Porta la tinta al contrasto minimo sul fondo dato, senza cambiarne la
 * tonalità: la schiarisce sui fondi scuri, la scurisce sui chiari.
 *
 * Il verso si decide dal fondo, non dal tema dichiarato. Deducendolo
 * dall'attributo, alla prima apertura su un sistema in tema chiaro (dove
 * data-tema non c'è ancora ma i token sono già quelli del giorno) la
 * tinta veniva schiarita sul bianco: ambra finiva a #f9e6c2, contrasto
 * 1,23, illeggibile proprio all'apertura.
 */
export function correggi(hex: string, fondoPannello: string) {
  const verso = fondoChiaro(fondoPannello) ? POLO_SCURO : POLO_CHIARO
  let usata = hex, giri = 0
  while (contrasto(usata, fondoPannello) < CONTRASTO_MINIMO && giri < GIRI_MAX) {
    usata = mescola(usata, verso, PASSO)
    giri++
  }
  return { usata, corretta: giri > 0 }
}

/** Bianco o nero sopra la tinta, quello dei due che si legge meglio. */
export const inchiostroSopra = (tinta: string) =>
  contrasto(tinta, INK_CHIARO) >= contrasto(tinta, INK_SCURO) ? INK_CHIARO : INK_SCURO

/** Il velo resta trasparente: cotto sul fondo del pannello sarebbe una
    toppa sbagliata ovunque il velo finisca su un'altra superficie. */
export function velo(tinta: string, alfa = .12) {
  const [r, g, b] = versoRgb(tinta)
  return `rgba(${r},${g},${b},${alfa})`
}

/* ---------- controlli ---------- */

export interface Avviso { cosa: 'rosso' | 'verde' | 'lega'; titolo: string; dettaglio: string }
export interface ColoriDirezione { su: string; giu: string }

const DIREZIONE_PREDEFINITA: ColoriDirezione = { su: '#5FD09B', giu: '#F0685C' }

/**
 * Avvisi, non divieti: la scelta resta dell'utente.
 * tinteInLega = tinte già prese dagli altri partecipanti.
 */
export function controlla(tinta: string, { tinteInLega = [], colori = DIREZIONE_PREDEFINITA }: {
  tinteInLega?: string[]; colori?: ColoriDirezione
} = {}): Avviso[] {
  const avvisi: Avviso[] = []

  if (siConfondono(tinta, colori.giu, VICINANZA_TINTA)) {
    avvisi.push({
      cosa: 'rosso',
      titolo: 'Sta vicino al rosso dei cali',
      dettaglio: 'Un numero che scende e un pulsante avrebbero la stessa tinta.',
    })
  }
  if (siConfondono(tinta, colori.su, VICINANZA_TINTA)) {
    avvisi.push({
      cosa: 'verde',
      titolo: 'Sta vicino al verde delle salite',
      dettaglio: 'Qui il verde vuol dire "sale", non "la tua squadra".',
    })
  }
  if (tinteInLega.some(t => siConfondono(t, tinta, VICINANZA_LEGA))) {
    avvisi.push({
      cosa: 'lega',
      titolo: 'Un\'altra squadra ha già questa tinta',
      dettaglio: 'Nel log d\'asta e nelle rose vi confondereste.',
    })
  }
  return avvisi
}

/* ---------- applicazione ---------- */

export interface EsitoColore {
  scelta: string
  usata: string
  corretta: boolean          // vera se la tinta è stata schiarita o scurita
  contrasto: number
  avvisi: Avviso[]
}

/**
 * Unico punto d'ingresso. Legge il fondo dal documento, scrive i tre
 * token sul :root e restituisce cosa ha fatto, così l'interfaccia può
 * mostrare il contrasto ottenuto e gli eventuali avvisi.
 */
export function applicaColoreSquadra(hex: string, { tinteInLega = [], radice = document.documentElement }: {
  tinteInLega?: string[]; radice?: HTMLElement
} = {}): EsitoColore {
  const stile = getComputedStyle(radice)
  const leggi = (n: string, se: string) => stile.getPropertyValue(n).trim() || se
  /* Se i token non sono ancora leggibili si chiede al sistema invece di
     tirare a indovinare: sbagliare il verso qui vuol dire schiarire la
     tinta su un fondo bianco, cioè cancellarla. */
  const scuroDiSistema = typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches
  const fondo = leggi('--fr-pan', leggi('--fr-fondo', scuroDiSistema ? '#1A232B' : '#FFFFFF'))

  const { usata, corretta } = correggi(hex, fondo)

  radice.style.setProperty('--fr-marchio', usata)
  radice.style.setProperty('--fr-marchio-ink', inchiostroSopra(usata))
  radice.style.setProperty('--fr-marchio-velo', velo(usata))

  return {
    scelta: hex,
    usata,
    corretta,
    contrasto: contrasto(usata, fondo),
    avvisi: controlla(usata, {
      tinteInLega,
      colori: { su: leggi('--fr-su', DIREZIONE_PREDEFINITA.su), giu: leggi('--fr-giu', DIREZIONE_PREDEFINITA.giu) },
    }),
  }
}

/**
 * Propone una tinta ancora libera, per i nuovi partecipanti. Passa dagli
 * stessi controlli di controlla(): proporre una tinta che l'app poi
 * contesta è il modo più veloce di far perdere fiducia agli avvisi.
 */
export function tintaLibera(tinteInLega: string[] = [], colori: ColoriDirezione = DIREZIONE_PREDEFINITA) {
  const pulita = TINTE_PRONTE.find(([hex]) => !controlla(hex, { tinteInLega, colori }).length)
  if (pulita) return pulita[0]
  // tutte contestabili: almeno che non sia già di qualcun altro
  const libera = TINTE_PRONTE.find(([hex]) => !tinteInLega.some(t => siConfondono(t, hex, VICINANZA_LEGA)))
  return (libera ?? TINTE_PRONTE[0])[0]
}

/* ---------- la tinta attiva ---------- */

export const TINTA_PREDEFINITA = TINTE_PRONTE[0][0]
let tintaAttiva = TINTA_PREDEFINITA

/**
 * La tinta di chi guarda, ricordata. A ogni cambio di tema la correzione
 * va rifatta sul fondo nuovo, e va rifatta con QUESTA tinta: senza memoria
 * main.tsx riapplicava l'ambra predefinita, e il sistema che passava al
 * chiaro cancellava il colore della squadra.
 */
export function usaTinta(hex: string | null | undefined, opzioni?: { tinteInLega?: string[]; radice?: HTMLElement }) {
  tintaAttiva = hex || TINTA_PREDEFINITA
  return applicaColoreSquadra(tintaAttiva, opzioni)
}
export const riapplicaTinta = () => applicaColoreSquadra(tintaAttiva)
export const tintaInUso = () => tintaAttiva

/* ---------- chi sceglie ---------- */

export interface StatoScelta {
  tinteInLega: string[]          // le tinte delle altre squadre
  avvisi: Avviso[]               // sulla tinta della propria squadra
  proposta: string | null        // un'alternativa, solo se qualcosa non va
  prese: Map<string, string>     // tinta pronta → nome della squadra che ne ha una che si confonde
}

/**
 * Cosa mostrare a chi sceglie il colore della propria squadra. Gli avvisi
 * sono consigli: la tinta scelta resta salvata, e la proposta passa dagli
 * stessi controlli (è tintaLibera).
 */
export function statoScelta(
  squadre: { id: number; nome: string; colore: string | null }[],
  mia: number | null,
  colori?: ColoriDirezione,
): StatoScelta {
  const altre = squadre.filter(s => s.id !== mia && s.colore) as { id: number; nome: string; colore: string }[]
  const tinteInLega = altre.map(s => s.colore)
  const propria = mia === null ? null : squadre.find(s => s.id === mia)?.colore ?? null
  const avvisi = propria ? controlla(propria, { tinteInLega, colori }) : []
  const prese = new Map<string, string>()
  for (const [hex] of TINTE_PRONTE) {
    const di = altre.find(s => siConfondono(s.colore, hex, VICINANZA_LEGA))
    if (di) prese.set(hex, di.nome)
  }
  return { tinteInLega, avvisi, proposta: avvisi.length ? tintaLibera(tinteInLega, colori) : null, prese }
}
