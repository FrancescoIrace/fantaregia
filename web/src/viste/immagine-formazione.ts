/* ══ La formazione come immagine ═════════════════════════════════════
   Un PNG da mandare nel gruppo della lega: in cima squadra, giornata e
   modulo; in mezzo il campo isometrico con i titolari, ognuno con la sua
   maglietta, il punteggio di giornata sopra e il nome sotto; in fondo la
   panchina nell'ordine d'ingresso.

   Si disegna su un canvas e non con un SVG convertito: un SVG caricato
   come immagine non vede i font della pagina, e Barlow sparirebbe. Il
   canvas usa quelli già caricati, e prima di disegnare si aspetta che ci
   siano.

   Le posizioni sono quelle neutre del modulo (posizioni() di
   prospettiva.ts), le stesse del campo del telefono: cambia la vista, non
   la disposizione. I colori vengono dai token del tema di chi condivide:
   la maglia è il colore della sua squadra (--fr-marchio, già corretto per
   il contrasto), il numero sopra è l'inchiostro scelto per leggersi su
   quella tinta.                                                       */
import type { Ruolo } from '../domain/tipi.ts'
import { posizioni } from './prospettiva.ts'

export interface GiocatoreImmagine { nome: string; ruolo: Ruolo; punti: number | null; fuori: boolean }
export interface DatiImmagine {
  squadra: string
  lega: string
  giornata: number
  data: string
  modulo: string
  media: number | null
  campo: Record<Ruolo, (GiocatoreImmagine | null)[]>
  panchina: GiocatoreImmagine[]
}

/* ── i colori: i token del tema corrente ── */
export interface Colori {
  fondo: string; pan: string; incasso: string; filo: string; ink: string; fioco: string
  marchio: string; marchioInk: string; giu: string; erba: string; erba2: string; erbaLinea: string
}
const TOKEN: Record<keyof Colori, string> = {
  fondo: '--fr-fondo', pan: '--fr-pan', incasso: '--fr-incasso', filo: '--fr-filo', ink: '--fr-ink', fioco: '--fr-fioco',
  marchio: '--fr-marchio', marchioInk: '--fr-marchio-ink', giu: '--fr-giu', erba: '--fr-erba', erba2: '--fr-erba-2', erbaLinea: '--fr-erba-linea',
}
export function leggiColori(radice: Element = document.documentElement): Colori {
  const stile = getComputedStyle(radice)
  return Object.fromEntries(Object.entries(TOKEN).map(([k, v]) => [k, stile.getPropertyValue(v).trim()])) as unknown as Colori
}

/* ── la geometria ── */
export const LARGHEZZA = 1080
const TESTA = 210                       // la fascia con squadra, giornata e media
const CAMPO_H = 700                     // lo spazio del campo
const RIGA_PANCHINA = 50
const MARGINE = 60

/* Il campo misura 68 × 105 metri. Isometrico: la larghezza (u) scende verso
   destra, la lunghezza (t) sale verso destra e si accorcia. La propria porta
   è in basso a sinistra, quella avversaria in alto a destra. */
const METRI_U = 68, METRI_T = 105
const VU = { x: 1, y: 0.36 }, VT = { x: 0.56, y: -0.6 }
const SCALA = (LARGHEZZA - 2 * MARGINE) / (METRI_U * VU.x + METRI_T * VT.x)
const ORIGINE = { x: MARGINE, y: TESTA + CAMPO_H / 2 + (METRI_T * -VT.y - METRI_U * VU.y) * SCALA / 2 - 10 }

/** (u, t) del campo → punto dell'immagine. L'unica proiezione del disegno. */
export function proiettaIso(u: number, t: number) {
  return {
    x: ORIGINE.x + (u * METRI_U * VU.x + t * METRI_T * VT.x) * SCALA,
    y: ORIGINE.y + (u * METRI_U * VU.y + t * METRI_T * VT.y) * SCALA,
  }
}

/** Dove sta ogni titolare nell'immagine, dal più lontano al più vicino:
    chi è davanti si disegna dopo e copre chi sta dietro. */
export function disposizione(campo: DatiImmagine['campo']) {
  const out: { g: GiocatoreImmagine | null; ruolo: Ruolo; x: number; y: number }[] = []
  for (const r of ['P', 'D', 'C', 'A'] as Ruolo[]) {
    posizioni(r, campo[r].length).forEach((pos, i) => {
      /* Le profondità di posizioni() sono quelle del campo del telefono, dove
         il portiere sta quasi sulla linea. Qui la maglia è alta e in piedi:
         sulla linea copriva la porta, e il nome ci finiva dentro. Si spostano
         tutti in avanti: il portiere al limite dell'area, e fra un reparto e
         l'altro resta lo spazio per maglia e nome (circa 110px). */
      const { x, y } = proiettaIso(pos.u, 0.14 + pos.t * 0.95)
      out.push({ g: campo[r][i], ruolo: r, x, y })
    })
  }
  return out.sort((a, b) => a.y - b.y)
}

/** quanto è alta l'immagine: la panchina va su due colonne */
export const altezza = (dati: DatiImmagine) => TESTA + CAMPO_H + 70 + Math.ceil(dati.panchina.length / 2) * RIGA_PANCHINA + 90

/* ── il disegno ── */
const NUM = '"Barlow Condensed", "Arial Narrow", sans-serif'
const TESTO = 'Barlow, system-ui, sans-serif'
const taglia = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '.' : s)

function poligono(ctx: CanvasRenderingContext2D, punti: { x: number; y: number }[]) {
  ctx.beginPath()
  punti.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
  ctx.closePath()
}
const quad = (t1: number, t2: number, u1: number, u2: number) =>
  [proiettaIso(u1, t1), proiettaIso(u2, t1), proiettaIso(u2, t2), proiettaIso(u1, t2)]

function disegnaCampo(ctx: CanvasRenderingContext2D, c: Colori) {
  // lo spessore del prato, sui due lati che si vedono: è quello che fa «isometrico»
  const SP = 22
  const [p00, p10, p11] = [proiettaIso(0, 0), proiettaIso(1, 0), proiettaIso(1, 1)]
  const giu = (p: { x: number; y: number }) => ({ x: p.x, y: p.y + SP })
  ctx.fillStyle = c.erba2
  poligono(ctx, [p00, p10, p11, giu(p11), giu(p10), giu(p00)]); ctx.fill()
  ctx.fillStyle = c.incasso; ctx.globalAlpha = 0.45; ctx.fill(); ctx.globalAlpha = 1

  // strisce di erba tagliata
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = i % 2 ? c.erba2 : c.erba
    poligono(ctx, quad(i / 10, (i + 1) / 10, 0, 1)); ctx.fill()
  }
  ctx.strokeStyle = c.erbaLinea; ctx.lineWidth = 3; ctx.lineJoin = 'round'
  const riga = (pts: { x: number; y: number }[], chiuso = true) => {
    ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
    if (chiuso) ctx.closePath()
    ctx.stroke()
  }
  riga(quad(0, 1, 0, 1))
  riga([proiettaIso(0, 0.5), proiettaIso(1, 0.5)], false)
  // il cerchio di centrocampo: un cerchio vero sul prato, che la proiezione schiaccia da sé
  riga(Array.from({ length: 48 }, (_, k) => {
    const a = (k / 48) * Math.PI * 2
    return proiettaIso(0.5 + (9.15 / METRI_U) * Math.cos(a), 0.5 + (9.15 / METRI_T) * Math.sin(a))
  }))
  for (const [t1, t2] of [[0, 16.5 / METRI_T], [1 - 16.5 / METRI_T, 1]]) riga(quad(t1, t2, 0.2037, 0.7963))
  for (const [t1, t2] of [[0, 5.5 / METRI_T], [1 - 5.5 / METRI_T, 1]]) riga(quad(t1, t2, 0.3655, 0.6345))
  ctx.fillStyle = c.erbaLinea
  for (const t of [11 / METRI_T, 1 - 11 / METRI_T]) { const p = proiettaIso(0.5, t); ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill() }

  // le porte: due pali e la traversa, in piedi sul prato
  ctx.strokeStyle = c.ink; ctx.lineWidth = 4
  for (const t of [0, 1]) {
    const a = proiettaIso(0.4462, t), b = proiettaIso(0.5538, t), h = 24
    riga([a, { x: a.x, y: a.y - h }, { x: b.x, y: b.y - h }, b], false)
  }
}

/* La maglietta: collo, maniche, corpo. (x, y) è il punto del prato dove sta
   il giocatore; la maglia sta sopra, con un'ombra ai piedi. */
function maglietta(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const ox = x - w / 2, oy = y - h - 8
  const P = (px: number, py: number) => ({ x: ox + px * w, y: oy + py * h })
  ctx.beginPath()
  const a = P(0.3, 0)
  ctx.moveTo(a.x, a.y)
  const collo = P(0.5, 0.17), b = P(0.7, 0)
  ctx.quadraticCurveTo(collo.x, collo.y, b.x, b.y)
  for (const [px, py] of [[1, 0.2], [0.9, 0.46], [0.78, 0.38], [0.78, 1], [0.22, 1], [0.22, 0.38], [0.1, 0.46], [0, 0.2]]) {
    const p = P(px, py); ctx.lineTo(p.x, p.y)
  }
  ctx.closePath()
}

function giocatoreInCampo(ctx: CanvasRenderingContext2D, c: Colori, g: GiocatoreImmagine | null, x: number, y: number) {
  const W = 92, H = 84
  // l'ombra ai piedi
  ctx.fillStyle = c.fondo; ctx.globalAlpha = 0.35
  ctx.beginPath(); ctx.ellipse(x, y - 4, 34, 10, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1

  if (!g) {
    maglietta(ctx, x, y, W, H)
    ctx.setLineDash([8, 6]); ctx.strokeStyle = c.erbaLinea; ctx.lineWidth = 3; ctx.stroke(); ctx.setLineDash([])
    ctx.fillStyle = c.ink; ctx.font = `700 40px ${NUM}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('+', x, y - H / 2 - 4)
    return
  }
  maglietta(ctx, x, y, W, H)
  // chi non può giocare: maglia spenta col bordo rosso, perché è la casella da sistemare
  ctx.fillStyle = g.fuori ? c.incasso : c.marchio; ctx.fill()
  ctx.strokeStyle = g.fuori ? c.giu : c.fondo; ctx.lineWidth = g.fuori ? 5 : 3; ctx.stroke()

  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillStyle = g.fuori ? c.giu : c.marchioInk
  ctx.font = `700 38px ${NUM}`
  ctx.fillText(g.punti === null ? '—' : String(g.punti), x, y - H / 2 + 2)

  // il nome sotto, con un alone del colore dell'erba perché si legga sulle strisce
  ctx.font = `700 25px ${TESTO}`
  ctx.lineWidth = 7; ctx.strokeStyle = c.erba2; ctx.lineJoin = 'round'
  const nome = taglia(g.nome, 12)
  ctx.strokeText(nome, x, y + 20)
  ctx.fillStyle = c.ink
  ctx.fillText(nome, x, y + 20)
}

export function disegnaFormazione(ctx: CanvasRenderingContext2D, dati: DatiImmagine, c: Colori) {
  const H = altezza(dati)
  ctx.fillStyle = c.fondo; ctx.fillRect(0, 0, LARGHEZZA, H)
  // il filo del marchio in cima, come la testata dell'app
  ctx.fillStyle = c.marchio; ctx.fillRect(0, 0, LARGHEZZA, 12)

  // ── la testa ──
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'
  ctx.fillStyle = c.ink; ctx.font = `700 56px ${TESTO}`
  ctx.fillText(taglia(dati.squadra, 24), MARGINE, 96)
  ctx.fillStyle = c.fioco; ctx.font = `500 30px ${TESTO}`
  ctx.fillText([dati.lega, `${dati.giornata}ª giornata`, dati.data, dati.modulo].filter(Boolean).join(' · '), MARGINE, 146)
  ctx.textAlign = 'right'
  ctx.fillStyle = c.ink; ctx.font = `700 84px ${NUM}`
  ctx.fillText(dati.media === null ? '—' : String(dati.media), LARGHEZZA - MARGINE, 110)
  ctx.fillStyle = c.fioco; ctx.font = `500 24px ${TESTO}`
  ctx.fillText('punteggio medio', LARGHEZZA - MARGINE, 146)

  // ── il campo ──
  disegnaCampo(ctx, c)
  for (const d of disposizione(dati.campo)) giocatoreInCampo(ctx, c, d.g, d.x, d.y)

  // ── la panchina ──
  let y = TESTA + CAMPO_H + 40
  ctx.textAlign = 'left'; ctx.fillStyle = c.fioco; ctx.font = `600 28px ${TESTO}`
  ctx.fillText('Panchina, in ordine d\'ingresso', MARGINE, y)
  ctx.fillStyle = c.filo; ctx.fillRect(MARGINE, y + 16, LARGHEZZA - 2 * MARGINE, 2)
  y += 30
  const colonna = (LARGHEZZA - 2 * MARGINE - 40) / 2, perColonna = Math.ceil(dati.panchina.length / 2)
  dati.panchina.forEach((g, i) => {
    const col = i < perColonna ? 0 : 1, rigaY = y + (i - col * perColonna) * RIGA_PANCHINA + 36
    const x0 = MARGINE + col * (colonna + 40)
    ctx.textAlign = 'left'
    ctx.fillStyle = c.fioco; ctx.font = `700 24px ${NUM}`
    ctx.fillText(String(i + 1), x0, rigaY)
    ctx.fillText(g.ruolo, x0 + 36, rigaY)
    ctx.fillStyle = g.fuori ? c.fioco : c.ink; ctx.font = `600 28px ${TESTO}`
    ctx.fillText(taglia(g.nome, 18), x0 + 70, rigaY)
    ctx.textAlign = 'right'
    ctx.fillStyle = g.fuori ? c.giu : c.ink; ctx.font = `700 30px ${NUM}`
    ctx.fillText(g.punti === null ? '—' : String(g.punti), x0 + colonna, rigaY)
  })

  // ── la firma ──
  ctx.textAlign = 'right'; ctx.fillStyle = c.fioco; ctx.font = `600 24px ${TESTO}`
  ctx.fillText('Fantaregia', LARGHEZZA - MARGINE, H - 34)
}

/** Il PNG, con i font già caricati: senza aspettarli il primo disegno esce in Arial. */
export async function creaImmagine(dati: DatiImmagine, colori: Colori = leggiColori()): Promise<Blob> {
  if (document.fonts) {
    await Promise.all([`700 38px ${NUM}`, `700 25px ${TESTO}`, `500 30px ${TESTO}`].map(f => document.fonts.load(f).catch(() => [])))
  }
  const canvas = document.createElement('canvas')
  canvas.width = LARGHEZZA; canvas.height = altezza(dati)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('questo browser non sa disegnare l\'immagine')
  disegnaFormazione(ctx, dati, colori)
  return new Promise((ok, ko) => canvas.toBlob(b => (b ? ok(b) : ko(new Error('immagine non creata'))), 'image/png'))
}

/** Sul telefono il pannello di condivisione (WhatsApp, Telegram…); dove non
    c'è, o non accetta file, l'immagine si scarica. Chiudere il pannello non è
    un errore. */
export async function condividiImmagine(blob: Blob, nomeFile: string, titolo: string): Promise<'condivisa' | 'scaricata' | 'annullata'> {
  const file = new File([blob], nomeFile, { type: 'image/png' })
  if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: titolo })
      return 'condivisa'
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return 'annullata'
      // un altro rifiuto (permessi, formato): si ripiega sullo scaricamento
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = nomeFile
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 3000)
  return 'scaricata'
}
