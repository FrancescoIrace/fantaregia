/* ══ La prospettiva del campo ═══════════════════════════════════════
   La geometria di Campo.tsx, senza niente da disegnare: dove sta un
   punto (u, t) sul disegno e dove stanno i giocatori di un reparto. Sta
   in un file suo perché si prova da sola (test/campo.test.ts).

   u è la posizione trasversale (0 fascia sinistra, 1 fascia destra), t la
   profondità (0 la propria linea di fondo, 1 quella avversaria).       */
import type { Ruolo } from '../domain/tipi.ts'

export const LARGO = 360, ALTO = 452
const FONDO_Y = 424, CIMA_Y = 40          // linea di fondo propria e avversaria
const FONDO_W = 346, CIMA_W = 214         // quanto sono larghe sul disegno
export const CX = LARGO / 2

/** (u, t) → punto sul disegno. È l'unica proiezione del file. */
export function proietta(u: number, t: number) {
  return { x: CX + (u - 0.5) * (FONDO_W + (CIMA_W - FONDO_W) * t), y: FONDO_Y - t * (FONDO_Y - CIMA_Y) }
}
/** quanto è grande un disco a quella profondità */
export const scala = (t: number) => 1 - 0.30 * t

/* Dove sta ogni reparto in profondità. Il portiere quasi sulla linea, gli
   altri tre distribuiti nella metà campo propria e poco oltre. */
const PROFONDITA: Record<Ruolo, number> = { P: 0.045, D: 0.29, C: 0.55, A: 0.80 }
/* Il passo avanti di chi sta sull'esterno: più ampio in difesa, dove i
   terzini salgono davvero, quasi niente in attacco. */
const PASSO: Record<Ruolo, number> = { P: 0, D: 0.045, C: 0.03, A: 0.02 }
/* A parità di numero, un reparto più avanzato occupa meno campo: tre
   attaccanti stanno più stretti di tre difensori. */
const ALLARGA: Record<Ruolo, number> = { P: 0, D: 1, C: 0.96, A: 0.86 }

/** Le posizioni (u, t) di n giocatori di un reparto, da sinistra a destra. */
export function posizioni(r: Ruolo, n: number): { u: number; t: number }[] {
  if (n <= 0) return []
  if (n === 1) return [{ u: 0.5, t: PROFONDITA[r] }]
  const larghezza = Math.min(0.84, 0.12 + 0.22 * (n - 1)) * ALLARGA[r]
  return Array.from({ length: n }, (_, i) => {
    const dalCentro = Math.abs(i - (n - 1) / 2) / ((n - 1) / 2)   // 0 al centro, 1 sugli esterni
    let t = PROFONDITA[r] + PASSO[r] * dalCentro
    // con la difesa a quattro o cinque i centrali restano un filo più indietro
    if (r === 'D' && n >= 4) t -= 0.012 * (1 - dalCentro)
    const u = 0.5 - larghezza / 2 + (i / (n - 1)) * larghezza
    return { u: Math.max(0.08, Math.min(0.92, u)), t }
  })
}
