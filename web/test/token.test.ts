/* I token non sono codice, quindi nessun test li guarda — ed è così che
   una scala finisce al contrario, o su un canale già occupato, senza che
   nessuno se ne accorga. Questo file legge fantaregia-tokens.css e
   verifica le proprietà che le decisioni di design promettono. */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { contrasto, saturazione, tonalita } from '../src/viste/colore-squadra.ts'

const CSS = readFileSync(fileURLToPath(new URL('../src/viste/fantaregia-tokens.css', import.meta.url)), 'utf8')

const SEZIONI = [
  { nome: 'notte', da: 'TEMA NOTTE', pan: '#1A232B', schermo: true },
  { nome: 'giorno', da: 'TEMA GIORNO', pan: '#FFFFFF', schermo: true },
  { nome: 'sistema chiaro', da: 'prefers-color-scheme: light', pan: '#FFFFFF', schermo: true },
  { nome: 'stampa', da: '@media print', pan: '#FFFFFF', schermo: false },
]
const schermo = SEZIONI.filter(s => s.schermo)
const distanza = (a: number, b: number) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d }

function rampa(sezione: typeof SEZIONI[number]) {
  const i = CSS.indexOf(sezione.da)
  expect(i, `sezione «${sezione.da}» non trovata`).toBeGreaterThan(-1)
  const fine = SEZIONI.map(s => CSS.indexOf(s.da)).filter(x => x > i).sort((a, b) => a - b)[0] ?? CSS.length
  const pezzo = CSS.slice(i, fine)
  const prendi = (suffisso: string) => [1, 2, 3, 4, 5].map(n => {
    const m = new RegExp(`--fr-diff-${n}${suffisso}\\s*:\\s*(#[0-9A-Fa-f]{6})`).exec(pezzo)
    expect(m, `--fr-diff-${n}${suffisso} manca in «${sezione.nome}»`).not.toBeNull()
    return m![1]
  })
  return { fondi: prendi(''), inchiostri: prendi('-ink') }
}

describe('scala delle difficoltà', () => {
  it('il verso è quello di fixDiff(): 1 morbidissima, 5 durissima', () => {
    /* fixDiff() restituisce 1 per la partita più facile e 5 per la più
       dura, e quel numero finisce dritto nel nome della classe. Sullo
       schermo il verso si legge nella tonalità — d1 sta nel verde, d5 nel
       rosso; il neutro è al centro perché fixDiff() è centrato su 3, cioè
       sull'avversario medio. */
    for (const s of schermo) {
      const t = rampa(s).fondi.map(tonalita)
      expect(distanza(t[0], 150), `${s.nome}: d1 deve stare nel verde`).toBeLessThan(45)
      expect(distanza(t[4], 5), `${s.nome}: d5 deve stare nel rosso`).toBeLessThan(35)
      expect(distanza(t[0], t[4]), `${s.nome}: i due poli devono essere opposti`).toBeGreaterThan(90)
    }
  })

  it('il centro è neutro: l\'avversario medio non tira da nessuna parte', () => {
    for (const s of schermo) {
      const sat = rampa(s).fondi.map(saturazione)
      expect(sat.indexOf(Math.min(...sat)), `${s.nome}: il meno saturo deve essere d3`).toBe(2)
    }
  })

  it('la trasferta non sbiadisce la casella', () => {
    /* Nell'originale .fix.away aveva opacity:.78, che sbiadisce anche
       l'inchiostro: 3,3:1 nel giorno, 4,4:1 su d3 nel notte. Il contrasto
       misurato qui sotto vale solo se nessuno lo abbassa dopo. La
       trasferta si distingue col minuscolo, che resta obbligatorio. */
    const legacy = readFileSync(fileURLToPath(new URL('../src/viste/legacy.css', import.meta.url)), 'utf8')
    const regola = /\.fix\.away\s*\{([^}]*)\}/.exec(legacy)
    expect(regola, '.fix.away manca in legacy.css').not.toBeNull()
    expect(regola![1]).not.toMatch(/opacity/)
    expect(regola![1]).toMatch(/text-transform\s*:\s*lowercase/)
  })

  it('la tonalità porta il segnale, non l\'intensità', () => {
    /* Il difetto della prima stesura: una rampa a tinta unica metteva la
       difficoltà sull'intensità, e su un chip da 32px con del testo
       sopra non si distingueva più niente — tanto meno con la trasferta
       che allora sbiadiva i chip. Qui si pretende che due caselle vicine
       si stacchino per tonalità, non per quanto sono cariche. */
    for (const s of schermo) {
      const t = rampa(s).fondi.map(tonalita)
      for (let i = 1; i < 5; i++) {
        expect(distanza(t[i], t[i - 1]), `${s.nome}: d${i} e d${i + 1}`).toBeGreaterThanOrEqual(12)
      }
    }
  })

  it('in stampa, dove il colore non c\'è, resta il peso', () => {
    // su carta la tonalità sparisce: il verso lo porta il grigio, dal chiaro al scuro
    const c = rampa(SEZIONI[3]).fondi.map(f => contrasto(f, '#FFFFFF'))
    for (let i = 1; i < 5; i++) expect(c[i], `stampa: d${i + 1} deve pesare più di d${i}`).toBeGreaterThan(c[i - 1])
  })

  it('l\'inchiostro dentro la casella si legge', () => {
    for (const s of SEZIONI) {
      const { fondi, inchiostri } = rampa(s)
      fondi.forEach((f, i) => {
        expect(contrasto(f, inchiostri[i]), `${s.nome}: testo su diff-${i + 1}`).toBeGreaterThanOrEqual(4.5)
      })
    }
  })

  it('nessuna casella usa i valori dei delta', () => {
    /* Verde e rosso qui sono legittimi — una partita più facile della
       media è uno scostamento da un riferimento — ma il registro deve
       restare diverso: queste sono velature con inchiostro sopra, non
       cifre nude. Riusare lo stesso hex è il modo per confonderli, ed è
       quello che faceva la scala di partenza, dove la casella del
       calendario morbido era identica a --fr-su. */
    const delta = ['#5FD09B', '#F0685C', '#1C7C4A', '#C2362B']
    for (const s of SEZIONI) {
      const { fondi, inchiostri } = rampa(s)
      for (const v of [...fondi, ...inchiostri]) {
        expect(delta, `${s.nome}: ${v} è un valore dei delta`).not.toContain(v.toUpperCase())
      }
    }
  })
})

describe('le spie senza riferimento', () => {
  it('il vecchio --warn si legge come testo in tutti e due i temi', () => {
    /* Con lo strato di alias --warn era finito su --fr-fermo: 2,67:1 come
       testo nel giorno, sotto perfino i 3:1 che bastano a un pallino. Una
       spia si distingue con la forma — tratteggio, peso, cerchio vuoto —
       ma quello che c'è scritto deve comunque leggersi. */
    const alias = readFileSync(fileURLToPath(new URL('../src/index.css', import.meta.url)), 'utf8')
    const m = /--warn\s*:\s*var\((--fr-[a-z-]+)\)/.exec(alias)
    expect(m, '--warn deve essere un alias su un token').not.toBeNull()
    for (const s of schermo) {
      const valore = new RegExp(`${m![1]}\\s*:\\s*(#[0-9A-Fa-f]{6})`).exec(CSS.slice(CSS.indexOf(s.da)))
      expect(valore, `${m![1]} manca in «${s.nome}»`).not.toBeNull()
      expect(contrasto(valore![1], s.pan), `${s.nome}: --warn sul pannello`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('il delta «fermo» si legge: è testo, non un pallino', () => {
    /* Seconda volta che --fr-fermo finiva a fare da colore del testo: dopo
       le spie, il delta fermo — un «=» o un «+2» a 2,67:1 sul bianco. */
    const m = /\.fr-delta\[data-verso="fermo"\]\s*\{\s*color\s*:\s*var\((--fr-[a-z-]+)\)/.exec(CSS)
    expect(m, 'regola del delta fermo non trovata').not.toBeNull()
    for (const s of schermo) {
      const valore = new RegExp(`${m![1]}\\s*:\\s*(#[0-9A-Fa-f]{6})`).exec(CSS.slice(CSS.indexOf(s.da)))
      expect(valore, `${m![1]} manca in «${s.nome}»`).not.toBeNull()
      expect(contrasto(valore![1], s.pan), `${s.nome}: delta fermo sul pannello`).toBeGreaterThanOrEqual(4.5)
    }
  })
})
