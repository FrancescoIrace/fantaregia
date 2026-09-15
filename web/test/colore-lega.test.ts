// @vitest-environment jsdom
/* Il colore squadra dentro una lega: la tinta di chi guarda si ricorda al
   cambio di tema, e chi sceglie vede avvisi e una proposta — mai un divieto. */
import { describe, expect, it } from 'vitest'
import { riapplicaTinta, statoScelta, TINTA_PREDEFINITA, tintaInUso, usaTinta } from '../src/viste/colore-squadra.ts'

const sq = (id: number, nome: string, colore: string | null) => ({ id, nome, colore })

describe('la tinta attiva', () => {
  it('al cambio di tema si riapplica la tinta della squadra, non la predefinita', () => {
    /* Il difetto che questa memoria evita: main.tsx ascolta il cambio di
       tema del sistema, e riapplicando l'ambra fissa cancellava il colore
       della squadra appena il sistema passava al chiaro. */
    usaTinta('#3E7BD6')
    expect(riapplicaTinta().scelta).toBe('#3E7BD6')
    expect(document.documentElement.style.getPropertyValue('--fr-marchio')).not.toBe('')
  })

  it('senza colore si torna alla predefinita', () => {
    usaTinta('#3E7BD6')
    usaTinta(null)
    expect(tintaInUso()).toBe(TINTA_PREDEFINITA)
    expect(riapplicaTinta().scelta).toBe(TINTA_PREDEFINITA)
  })
})

describe('chi sceglie il colore', () => {
  it('le tinte della lega non contano la propria', () => {
    const s = statoScelta([sq(1, 'Uno', '#3E7BD6'), sq(2, 'Due', '#2AA79B'), sq(3, 'Tre', null)], 1)
    expect(s.tinteInLega).toEqual(['#2AA79B'])
    expect(s.avvisi).toEqual([])
    expect(s.proposta).toBeNull()
  })

  it('una tinta pronta già presa porta il nome di chi ce l\'ha', () => {
    const s = statoScelta([sq(1, 'Uno', null), sq(2, 'Regia FC', '#2AA79B')], 1)
    expect(s.prese.get('#2AA79B')).toBe('Regia FC')
    expect(s.prese.has('#F2B03D')).toBe(false)
  })

  it('vicina al rosso dei cali: avviso e proposta, e la proposta non ha avvisi', () => {
    const s = statoScelta([sq(1, 'Uno', '#E1523D'), sq(2, 'Due', '#F2B03D')], 1)
    expect(s.avvisi.map(a => a.cosa)).toContain('rosso')
    expect(s.proposta).not.toBeNull()
    expect(statoScelta([sq(1, 'Uno', s.proposta), sq(2, 'Due', '#F2B03D')], 1).avvisi).toEqual([])
  })

  it('la stessa tinta di un\'altra squadra è un avviso di lega', () => {
    const s = statoScelta([sq(1, 'Uno', '#3E7BD6'), sq(2, 'Due', '#3E7BD6')], 1)
    expect(s.avvisi.map(a => a.cosa)).toEqual(['lega'])
  })

  it('senza squadra scelta non c\'è niente da avvisare', () => {
    const s = statoScelta([sq(1, 'Uno', '#E1523D'), sq(2, 'Due', '#E1523D')], null)
    expect(s.avvisi).toEqual([])
    expect(s.tinteInLega).toEqual(['#E1523D', '#E1523D'])
  })
})
