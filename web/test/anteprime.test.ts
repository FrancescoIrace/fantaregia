/* Anteprime delle viste vere, per guardarle senza account né database.
   Non è un controllo: parte solo con ANTEPRIME=<cartella>, e scrive lì un file
   HTML per vista, resa con react-dom/server sulla lega sintetica e agganciata
   al CSS compilato da `npm run build` (dist/assets) — quindi prima si
   costruisce. Il tema si sceglie con l'ancora: vista.html#giorno.
   Per la larghezza del telefono si guardano dentro un iframe da 390px:
   Chromium headless non impagina sotto i 484px, e ritaglia. */
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
import { creaMotore, type Motore } from '../src/domain/motore.ts'
import { calendarioDaRighe, parseCSV, righeInGiocatori } from '../src/domain/importa.ts'
import { completa, costruisciLega } from './lega-sintetica.ts'
import type { RigheLega } from '../src/data/componi.ts'
import type { StatoLega } from '../src/domain/tipi.ts'

const USCITA = process.env.ANTEPRIME
const WEB = fileURLToPath(new URL('../', import.meta.url)).replace(/\\/g, '/')
const ESEMPI = fileURLToPath(new URL('../../esempi/', import.meta.url))

const pagina = (corpo: string, css: string, titolo: string) => `<!doctype html>
<html lang="it"><head><meta charset="utf-8"><title>${titolo}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow:wght@300;400;500;600;700;800&family=Barlow+Condensed:wght@400;500;600;700&display=swap">
<link rel="stylesheet" href="file:///${WEB}dist/assets/${css}">
<script>document.documentElement.dataset.tema = (location.hash.slice(1) || 'notte')</script>
</head><body><main class="mx-auto max-w-[1280px] px-5 py-6">${corpo}</main></body></html>`

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
      ({ preferenze: { mia_squadra: 3, obiettivi: {}, formazioni } }) as unknown as RigheLega
    const base = { legaId: 'l1', utenteId: 'u1', ricarica: () => {}, puoScrivere: true }

    const viste: Record<string, ReactElement> = {
      asta: createElement(Asta, { ...base, motore: m }),
      listone: createElement(Listone, { ...base, righe: preferenze({}), motore: m }),
      rose: createElement(Rose, { ...base, motore: m }),
      formazioni: createElement(Formazioni, {
        legaId: 'l1', utenteId: 'u1', motore: m, motorePrima,
        righe: preferenze({ [g]: m.formazioneAutomatica(g, '3-4-3') }),
      }),
      lega: createElement(Scontri, { ...base, motore: m, motorePrima }),
      rendimento: createElement(Rendimento, { motore: m }),
      titolari: createElement(Titolari, { motore: m }),
      calendario: createElement(Calendario, { motore: m }),
      infermeria: createElement(Infermeria, { ...base, motore: m }),
      mercato: createElement(Mercato, { ...base, motore: m }),
    }

    const css = readdirSync(WEB + 'dist/assets').find(f => f.endsWith('.css'))
    if (!css) throw new Error('manca il CSS compilato: prima `npm run build`')
    mkdirSync(USCITA!, { recursive: true })
    for (const [nome, vista] of Object.entries(viste)) {
      writeFileSync(`${USCITA}/${nome}.html`, pagina(renderToString(createElement(MemoryRouter, null, vista)), css, nome))
    }
  })
})
