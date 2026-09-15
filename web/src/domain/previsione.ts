/* ══ Previsione contro realtà, e le formazioni del modello ═══════════
   Due domande che si fanno con gli stessi pezzi:
   - quanti fantapunti ha fatto davvero una formazione in una giornata;
   - quale formazione avrebbe consigliato il modello, senza vincoli.

   La regola dei cambi (scelta di Francesco, 15/09/2026): chi è senza voto
   lo sostituisce il primo della panchina dello stesso ruolo che ha preso
   voto, seguendo l'ordine della panchina, fino a tre cambi. Vale uguale per
   la formazione schierata e per quella del modello, così il confronto è
   giusto. Non sono i fantapunti ufficiali della lega (modificatori e regole
   particolari): quelli stanno nel calendario di lega.

   Il modello va interrogato com'era PRIMA della giornata: il punteggio di
   giornata usa forma e titolarità dai voti, e il motore di oggi conosce già
   quelli della giornata che si vuole giudicare. Per questo storicoPrevisioni
   chiede un motore per giornata (ingressoFinoA in data/componi.ts).     */
import { MODULI, ROLES, type Motore } from './motore.ts'
import { generaFormazione, normalizza, type Formazione } from './formazione.ts'
import type { Giocatore, Ruolo } from './tipi.ts'

export const MAX_CAMBI = 3

export interface PuntiFormazione {
  totale: number
  cambi: { esce: number | null; entra: number }[]   // esce null: la casella era vuota
  scoperte: number                                  // senza voto e senza un sostituto
}

/** i fantapunti veri di una formazione; voto(id) è null per chi non ha preso voto */
export function puntiFormazione(
  L: Formazione, voto: (id: number) => number | null, ruoloDi: (id: number) => Ruolo | undefined, maxCambi = MAX_CAMBI,
): PuntiFormazione {
  let totale = 0
  const scoperti: { id: number | null; r: Ruolo }[] = []
  for (const r of ROLES) {
    for (const id of L.start[r]) {
      const v = id ? voto(id) : null
      if (v === null) scoperti.push({ id, r })
      else totale += v
    }
  }
  const cambi: PuntiFormazione['cambi'] = []
  for (const b of L.bench) {
    if (cambi.length >= maxCambi) break
    const v = voto(b), r = ruoloDi(b)
    if (v === null || !r) continue
    const i = scoperti.findIndex(s => s.r === r)
    if (i < 0) continue
    const [s] = scoperti.splice(i, 1)
    totale += v
    cambi.push({ esce: s.id, entra: b })
  }
  return { totale, cambi, scoperte: scoperti.length }
}

/** la formazione che consiglia il modello, senza vincoli: per ogni modulo la
    scelta di generaFormazione, e vince il modulo con il punteggio di giornata
    più alto sugli undici. Non guarda i voti. */
export function formazioneModello(rosa: Giocatore[], { punteggio, indisponibile }: {
  punteggio: (p: Giocatore) => number; indisponibile: (id: number) => boolean
}): Formazione {
  const perId = new Map(rosa.map(p => [p.id, p]))
  let meglio: { formazione: Formazione; stima: number } | null = null
  for (const mod of Object.keys(MODULI)) {
    const { formazione } = generaFormazione(rosa, mod, { punteggio, indisponibile })
    const stima = ROLES.flatMap(r => formazione.start[r]).reduce<number>((a, id) => a + (id ? punteggio(perId.get(id)!) : 0), 0)
    if (!meglio || stima > meglio.stima) meglio = { formazione, stima }
  }
  return meglio!.formazione
}

export interface VocePrevisione {
  g: number
  mia: PuntiFormazione
  modello: PuntiFormazione
  modMio: string
  modModello: string
}

/** per ogni giornata con i voti e una formazione salvata: la tua contro quella del modello */
export function storicoPrevisioni(
  m: Motore, motorePrima: (g: number) => Motore, formazioni: Record<string, Partial<Formazione> | undefined>,
): VocePrevisione[] {
  return m.giornateGiocate().filter(g => formazioni[g]).map(g => {
    const mp = motorePrima(g)
    const R = mp.rosterAt(mp.meId(), g)
    const rosa = ROLES.flatMap(r => R[r].map(x => x.p))
    const modello = formazioneModello(rosa, { punteggio: p => mp.dayScore(p, g), indisponibile: id => mp.isOut(id) })
    const voto = (id: number) => { const a = m.S.stats[g]?.[id]; return a ? m.fvOf(a) : null }
    const ruoloDi = (id: number) => m.giocatoreDi(id)?.r
    const mia = normalizza(formazioni[g])
    return { g, mia: puntiFormazione(mia, voto, ruoloDi), modello: puntiFormazione(modello, voto, ruoloDi), modMio: mia.mod, modModello: modello.mod }
  })
}

/** in quante giornate il modello avrebbe fatto meglio, e di quanto; lo scarto è modello meno tua */
export function sintesiPrevisioni(voci: { mia: { totale: number }; modello: { totale: number } }[]) {
  const scarti = voci.map(v => v.modello.totale - v.mia.totale)
  const meglio = scarti.filter(d => d > 0)
  return {
    giornate: voci.length,
    meglioModello: meglio.length,
    meglioMia: scarti.filter(d => d < 0).length,
    pari: scarti.filter(d => d === 0).length,
    mediaScarto: voci.length ? scarti.reduce((a, d) => a + d, 0) / voci.length : 0,
    mediaQuandoMeglio: meglio.length ? meglio.reduce((a, d) => a + d, 0) / meglio.length : 0,
  }
}
