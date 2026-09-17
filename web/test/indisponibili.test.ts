/* Gli indisponibili da un file: lettura, stati, nomi, proposta. Tutto puro,
   niente database: la scrittura sta in data/lega.ts. */
import { describe, expect, it } from 'vitest'
import {
  capisciStato, daApplicare, etichettaMotivo, indiceGiocatori, leggiFileIndisponibili, piega, proponi, riconosci, scegliOmonimo,
} from '../src/domain/indisponibili.ts'
import { parseCSV } from '../src/domain/importa.ts'
import type { Giocatore } from '../src/domain/tipi.ts'

const g = (id: number, n: string, s = 'Inter', r: Giocatore['r'] = 'C'): Giocatore => ({ id, n, s, r, q: 10 } as Giocatore)
const LISTONE = [
  g(1, 'Calhanoglu'), g(2, 'Martinez L.', 'Inter', 'A'), g(3, 'Martinez Jo.', 'Inter', 'P'),
  g(4, 'Leão', 'Milan', 'A'), g(5, 'Theo Hernandez', 'Milan', 'D'), g(6, 'Rossi', 'Genoa'), g(7, 'Rossi', 'Lecce'),
]

describe('leggere il file', () => {
  it('il file della routine, così com\'è', () => {
    const testo = 'nome;stato;nota\nCalhanoglu;infortunio;risentimento muscolare adduttore destro, rientro previsto dopo la sosta nazionali (circa 2 settimane)\n'
    expect(leggiFileIndisponibili(parseCSV(testo))).toEqual([{
      riga: 2, nome: 'Calhanoglu', stato: 'infortunio',
      nota: 'risentimento muscolare adduttore destro, rientro previsto dopo la sosta nazionali (circa 2 settimane)',
    }])
  })

  it('l\'intestazione in un altro ordine, con righe vuote e senza nota', () => {
    const righe = [['Aggiornato il 17/09'], ['Stato', 'Nome'], ['squalifica', 'Leão'], [], ['', ''], ['infortunio', 'Rossi']]
    expect(leggiFileIndisponibili(righe)).toEqual([
      { riga: 3, nome: 'Leão', stato: 'squalifica', nota: '' },
      { riga: 6, nome: 'Rossi', stato: 'infortunio', nota: '' },
    ])
  })

  it('senza intestazione: nome, stato, nota nell\'ordine', () => {
    expect(leggiFileIndisponibili([['Calhanoglu', 'infortunio', 'x']])[0]).toMatchObject({ nome: 'Calhanoglu', stato: 'infortunio', nota: 'x' })
  })
})

describe('capire lo stato', () => {
  it.each([
    ['infortunio', 'fuori', 'infortunio'], ['Infortunato', 'fuori', 'infortunio'], ['lesione muscolare', 'fuori', 'infortunio'],
    ['squalificato', 'fuori', 'squalifica'], ['espulso', 'fuori', 'espulsione'], ['influenza', 'fuori', 'indisponibile'],
    ['non disponibile', 'fuori', 'indisponibile'], ['indisponibile', 'fuori', 'indisponibile'], ['non convocato', 'fuori', 'indisponibile'],
    ['infortunio, rientro previsto dopo la sosta', 'fuori', 'infortunio'],
  ])('«%s» è %s (%s)', (stato, tipo, motivo) => {
    expect(capisciStato(stato)).toEqual({ tipo, motivo })
  })

  it.each(['rientrato', 'disponibile', 'recuperato', 'rientrato dall\'infortunio', 'tornato in gruppo'])('«%s» è un rientro', stato => {
    expect(capisciStato(stato)).toEqual({ tipo: 'rientro' })
  })

  it('uno stato che non si capisce resta da guardare, non si indovina', () => {
    expect(capisciStato('in dubbio')).toBeNull()
    expect(capisciStato('')).toBeNull()
  })
})

describe('riconoscere i nomi', () => {
  const ix = indiceGiocatori(LISTONE)
  const id = (nome: string) => { const e = riconosci(nome, ix); return e.tipo === 'trovato' ? e.p.id : e.tipo }

  it('senza accenti né maiuscole: «Çalhanoğlu» e «LEAO» si trovano', () => {
    expect(piega('Çalhanoğlu')).toBe('calhanoglu')
    expect(id('Çalhanoğlu')).toBe(1)
    expect(id('LEAO')).toBe(4)
    expect(id('theo hernández')).toBe(5)
  })

  it('con l\'iniziale o col nome per intero: «Martinez L.» e «Lautaro Martinez», non il portiere', () => {
    expect(id('Martinez L.')).toBe(2)
    expect(id('Lautaro Martinez')).toBe(2)
    expect(id('Josep Martinez')).toBe(3)
  })

  it('due giocatori con lo stesso nome: omonimi, con i candidati, mai uno a caso', () => {
    const e = riconosci('Rossi', ix)
    expect(e.tipo).toBe('omonimi')
    expect(e.tipo === 'omonimi' && e.candidati.map(p => p.id).sort()).toEqual([6, 7])
    expect(id('Martinez')).toBe('omonimi')
  })

  it('un nome che non c\'è', () => {
    expect(id('Maradona')).toBe('nessuno')
  })
})

describe('la proposta', () => {
  const fuori: Record<number, { motivo?: string; nota?: string }> = { 4: { motivo: 'squalifica', nota: '' }, 5: { motivo: 'infortunio', nota: 'vecchia' } }
  const ora = (pid: number) => fuori[pid] ?? null
  const voci = leggiFileIndisponibili(parseCSV([
    'nome;stato;nota',
    'Calhanoglu;infortunio;adduttore',       // entra
    'Leão;squalificato;',                     // già fuori così: invariato
    'Theo Hernandez;infortunio;nuova nota',   // già fuori: cambia la nota
    'Martinez L.;rientrato;',                 // non era fuori: niente
    'Rossi;infortunio;',                      // omonimi
    'Maradona;infortunio;',                   // non trovato
    'Josep Martinez;in dubbio;',              // stato che non si capisce
  ].join('\n')))
  const pr = proponi(voci, LISTONE, ora)

  it('divide il file in chi entra, chi cambia, chi resta com\'è e quello che non torna', () => {
    expect(pr.entrano.map(x => [x.pid, x.motivo, x.nota])).toEqual([[1, 'infortunio', 'adduttore']])
    expect(pr.aggiornati.map(x => [x.pid, x.nota, x.prima.nota])).toEqual([[5, 'nuova nota', 'vecchia']])
    expect(pr.invariati.map(x => x.p.id).sort()).toEqual([2, 4])
    expect(pr.rientrano).toEqual([])
    expect(pr.omonimi.map(x => x.nome)).toEqual(['Rossi'])
    expect(pr.nonTrovati.map(x => x.nome)).toEqual(['Maradona'])
    expect(pr.statiIgnoti.map(x => [x.nome, x.riga])).toEqual([['Josep Martinez', 8]])
    expect(daApplicare(pr)).toBe(2)
  })

  it('chi è fuori e il file dà rientrato esce dall\'infermeria', () => {
    const p = proponi(leggiFileIndisponibili([['Leão', 'rientrato', '']]), LISTONE, ora)
    expect(p.rientrano.map(x => x.pid)).toEqual([4])
  })

  it('lo stesso giocatore due volte: vale l\'ultima riga', () => {
    const p = proponi(leggiFileIndisponibili([['Calhanoglu', 'infortunio', 'prima'], ['Calhanoglu', 'influenza', 'dopo']]), LISTONE, ora)
    expect(p.entrano.map(x => [x.motivo, x.nota])).toEqual([['indisponibile', 'dopo']])
  })

  it('scegliendo fra gli omonimi la voce entra nella proposta come le altre', () => {
    const scelta = scegliOmonimo(pr, pr.omonimi[0].riga, LISTONE[6], ora)
    expect(scelta.omonimi).toEqual([])
    expect(scelta.entrano.map(x => x.pid)).toEqual([1, 7])
    expect(pr.omonimi).toHaveLength(1)                     // la proposta di prima non cambia
  })

  it('in Infermeria ogni motivo si legge col suo nome', () => {
    expect(['infortunio', 'squalifica', 'espulsione', 'indisponibile', undefined].map(etichettaMotivo))
      .toEqual(['infortunato', 'squalificato', 'espulso', 'indisponibile', 'infortunato'])
  })
})
