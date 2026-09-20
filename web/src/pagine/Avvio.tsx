/* La prima volta che si apre una lega vuota: un file solo, il listone, e il
   calendario di serie A che parte da solo subito dopo — va scaricato dopo,
   perché abbina i nomi dei club a quelli del listone.

   È una guida, non un cancello: «lo faccio dopo» porta dentro lo stesso, e
   «Lega e dati» resta dov'è con tutti gli altri file. Voti e calendario di
   lega non si chiedono qui: a inizio stagione non esistono ancora.

   Chi non può scrivere non carica niente: vede che la lega non è pronta. */
import { useState } from 'react'
import { caricaListone, salvaDataset, scaricaCalendario } from '../data/carica.ts'
import type { RigheLega } from '../data/componi.ts'
import { Avviso, Bottone, Card, Suggerimento } from '../ui.tsx'

type Esito = { tipo: 'ok' | 'attenzione' | 'errore'; testo: string }

export default function Avvio({ legaId, righe, puoScrivere, onEntra, onSalta }: {
  legaId: string; righe: RigheLega; puoScrivere: boolean; onEntra: () => void; onSalta: () => void
}) {
  const stagione = righe.lega.stagione
  const [fase, setFase] = useState<'attesa' | 'listone' | 'calendario' | 'fatto'>('attesa')
  const [listone, setListone] = useState<Esito | null>(null)
  const [calendario, setCalendario] = useState<Esito | null>(null)

  async function scegli(f: File | undefined) {
    if (!f) return
    setFase('listone'); setListone(null); setCalendario(null)
    let club: string[]
    try {
      /* niente calendario con cui confrontare i club: non c'è ancora, ed è
         proprio quello che stiamo per scaricare */
      const esito = await caricaListone(legaId, f, righe, [])
      club = esito.club
      setListone({
        tipo: 'ok',
        testo: `${esito.giocatori} giocatori, ${esito.club.length} squadre di serie A`
          + (esito.rimasti ? `; ${esito.rimasti} già in rosa non sono più in lista e restano segnati a parte` : '') + '.',
      })
    } catch (e) {
      setListone({ tipo: 'errore', testo: (e as Error).message })
      setFase('attesa')
      return
    }

    setFase('calendario')
    try {
      const { cal, ignote } = await scaricaCalendario(stagione, club)
      await salvaDataset(legaId, 'calendario', cal, { fonte: 'openfootball', when: Date.now() })
      setCalendario(ignote.length
        ? {
          tipo: 'attenzione',
          testo: `Calendario ${stagione} scaricato, ma ${ignote.join(', ')} non si ${ignote.length > 1 ? 'abbinano' : 'abbina'}`
            + ' a nessuna squadra del listone: quelle partite resteranno fuori dai conti finché non si sistema da «Lega e dati».',
        }
        : { tipo: 'ok', testo: `Calendario ${stagione} da openfootball: ${cal.teams.length} squadre, ${cal.fix[0]?.length ?? 0} giornate.` })
    } catch (e) {
      setCalendario({
        tipo: 'errore',
        testo: `${(e as Error).message}. La lega si usa lo stesso: il calendario si carica anche da un csv, da «Lega e dati».`,
      })
    }
    setFase('fatto')
  }

  if (!puoScrivere) return (
    <Card titolo="La lega non è ancora pronta">
      <div className="space-y-3">
        <p className="text-sm text-muted">
          Chi la gestisce sta caricando il listone e il calendario. Appena ci sono, qui compaiono prezzi attesi,
          formazioni e giornate: non devi fare niente.
        </p>
        <Bottone onClick={onSalta}>Guarda comunque</Bottone>
      </div>
    </Card>
  )

  const lavora = fase === 'listone' || fase === 'calendario'
  return (
    <Card titolo="Cominciamo dal listone">
      <div className="space-y-4">
        <Suggerimento>
          Il listone sblocca tutto il resto: prezzi attesi, titolarità, formazioni. Scaricalo da fantacalcio.it con il
          tuo account (xlsx o csv) — resta dentro questa lega e non viene ripubblicato da nessuna parte. Subito dopo il
          calendario di serie A {stagione} si scarica da solo da openfootball, che è un dataset aperto.
        </Suggerimento>

        <div>
          <span className="mb-1 block text-[11px] font-semibold tracking-wider text-muted uppercase">1 · Listone</span>
          <input type="file" accept=".xlsx,.xls,.csv,.txt" disabled={lavora} onChange={e => void scegli(e.target.files?.[0])}
            className="block w-full text-sm file:mr-3 file:rounded-[7px] file:border file:border-line-strong file:bg-surface file:px-3 file:py-1.5 file:text-[13px] file:font-medium" />
          {fase === 'listone' && <p className="mt-2 text-sm text-muted">Leggo il listone…</p>}
          {listone && <div className="mt-2"><Avviso tipo={listone.tipo}>{listone.testo}</Avviso></div>}
        </div>

        {(fase === 'calendario' || fase === 'fatto') && (
          <div>
            <span className="mb-1 block text-[11px] font-semibold tracking-wider text-muted uppercase">2 · Calendario di serie A</span>
            {fase === 'calendario'
              ? <p className="text-sm text-muted">Scarico il calendario {stagione}…</p>
              : calendario && <Avviso tipo={calendario.tipo}>{calendario.testo}</Avviso>}
          </div>
        )}

        {fase === 'fatto' && (
          <div className="space-y-2">
            <p className="text-sm">
              Il resto — voti di giornata, calendario di lega, statistiche, rigoristi — si carica da <b>Lega e dati</b>
              {' '}quando arriva: a inizio stagione non esiste ancora.
            </p>
            <Bottone variante="primario" onClick={onEntra} className="w-full">Entra nella lega</Bottone>
          </div>
        )}

        {fase !== 'fatto' && (
          <button type="button" onClick={onSalta} disabled={lavora} className="fr-bottone text-sm text-muted underline">
            Lo faccio dopo
          </button>
        )}
      </div>
    </Card>
  )
}
