/* Anteprime delle viste vere, per guardarle senza account né database.
   Non è un controllo: parte solo con ANTEPRIME=<cartella>, e scrive lì un file
   HTML per vista, resa con react-dom/server sulla lega sintetica e agganciata
   al CSS compilato da `npm run build` (dist/assets) — quindi prima si
   costruisce. Il tema si sceglie con l'ancora: vista.html#giorno.

   Per il telefono scrive anche <vista>-telefono.html, dentro il guscio vero
   come sotto i 900px, e telefono.html, che le mette tutte in iframe da 390px.
   Chromium headless non impagina sotto i 500px (ritaglia, e un ritaglio
   sembra un difetto di layout): l'iframe è il modo di avere 390 davvero.
   telefono.html misura anche, dentro ogni iframe, le tre regole del
   telefono — nessuno scorrimento orizzontale, nessun bersaglio sotto i 44px,
   nessun campo sotto i 16px — e scrive l'esito in <pre id="misure">.
   Per leggerlo senza aprire il browser:
     chrome --headless=new --allow-file-access-from-files --virtual-time-budget=8000 --dump-dom telefono.html */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createElement, type ReactElement } from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, it } from 'vitest'
import Asta from '../src/pagine/Asta.tsx'
import Calendario from '../src/pagine/Calendario.tsx'
import Formazioni from '../src/pagine/Formazioni.tsx'
import Infermeria from '../src/pagine/Infermeria.tsx'
import Listone from '../src/pagine/Listone.tsx'
import Mercato from '../src/pagine/Mercato.tsx'
import Rendimento from '../src/pagine/Rendimento.tsx'
import Rose from '../src/pagine/Rose.tsx'
import Scontri from '../src/pagine/Scontri.tsx'
import Titolari from '../src/pagine/Titolari.tsx'
import SquadreLega from '../src/pagine/SquadreLega.tsx'
import Guscio from '../src/viste/Guscio.tsx'
import { creaMotore, type Motore } from '../src/domain/motore.ts'
import { calendarioDaRighe, parseCSV, righeInGiocatori } from '../src/domain/importa.ts'
import { completa, costruisciLega } from './lega-sintetica.ts'
import type { RigheLega } from '../src/data/componi.ts'
import type { StatoLega } from '../src/domain/tipi.ts'

const USCITA = process.env.ANTEPRIME
const WEB = fileURLToPath(new URL('../', import.meta.url)).replace(/\\/g, '/')
const ESEMPI = fileURLToPath(new URL('../../esempi/', import.meta.url))

const testa = (css: string, titolo: string) => `<meta charset="utf-8"><title>${titolo}</title>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow:wght@300;400;500;600;700;800&family=Barlow+Condensed:wght@400;500;600;700&display=swap">
<link rel="stylesheet" href="file:///${WEB}dist/assets/${css}">
<script>document.documentElement.dataset.tema = (location.hash.slice(1) || 'notte')</script>`

const pagina = (corpo: string, css: string, titolo: string) => `<!doctype html>
<html lang="it"><head>${testa(css, titolo)}</head><body><main class="mx-auto max-w-[1280px] px-5 py-6">${corpo}</main></body></html>`

// come App.tsx dentro il guscio: il main senza margini, il guscio li mette da sé
const paginaTelefono = (corpo: string, css: string, titolo: string) => `<!doctype html>
<html lang="it"><head>${testa(css, titolo)}</head><body><div class="min-h-screen"><main>${corpo}</main></div></body></html>`

/* Le tre regole, misurate dentro ogni iframe. Un bersaglio è quello che si
   tocca: pulsanti, link, campi, e i role="button" (i dischi del campo). Si
   contano solo quelli visibili; per i dischi SVG conta il riquadro. */
const MISURA = `<script>
addEventListener('load', () => setTimeout(() => {
  const esiti = []
  for (const f of document.querySelectorAll('iframe')) {
    const d = f.contentDocument, w = f.contentWindow
    const largo = d.documentElement.scrollWidth
    const bersagli = [...d.querySelectorAll('button, a[href], select, input:not([type=checkbox]):not([type=radio]):not([type=file]), [role=button], summary, label:has(> input[type=checkbox])')]
      .filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && w.getComputedStyle(e).visibility !== 'hidden' })
    const bassi = bersagli.filter(e => e.getBoundingClientRect().height < 44 && !e.closest('svg'))
    const campi = [...d.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=file]), select, textarea')]
      .filter(e => e.getBoundingClientRect().height > 0 && parseFloat(w.getComputedStyle(e).fontSize) < 16)
    const descrivi = e => (e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\\s+/).slice(0, 3).join('.') : '') + ' «' + (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 24) + '» ' + Math.round(e.getBoundingClientRect().height) + 'px')
    const conta = a => Object.entries(a.map(descrivi).reduce((o, x) => (o[x] = (o[x] || 0) + 1, o), {})).map(([k, n]) => (n > 1 ? n + '× ' : '') + k)
    // anche dentro: un contenitore che scorre di lato è una tabella che non ci sta
    const dentro = [...d.querySelectorAll('*')].filter(e => e.scrollWidth > e.clientWidth + 1 && /auto|scroll/.test(w.getComputedStyle(e).overflowX) && e.getBoundingClientRect().height > 0)
    esiti.push({ vista: f.dataset.vista, scorreDiLato: largo > 390 ? largo + 'px' : false, scorreDentro: conta(dentro), bersagliSotto44: conta(bassi), campiSotto16: conta(campi) })
  }
  document.getElementById('misure').textContent = JSON.stringify(esiti, null, 1)
}, 1500))
</script>`

describe.skipIf(!USCITA)('anteprime delle viste', () => {
  it('scrive un file HTML per vista', () => {
    const players = righeInGiocatori(parseCSV(readFileSync(ESEMPI + 'listone-esempio.csv', 'utf8')))
    const cal = calendarioDaRighe(parseCSV(readFileSync(ESEMPI + 'calendario-esempio.csv', 'utf8')))
    const { rig, hist, shared } = costruisciLega(players, cal)
    const stato = completa(shared, players) as StatoLega
    const m = creaMotore({ players, cal, rig, hist, stato, me: { myTeam: 3 } })
    const fatti = new Map<number, Motore>()
    const motorePrima = (g: number) => {
      if (!fatti.has(g)) {
        const stats = Object.fromEntries(Object.entries(stato.stats).filter(([k]) => Number(k) < g))
        fatti.set(g, creaMotore({ players, cal, rig, hist, stato: { ...stato, stats }, me: { myTeam: 3 } }))
      }
      return fatti.get(g)!
    }
    const g = m.giornataOggi()
    const preferenze = (formazioni: Record<string, unknown>) =>
      ({ squadre: [], preferenze: { mia_squadra: 3, obiettivi: {}, formazioni } }) as unknown as RigheLega
    const base = { legaId: 'l1', utenteId: 'u1', ricarica: () => {}, puoScrivere: true }

    // telefono: le viste che hanno un disegno loro lo ricevono, le altre sono le stesse
    const viste = (telefono: boolean): Record<string, ReactElement> => ({
      asta: createElement(Asta, { ...base, motore: m }),
      listone: createElement(Listone, { ...base, righe: preferenze({}), motore: m, telefono }),
      rose: createElement(Rose, { ...base, motore: m }),
      formazioni: createElement(Formazioni, {
        legaId: 'l1', utenteId: 'u1', motore: m, motorePrima, telefono,
        righe: preferenze({ [g]: m.formazioneAutomatica(g, '3-4-3') }),
      }),
      lega: createElement(Scontri, { ...base, motore: m, motorePrima, telefono }),
      rendimento: createElement(Rendimento, { motore: m }),
      titolari: createElement(Titolari, { motore: m }),
      calendario: createElement(Calendario, { motore: m }),
      infermeria: createElement(Infermeria, { ...base, motore: m }),
      mercato: createElement(Mercato, { ...base, motore: m }),
      squadre: createElement(SquadreLega, {
        motore: m, righe: { squadre: [], allenatoreMancante: false } as unknown as RigheLega, mia: 3, utenteId: 'u1',
        membri: [{ utente_id: 'u1', nome: 'Francesco' }], puoAssegnare: true, onAllenatore: () => {}, telefono,
      }),
    })
    const percorso: Record<string, string> = { lega: 'scontri', squadre: '' }

    const css = readdirSync(WEB + 'dist/assets').find(f => f.endsWith('.css'))
    if (!css) throw new Error('manca il CSS compilato: prima `npm run build`')
    mkdirSync(USCITA!, { recursive: true })
    for (const [nome, vista] of Object.entries(viste(false))) {
      writeFileSync(`${USCITA}/${nome}.html`, pagina(renderToString(createElement(MemoryRouter, null, vista)), css, nome))
    }
    const telefono = Object.entries(viste(true))
    for (const [nome, vista] of telefono) {
      const via = `/lega/l1${(percorso[nome] ?? nome) ? '/' + (percorso[nome] ?? nome) : ''}`
      const guscio = createElement(Guscio, {
        legaId: 'l1', nomeLega: 'Lega dei Sabati', squadra: { nome: 'Regia FC', colore: null },
        modo: 'stagione', onModo: () => {}, email: 'prova@esempio.it', onEsci: () => {}, children: vista,
      })
      writeFileSync(`${USCITA}/${nome}-telefono.html`,
        paginaTelefono(renderToString(createElement(MemoryRouter, { initialEntries: [via] }, guscio)), css, `${nome} · telefono`))
    }
    writeFileSync(`${USCITA}/telefono.html`, `<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Telefono · 390px</title>
<style>body{margin:0;padding:16px;background:#0A0D10;color:#ECF2F6;font:13px system-ui}.fila{display:flex;flex-wrap:wrap;gap:16px}
figure{margin:0}figcaption{margin-bottom:6px}iframe{width:390px;height:844px;border:1px solid #2A3742;background:#131A20}pre{white-space:pre-wrap}</style>
</head><body><pre id="misure">misuro…</pre><div class="fila">
${telefono.map(([nome]) => `<figure><figcaption>${nome}</figcaption><iframe data-vista="${nome}" src="${nome}-telefono.html"></iframe></figure>`).join('\n')}
</div>${MISURA}</body></html>`)
  })
})
