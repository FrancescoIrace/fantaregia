/* Il file degli indisponibili dal lato della lega: la nota letta anche da un
   database senza la migrazione, la nota che arriva al motore, e la scheda in
   Infermeria con la sua anteprima. */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { leggiIndisponibili } from '../src/data/lega.ts'
import { componiStato, type RigaIndisponibile, type RigheLega } from '../src/data/componi.ts'
import Infermeria, { AnteprimaIndisponibili } from '../src/pagine/Infermeria.tsx'
import { creaMotore } from '../src/domain/motore.ts'
import { calendarioDaRighe, parseCSV, righeInGiocatori } from '../src/domain/importa.ts'
import { leggiFileIndisponibili, proponi } from '../src/domain/indisponibili.ts'
import { costruisciLega } from './lega-sintetica.ts'

const riga = { giocatore_id: 7, motivo: 'infortunio', da_giornata: 4, segnato_il: '2026-09-17T10:00:00Z' }

describe('leggiIndisponibili', () => {
  it('con la colonna della nota: una richiesta sola', async () => {
    const chieste: string[] = []
    const r = await leggiIndisponibili(async c => { chieste.push(c); return { data: [{ ...riga, nota: 'adduttore' }], error: null } })
    expect(r).toEqual({ indisponibili: [{ ...riga, nota: 'adduttore' }], notaMancante: false })
    expect(chieste).toEqual(['giocatore_id, motivo, da_giornata, segnato_il, nota'])
  })

  it('senza la migrazione: si rilegge senza nota e si segna cosa manca, invece di non aprire la lega', async () => {
    const r = await leggiIndisponibili(async c => c.includes('nota')
      ? { data: null, error: { code: '42703', message: 'column indisponibili.nota does not exist' } }
      : { data: [riga] as RigaIndisponibile[], error: null })
    expect(r).toEqual({ indisponibili: [riga], notaMancante: true })
  })

  it('un altro errore resta un errore', async () => {
    await expect(leggiIndisponibili(async () => ({ data: null, error: { code: '42501', message: 'permission denied' } })))
      .rejects.toThrow('permission denied')
  })
})

describe('la nota arriva al motore', () => {
  it('in S.out, accanto a motivo e giornata', () => {
    const righe = {
      lega: { id: 'l', nome: 'x', stagione: '2026/27', budget: 500, slots: { P: 3, D: 8, C: 8, A: 6 }, plan: { P: 7, D: 19, C: 32, A: 42 },
        squal_on: true, voti_meta: null, rose_meta: null, versione: 1, aggiornata_il: '' },
      squadre: [], assegnazioni: [], log: [], movimenti: [], squalificheAnnullate: [], voti: [], dataset: [], preferenze: null,
      indisponibili: [{ ...riga, nota: 'adduttore' }, { ...riga, giocatore_id: 8, nota: null }],
    } as unknown as RigheLega
    const out = componiStato(righe).out
    expect(out[7]).toMatchObject({ motivo: 'infortunio', da: 4, nota: 'adduttore' })
    expect(out[8]).not.toHaveProperty('nota')
  })
})

describe('Infermeria', () => {
  const ESEMPI = fileURLToPath(new URL('../../esempi/', import.meta.url))
  const players = righeInGiocatori(parseCSV(readFileSync(ESEMPI + 'listone-esempio.csv', 'utf8')))
  const cal = calendarioDaRighe(parseCSV(readFileSync(ESEMPI + 'calendario-esempio.csv', 'utf8')))
  const { rig, hist, shared } = costruisciLega(players, cal)
  const pid = Number(Object.keys(shared.out!)[0])
  const stato = { ...shared, out: { ...shared.out, [pid]: { motivo: 'squalifica', da: 3, ts: 1, nota: 'rosso diretto, tre giornate' } } }
  const m = creaMotore({ players, cal, rig, hist, stato, me: { myTeam: 3 } })
  const disegna = (puoScrivere: boolean) => renderToString(createElement(Infermeria, { legaId: 'l1', motore: m, puoScrivere, ricarica: () => {} }))

  it('la scheda per caricare il file c\'è per chi scrive; chi legge sa chi lo fa', () => {
    expect(disegna(true)).toContain('Carica un file di indisponibili')
    expect(disegna(true)).toContain('Scegli il file')
    expect(disegna(false)).toContain('Il file lo caricano admin e banditori.')
    expect(disegna(false)).not.toContain('Scegli il file')
  })

  it('in «Chi non puoi schierare» la nota sotto il nome, e il motivo col suo nome', () => {
    const html = disegna(true)
    expect(html).toContain('class="infnota" title="rosso diretto, tre giornate"')
    expect(html).toContain('squalificato')
  })

  it('l\'anteprima divide il file per quello che succederà, con Applica e il conto', () => {
    // due nomi senza omonimi nel listone d'esempio, così la prova non dipende da chi capita primo
    const unici = m.PL.filter(p => m.PL.filter(x => x.n === p.n).length === 1)
    const [a, b] = [unici[0], unici[1]]
    const nomeA = a.n, nomeB = b.n
    const voci = leggiFileIndisponibili(parseCSV([
      'nome;stato;nota', `${nomeA};infortunio;adduttore`, `${nomeB};rientrato;`, 'Nessuno Qui;infortunio;', `${nomeA};in dubbio;`,
    ].join('\n')))
    const pr = proponi(voci.slice(0, 3), m.PL, id => id === b.id ? { motivo: 'infortunio' } : null)
    const conStato = { ...pr, statiIgnoti: [voci[3]] }
    const html = renderToString(createElement(AnteprimaIndisponibili, {
      proposta: conStato, file: 'indisponibili.csv', notaMancante: true, invio: false, onScegli: () => {}, onApplica: () => {}, onAnnulla: () => {},
    }))
    expect(html).toContain('Entrano in infermeria')
    expect(html).toContain('adduttore')
    expect(html).toContain('Rientrano')
    expect(html).toContain('Non riconosciuti')
    expect(html).toContain('Nessuno Qui')
    expect(html).toContain('Stato che non capisco')
    expect(html).toContain('Applica (2)')
    // senza la migrazione lo dice, perché la nota di A andrebbe persa
    expect(html).toContain('nota_indisponibili')
  })
})
