/* ══ Previsione contro realtà ════════════════════════════════════════
   Per ogni giornata con i voti e una tua formazione salvata: i fantapunti
   che ha fatto la tua, e quelli che avrebbe fatto la formazione consigliata
   dal modello, interrogato com'era prima della giornata. Si calcola solo
   quando lo chiedi: ricostruisce un motore per ogni giornata.
   È privato come le formazioni: non lo vede nessun altro della lega.  */
import { useMemo, useState } from 'react'
import type { Motore } from '../domain/motore.ts'
import type { Formazione } from '../domain/formazione.ts'
import { MAX_CAMBI, sintesiPrevisioni, storicoPrevisioni } from '../domain/previsione.ts'
import { Delta } from '../viste/segni.tsx'
import { Bottone, Card } from '../ui.tsx'

export default function PrevisioneRealta({ m, motorePrima, formazioni, iniziaAperta = false }: {
  m: Motore; motorePrima: (g: number) => Motore; formazioni: Record<string, Partial<Formazione>>; iniziaAperta?: boolean
}) {
  const [aperta, setAperta] = useState(iniziaAperta)
  const voci = useMemo(() => aperta ? storicoPrevisioni(m, motorePrima, formazioni) : [], [aperta, m, motorePrima, formazioni])
  const quante = m.giornateGiocate().filter(g => formazioni[g]).length
  const s = sintesiPrevisioni(voci)

  return (
    <Card titolo="Previsione contro realtà" azioni={<span className="hint">la tua formazione contro quella del modello, sui voti veri</span>}>
      {!quante ? (
        <p className="hint max-w-[72ch]">
          Quando ci saranno i voti di una giornata per cui hai salvato la formazione, qui vedrai quanti fantapunti ha fatto la tua
          e quanti ne avrebbe fatti quella consigliata dal modello.
        </p>
      ) : !aperta ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="hint">{quante} {quante === 1 ? 'giornata da confrontare' : 'giornate da confrontare'}.</span>
          <Bottone piccolo onClick={() => setAperta(true)}>Confronta</Bottone>
        </div>
      ) : (
        <>
          <p className="text-sm">
            Su <b className="fr-num">{s.giornate}</b> {s.giornate === 1 ? 'giornata' : 'giornate'} il modello avrebbe fatto meglio
            in <b className="fr-num">{s.meglioModello}</b>, tu in <b className="fr-num">{s.meglioMia}</b>
            {s.pari > 0 && <>, pari in <b className="fr-num">{s.pari}</b></>}.
            {s.meglioModello > 0 && <> Quando ha fatto meglio, di <b className="fr-num">{s.mediaQuandoMeglio.toFixed(1)}</b> fantapunti in media.</>}
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="prev-tabella">
              <thead>
                <tr><th>Giornata</th><th>La tua</th><th>Il modello</th><th>Tu rispetto al modello</th><th>I tuoi cambi</th></tr>
              </thead>
              <tbody>
                {voci.map(v => (
                  <tr key={v.g}>
                    <td className="fr-num">{v.g}ª</td>
                    <td><span className="fr-num">{v.mia.totale.toFixed(1)}</span> <span className="hint">{v.modMio}</span></td>
                    <td><span className="fr-num">{v.modello.totale.toFixed(1)}</span> <span className="hint">{v.modModello}</span></td>
                    <td><Delta ora={v.mia.totale} prima={v.modello.totale} soglia={1} decimali={1} titolo="rispetto al modello" /></td>
                    <td className="hint">{v.mia.cambi.length}{v.mia.scoperte > 0 && ` · ${v.mia.scoperte} senza sostituto`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint mt-3 max-w-[80ch]">
            Le due formazioni si contano allo stesso modo: i fantavoti degli undici, e chi è senza voto lo sostituisce il primo della
            panchina dello stesso ruolo, fino a {MAX_CAMBI} cambi. Il modello sceglie com'era prima della giornata, senza i suoi voti.
            Due limiti: gli indisponibili sono quelli segnati oggi, non quelli di allora; e non sono i fantapunti ufficiali della lega,
            che hanno modificatori e regole loro e stanno nel calendario di lega.
          </p>
        </>
      )}
    </Card>
  )
}
