/* ══ L'app a file singolo, dentro jsdom ═══════════════════════════════
   Assembla src/part1..6.html come fa build.sh, con i dati che le diamo noi,
   e la avvia in jsdom. Poi ne espone le funzioni del motore attraverso il
   gancio window.__fa che l'app ha già per i test automatici.

   È il termine di paragone del port: il motore TypeScript deve dare gli
   stessi numeri di questo, sugli stessi dati. Nessun dato reale passa di
   qui — i test usano solo esempi/ (giocatori inventati) e stati sintetici. */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { JSDOM, VirtualConsole } from 'jsdom'

const SRC = fileURLToPath(new URL('../../src/', import.meta.url))
const parte = (n: number) => readFileSync(`${SRC}part${n}.html`, 'utf8')

/* le funzioni che il gancio originale non espone già */
const ESPORTA = [
  'attesa', 'attesaOra', 'prices', 'mercato', 'dealTag', 'titW', 'titStato', 'titFatti', 'titPrior',
  'annoScorso', 'medieRuolo', 'rangoFm', 'appet', 'appetParts', 'mentLabel', 'calScore', 'fixDiff',
  'fixtures', 'forze', 'golDaiVoti', 'statFor', 'formaOf', 'fasciaPrezzo', 'scarsita', 'alternative',
  'attesaSnap', 'undiciTipo', 'mediaLega', 'giudizio', 'giudizi', 'legaAvv', 'legaPartite',
  'attesoGiocatore', 'scontro', 'pericolosi', 'legaIncroci', 'risultati', 'classificaSerieA',
  'pesoRisultati', 'giornataOggi', 'legaOggi', 'esitoDi', 'classificaLega', 'verifica',
  'sintesiVerifica', 'dayParts', 'dayScore', 'dayWhy', 'indiceNomi', 'meId', 'infoOut',
  'autoFill', 'lineup', 'movimentiProposti',
]

const jsonSafe = (o: unknown) => JSON.stringify(o).replace(/</g, '\\u003c')

export interface DatiLegacy {
  players: unknown[]
  cal: unknown
  rig: unknown
  hist: unknown
  shared: unknown
  me?: unknown
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Legacy = Record<string, any>

export async function avviaLegacy(d: DatiLegacy) {
  const p4 = parte(4).slice('<script id="fa-app">'.length).trimEnd().slice(0, -'</script>'.length)
  let p6 = parte(6)
  const fine = p6.lastIndexOf('})();')
  p6 = p6.slice(0, fine) + `Object.assign(window.__fa,{${ESPORTA.join(',')}});\n` + p6.slice(fine)

  const meta = { name: 'Listone di prova', when: null, count: d.players.length }
  const blocco = '<script id="fa-data">window.PLAYERS=' + jsonSafe(d.players)
    + ';window.CAL=' + jsonSafe(d.cal) + ';window.RIG=' + jsonSafe(d.rig) + ';window.HIST=' + jsonSafe(d.hist)
    + ';window.SHARED=' + jsonSafe(d.shared) + ';window.LISTMETA=' + jsonSafe(meta) + ';</script>'
  const corpo = parte(1) + parte(2) + parte(3) + '\n' + blocco + '\n' + '<script id="fa-app">' + p4 + parte(5) + p6
  const html = '<!doctype html>\n<html lang="it">\n<head>\n<meta charset="utf-8">\n</head>\n<body>\n' + corpo + '\n</body>\n</html>\n'

  const errori: string[] = []
  const vc = new VirtualConsole()
  vc.on('jsdomError', e => errori.push(e.message))
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'http://localhost/',
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(win) {
      win.localStorage.setItem('fanta-asta-2627-mio', JSON.stringify(d.me ?? { myTeam: null, targets: {} }))
    },
  })
  // initStore() è asincrona: lo stato definitivo arriva dopo il suo await
  await new Promise(r => setTimeout(r, 0))
  const doc = dom.window.document
  const fa = (dom.window as unknown as { __fa: Legacy }).__fa
  return {
    fa,
    errori,
    /** la finestra di giornate che nell'app si sceglie dall'interfaccia */
    finestra(from: number, span: number) {
      ;(doc.getElementById('gfrom') as HTMLInputElement).value = String(from)
      ;(doc.getElementById('gspan') as HTMLInputElement).value = String(span)
    },
    chiudi: () => dom.window.close(),
  }
}
