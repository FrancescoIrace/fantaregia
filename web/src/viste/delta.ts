/* ══ Delta: la variazione accanto al valore ══════════════════════════
   Sempre con il verso, mai da sola. Il verso lo decide una soglia: su un
   punteggio da 0 a 100 un punto di differenza è rumore, non una notizia,
   e le spie si accendono solo quando è successo qualcosa.              */
export type Verso = 'su' | 'giu' | 'fermo'

export function verso(d: number, soglia = 3): Verso {
  return d >= soglia ? 'su' : d <= -soglia ? 'giu' : 'fermo'
}

/** «+5», «−3», «=»: il meno è quello tipografico, come segno() in colori.ts.
    Con i decimali («+1.5») per i fantapunti, dove mezzo punto è un voto. */
export function scriviDelta(d: number, decimali = 0) {
  const n = Number(d.toFixed(decimali))
  return n === 0 ? '=' : (n > 0 ? '+' : '−') + Math.abs(n).toFixed(decimali)
}
