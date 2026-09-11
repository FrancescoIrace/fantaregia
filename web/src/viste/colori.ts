/* Le scale di colore e le sigle dell'app a file singolo (part4/part5):
   le stesse soglie ovunque, così un colore vuol dire sempre la stessa cosa. */

/** appetibilità e punteggio di giornata, 0–100 */
export const appetCol = (s: number) => s >= 75 ? 'var(--ok)' : s <= 45 ? 'var(--crit)' : 'var(--muted)'
/** fantamedia */
export const fmCol = (f: number) => f >= 7 ? 'var(--ok)' : f <= 5.5 ? 'var(--crit)' : 'var(--muted)'
/** forma: scarto dalla propria fantamedia */
export const deltaCol = (d: number) => d >= 0.5 ? 'var(--ok)' : d <= -0.5 ? 'var(--crit)' : 'var(--muted)'
export const segno = (d: number) => (d >= 0 ? '+' : '−') + Math.abs(d).toFixed(1)
/** la fascia della maglia in formazione: oro, argento, bronzo, grigio */
export const fascia = (n: number) => n >= 80 ? 'f-oro' : n >= 65 ? 'f-arg' : n >= 50 ? 'f-bro' : 'f-gre'

const SIGLE: Record<string, string> = {
  Atalanta: 'ATA', Bologna: 'BOL', Cagliari: 'CAG', Como: 'COM', Fiorentina: 'FIO', Frosinone: 'FRO',
  Genoa: 'GEN', Inter: 'INT', Juventus: 'JUV', Lazio: 'LAZ', Lecce: 'LEC', Milan: 'MIL', Monza: 'MON', Napoli: 'NAP',
  Parma: 'PAR', Roma: 'ROM', Sassuolo: 'SAS', Torino: 'TOR', Udinese: 'UDI', Venezia: 'VEN',
}
export const ABBR = (t: string) => SIGLE[t] || t.slice(0, 3).toUpperCase()

/** «2026-09-14» → «14/09/26» */
export const dataBreve = (s: string | null | undefined) => {
  if (!s) return ''
  const p = s.split('-')
  return p[2] + '/' + p[1] + '/' + p[0].slice(2)
}
