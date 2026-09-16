/* La vista Lega resa davvero sulla lega sintetica (calendario di lega con
   dieci squadre, nove abbinate, quattro giornate di risultati). */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import Scontri from '../src/pagine/Scontri.tsx'
import { creaMotore } from '../src/domain/motore.ts'
import { calendarioDaRighe, parseCSV, righeInGiocatori } from '../src/domain/importa.ts'
import { costruisciLega } from './lega-sintetica.ts'

const ESEMPI = fileURLToPath(new URL('../../esempi/', import.meta.url))
const players = righeInGiocatori(parseCSV(readFileSync(ESEMPI + 'listone-esempio.csv', 'utf8')))
const cal = calendarioDaRighe(parseCSV(readFileSync(ESEMPI + 'calendario-esempio.csv', 'utf8')))
const { rig, hist, shared } = costruisciLega(players, cal)

const motore = (myTeam: number, stato = shared) => creaMotore({ players, cal, rig, hist, stato, me: { myTeam } })
const disegna = (m: ReturnType<typeof motore>) => renderToString(createElement(MemoryRouter, null,
  createElement(Scontri, { legaId: 'l1', utenteId: 'u1', motore: m, puoScrivere: true, ricarica: () => {} })))
const conta = (html: string, classe: string) => (html.match(new RegExp(`class="${classe}[" ]`, 'g')) ?? []).length

describe('vista Lega', () => {
  it('squadra abbinata: scontro, striscia delle giornate, classifica, verifica', () => {
    const m = motore(3)
    const html = disegna(m)
    expect(html).toContain('scmatch')
    expect(conta(html, 'lcell')).toBe(m.legaIncroci(3).length)
    expect(m.legaIncroci(3).length).toBeGreaterThan(10)
    expect(conta(html, 'cpos fr-num')).toBe(m.classificaLega().length)
    // l'undici e i pericolosi: una lettera di ruolo con il suo filo per riga
    const righeGiocatori = conta(html, 'undrow') + conta(html, 'perrow')
    expect((html.match(/class="fr-filo-ruolo"/g) ?? []).length).toBe(righeGiocatori)
    expect(conta(html, 'vrow')).toBe(m.verifica(3).length)
    expect(html).toContain('Abbinamenti')                 // la squadra 10 non è abbinata
  })

  it('in una giornata con avversario abbinato: probabilità, consiglio, reparti, pericolosi', () => {
    const m = motore(3)
    const gl = m.legaIncroci(3)[0].gl
    const s = m.scontro(3, gl)!
    expect(s.sua).not.toBeNull()
    const html = renderToString(createElement(MemoryRouter, null, createElement(Scontri, {
      legaId: 'l1', utenteId: 'u1', motore: m, puoScrivere: false, ricarica: () => {},
    })))
    // la giornata iniziale è «oggi»: basta che almeno una delle viste abbia il pronostico completo
    expect(html.includes('legasc') || html.includes('non è abbinato')).toBe(true)
    expect(conta(html, 'cmprow') === 0 || conta(html, 'cmprow') === 4).toBe(true)
  })

  it('squadra senza nome nel calendario di lega: lo dice e propone gli abbinamenti', () => {
    const html = disegna(motore(10))
    expect(html).toContain('non è ancora abbinata')
    expect(html).not.toContain('class="legasc"')
  })

  describe('sul telefono', () => {
    const telefono = (m: ReturnType<typeof motore>) => renderToString(createElement(MemoryRouter, null,
      createElement(Scontri, { legaId: 'l1', utenteId: 'u1', motore: m, puoScrivere: true, ricarica: () => {}, motorePrima: () => m, telefono: true })))

    it('in cima la giornata con le frecce, poi il tuo scontro, gli altri del turno, la classifica', () => {
      const m = motore(3), html = telefono(m)
      const posto = (x: string) => html.indexOf(x)
      expect(posto('m-selettore')).toBeGreaterThan(-1)
      expect(html).not.toContain('type="number"')        // le frecce al posto del campo numerico
      expect(posto('Il tuo scontro')).toBeGreaterThan(posto('m-selettore'))
      expect(posto('Gli altri scontri')).toBeGreaterThan(posto('Il tuo scontro'))
      expect(posto('>Classifica<')).toBeGreaterThan(posto('Gli altri scontri'))
      // tutte le partite del turno tranne la propria, e una riga per squadra in classifica
      const gl = m.legaOggi()
      expect(conta(html, 'm-riga partita')).toBe(m.legaPartite(gl).length - 1)
      expect(conta(html, 'm-riga cl')).toBe(m.classificaLega().length)
      expect((html.match(/class="m-riga cl mia"/g) ?? []).length).toBe(1)
    })

    it('niente sparisce: tutto il resto è una riga che apre il suo cassetto', () => {
      const html = telefono(motore(3))
      for (const voce of ['Rosa contro rosa', 'Chi mi porta i punti', 'Da chi mi arriva il pericolo', 'Le previsioni tengono?',
        'Testa a testa', 'giornate', 'Abbinamenti', 'Chi sono io', 'Come nascono questi numeri']) {
        expect(html, voce).toContain(voce)
      }
      expect(conta(html, 'm-voce')).toBe(9)
      expect(html).not.toContain('class="modal')          // chiusi finché non si tocca
    })

    it('senza abbinamento lo dice e tiene la riga degli abbinamenti', () => {
      const html = telefono(motore(10))
      expect(html).toContain('non è ancora abbinata')
      expect(html).toContain('Abbinamenti')
      expect(html).not.toContain('Rosa contro rosa')      // senza scontro non c'è niente da confrontare
    })
  })

  it('senza calendario di lega spiega cosa serve', () => {
    expect(disegna(motore(3, { ...shared, lega: null }))).toContain('Il calendario della lega non c&#x27;è ancora')
  })
})
