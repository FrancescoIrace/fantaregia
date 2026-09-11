import { useState, type ReactNode } from 'react'
import type { Motore } from '../domain/motore.ts'
import type { Giocatore } from '../domain/tipi.ts'
import { annullaSqualifica, impostaSqualifiche, segnaIndisponibile, togliIndisponibile } from '../data/lega.ts'
import { TitDot } from '../viste/segni.tsx'
import { Avviso, Bottone, Card, Ruolo as ChipRuolo } from '../ui.tsx'

type Ordine = 'ruolo' | 'da' | 'nome'
const CHIAVE_ORDINE = 'fantaregia:infermeria-ordine'
/* l'ordine della lista è una preferenza di chi guarda, su questo dispositivo */
function ordineSalvato(): Ordine {
  try { const v = localStorage.getItem(CHIAVE_ORDINE); return v === 'da' || v === 'nome' ? v : 'ruolo' } catch { return 'ruolo' }
}
const RO: Record<string, number> = { P: 0, D: 1, C: 2, A: 3 }

interface Riga { pid: number; p: Giocatore | null; tipo: 'inf' | 'squal'; da: number; ts: number; motivo?: string; n?: number; g?: number }

/* ══ Infermeria ══════════════════════════════════════════════════════
   renderInfermeria() dell'app a file singolo. Gli infortuni sono l'unica
   cosa che nessun file dà: si segnano a mano e cadono da soli appena il
   giocatore ricompare nei voti. Le squalifiche da cartellino le ricava il
   motore; il rosso resta a mano, perché le giornate le dà il giudice.  */
export default function Infermeria({ legaId, motore: m, puoScrivere, ricarica }: {
  legaId: string; motore: Motore; puoScrivere: boolean; ricarica: () => void
}) {
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState('')
  const [ordine, setOrdine] = useState<Ordine>(ordineSalvato)
  const [esito, setEsito] = useState<{ tipo: 'ok' | 'errore'; testo: string } | null>(null)
  const [invio, setInvio] = useState(false)

  async function agisci(fare: () => Promise<void>, ok: string) {
    setInvio(true)
    try { await fare(); setEsito({ tipo: 'ok', testo: ok }); ricarica() } catch (e) { setEsito({ tipo: 'errore', testo: (e as Error).message }) }
    setInvio(false)
  }
  const scegliOrdine = (o: Ordine) => { setOrdine(o); try { localStorage.setItem(CHIAVE_ORDINE, o) } catch { /* senza memoria locale resta per questa visita */ } }

  const g = m.nextG(), sq = m.squalifiche(), mio = m.meId()
  const nomeDi = (pid: number) => m.giocatoreDi(pid) ?? m.byId.get(pid) ?? null
  const manuali = Object.keys(m.S.out || {}).filter(k => m.S.out[k])
  // una riga sola per due cose diverse: l'infortunio comincia quando lo segni, la squalifica quando scatta
  let righe: Riga[] = [
    ...manuali.map(pid => {
      const inf = (m.infoOut(pid) || {}) as { motivo?: string; da?: number; ts?: number }
      return { pid: +pid, p: nomeDi(+pid), tipo: 'inf' as const, da: inf.da || 0, ts: inf.ts || 0, motivo: inf.motivo }
    }),
    ...sq.map(s => ({ pid: s.pid, p: nomeDi(s.pid), tipo: 'squal' as const, da: s.g, ts: 0, n: s.n, g: s.g })),
  ]
  const totPrima = righe.length
  const fn = filtro.trim().toLowerCase()
  if (fn) righe = righe.filter(x => x.p && ((x.p.n || '').toLowerCase().includes(fn) || (x.p.s || '').toLowerCase().includes(fn)))
  const perNome = (a: Riga, b: Riga) => (a.p?.n || '').localeCompare(b.p?.n || '')
  if (ordine === 'da') righe.sort((a, b) => a.da - b.da || a.ts - b.ts || perNome(a, b))
  else if (ordine === 'nome') righe.sort(perNome)
  else righe.sort((a, b) => (RO[a.p?.r ?? ''] ?? 9) - (RO[b.p?.r ?? ''] ?? 9) || a.da - b.da || perNome(a, b))

  // la ricerca per segnare un infortunato: prima i miei, sono quelli che interessa davvero mettere fuori
  const cerca = q.trim().toLowerCase()
  const trovati = cerca.length < 2 ? [] : m.PL
    .filter(p => !m.isOut(p.id) && (p.n.toLowerCase().includes(cerca) || (p.s || '').toLowerCase().includes(cerca)))
    .sort((a, b) => {
      const am = m.S.assign[a.id]?.team === mio ? 0 : 1, bm = m.S.assign[b.id]?.team === mio ? 0 : 1
      return am - bm || b.q - a.q || a.n.localeCompare(b.n)
    }).slice(0, 10)

  const diffidati = m.diffidati(), rossi = m.rossiDaVedere()

  return (
    <div className="space-y-[18px]">
      {esito && <Avviso tipo={esito.tipo}>{esito.testo}</Avviso>}

      <Card titolo="Segna un infortunato" azioni={<span className="hint">rientra da solo quando rigioca</span>}>
        <p className="hint mb-[9px]">Gli infortuni sono l'unica cosa che nessun file dà. Cerca il giocatore e mettilo fuori: sparisce dagli indici e
          dalla formazione automatica, e <b>rientra da solo</b> appena ricompare nei voti di una giornata. I tuoi vengono prima nei risultati.</p>
        {puoScrivere ? (
          <>
            <input type="text" value={q} onChange={e => setQ(e.target.value)} placeholder="Cerca per cognome o squadra — almeno due lettere" autoComplete="off"
              className="w-full rounded-[7px] border border-line-strong bg-surface px-2.5 py-1.5 text-sm" />
            {cerca.length >= 2 && (
              <div className="infres">
                {trovati.length ? trovati.map(p => {
                  const a = m.S.assign[p.id]
                  return (
                    <button key={p.id} type="button" disabled={invio}
                      onClick={() => { setQ(''); void agisci(() => segnaIndisponibile(legaId, p.id, 'infortunio', g), `${p.n} segnato indisponibile`) }}>
                      <ChipRuolo r={p.r} />
                      <span className="pnome"><b>{p.n}</b> <TitDot m={m} p={p} /> <span className="pteam">{p.s}</span></span>
                      <span className="mono whitespace-nowrap text-[12px]" style={{ color: a?.team === mio ? 'var(--accent)' : 'var(--muted)' }}>{a ? m.teamName(a.team) : 'svincolato'}</span>
                    </button>
                  )
                }) : <button type="button" disabled className="opacity-60">Nessun giocatore disponibile con questo nome</button>}
              </div>
            )}
          </>
        ) : <p className="hint">Gli infortunati li segnano admin e banditori.</p>}
      </Card>

      <Card titolo="Chi non puoi schierare" azioni={<span className="hint">{totPrima ? <><b>{totPrima}</b> fuori</> : 'nessuno fuori'} · prossima giornata la <b>{g}ª</b></span>}>
        {totPrima >= 2 && (
          <div className="infbar">
            <input type="text" value={filtro} onChange={e => setFiltro(e.target.value)} placeholder="Filtra la lista…" autoComplete="off"
              className="rounded-[7px] border border-line-strong bg-surface px-2.5 py-1.5 text-sm" />
            <div className="roleseg">
              {([['ruolo', 'Ruolo'], ['da', 'Da quando'], ['nome', 'Nome']] as const).map(([k, lab]) => (
                <button key={k} type="button" aria-pressed={ordine === k} onClick={() => scegliOrdine(k)}>{lab}</button>
              ))}
            </div>
          </div>
        )}
        {righe.length ? righe.map(x => {
          if (x.tipo === 'squal') return (
            <RigaInf key={`s${x.pid}-${x.g}`} p={x.p} pid={x.pid} tag="squal"
              azione={puoScrivere && <Bottone piccolo disabled={invio} title="La tua lega non applica questa squalifica"
                onClick={() => void agisci(() => annullaSqualifica(legaId, x.pid, x.g!), 'Squalifica annullata')}>Annulla</Bottone>}>
              squalificato · salta la <b>{x.g}ª</b> <i>({x.n}ª ammonizione)</i>
            </RigaInf>
          )
          const quante = x.da ? Math.max(0, g - x.da) : 0
          return (
            <RigaInf key={`i${x.pid}`} p={x.p} pid={x.pid} tag="inf"
              azione={puoScrivere && <Bottone piccolo disabled={invio}
                onClick={() => void agisci(() => togliIndisponibile(legaId, x.pid), 'Rientrato fra i disponibili')}>È tornato</Bottone>}>
              {x.motivo === 'espulsione' ? 'espulso' : 'infortunato'}
              {x.da ? <> · fuori dalla <b>{x.da}ª</b>{quante ? <i> ({quante} giornat{quante === 1 ? 'a' : 'e'})</i> : <i> (da questa)</i>}</> : null}
            </RigaInf>
          )
        }) : totPrima ? <p className="hint">Nessuno corrisponde a «{filtro}».</p>
          : <p className="hint">Nessuno fuori. Gli infortunati li segni qui sopra; le squalifiche da cartellino le trova l'app da sola quando carichi i voti.</p>}
      </Card>

      <div className="grid gap-[18px] lg:grid-cols-2">
        <Card titolo="Diffidati" azioni={<span className="hint">a un giallo dallo stop</span>}>
          {diffidati.length ? diffidati.map(x => (
            <RigaInf key={x.pid} p={nomeDi(x.pid)} pid={x.pid} tag="diff"><b>{x.amm}</b> ammonizioni — al prossimo giallo salta</RigaInf>
          )) : <p className="hint">Nessuno in diffida. Si diventa diffidati alla 4ª ammonizione, poi all'8ª, 12ª, 15ª, 17ª.</p>}
        </Card>
        <Card titolo="Da controllare" azioni={<span className="hint">espulsi: le giornate le dà il giudice</span>}>
          {rossi.length ? (
            <>
              {rossi.map(x => (
                <RigaInf key={x.pid} p={nomeDi(x.pid)} pid={x.pid} tag="rosso"
                  azione={puoScrivere && !m.isOut(x.pid) && <Bottone piccolo disabled={invio}
                    onClick={() => void agisci(() => segnaIndisponibile(legaId, x.pid, 'espulsione', g), 'Messo fuori')}>Mettilo fuori</Bottone>}>
                  espulso alla <b>{x.g}ª</b>
                </RigaInf>
              ))}
              <p className="hint mt-[9px]">Quante giornate lo decide il giudice sportivo il martedì: nessun file lo dice, quindi decidi tu. Se lo metti fuori
                rientrerà da solo appena rigioca.</p>
            </>
          ) : <p className="hint">Nessun espulso nell'ultima giornata caricata.</p>}
        </Card>
      </div>

      <details className="rounded-card border border-line bg-surface p-4 text-sm shadow-card">
        <summary className="cursor-pointer font-semibold">Come funzionano le squalifiche, e cosa l'app non può sapere</summary>
        <div className="mt-3 grid gap-4 md:grid-cols-3">
          <div>
            <h4 className="font-semibold">Le ammonizioni si sommano, non si contano di fila</h4>
            <p className="hint mt-1">In serie A la squalifica di una giornata scatta alla <b>5ª ammonizione</b> della stagione, poi alla 9ª, 13ª, 16ª, 18ª, e dalla
              19ª a ogni giallo. Due gialli nella <i>stessa</i> partita sono un'espulsione, e quei due non entrano nel conteggio verso la quinta.
              <b> Diffidato</b> è chi sta a un'ammonizione dalla soglia. Il conteggio si ricava dai voti che carichi, e si rifà da capo se togli una giornata.</p>
          </div>
          <div>
            <h4 className="font-semibold">Il rosso resta a mano</h4>
            <p className="hint mt-1">Un'espulsione vale da una giornata in su, ma quante lo decide il giudice sportivo il martedì: nessun file lo dice. L'app
              segnala chi è stato espulso nell'ultima giornata caricata e lascia decidere a te.</p>
          </div>
          <div>
            <h4 className="font-semibold">Se la tua lega non applica le squalifiche</h4>
            <p className="hint mt-1">Molte leghe ignorano le squalifiche di serie A. Se è il tuo caso puoi spegnere l'automatismo, oppure annullare la singola
              squalifica dal suo bottone.</p>
            <label className="mt-2 flex items-center gap-2">
              <input type="checkbox" checked={m.S.squalOn !== false} disabled={!puoScrivere || invio}
                onChange={e => { const on = e.target.checked; void agisci(() => impostaSqualifiche(legaId, on), on ? 'Squalifiche da cartellino attive' : 'Squalifiche da cartellino spente') }} />
              tieni conto delle squalifiche da cartellino
            </label>
          </div>
        </div>
      </details>
    </div>
  )
}

function RigaInf({ p, pid, tag, azione, children }: { p: Giocatore | null; pid: number; tag: string; azione?: ReactNode; children: ReactNode }) {
  return (
    <div className="infrow">
      {p ? <ChipRuolo r={p.r} /> : <span className="rm">?</span>}
      <span className="infn"><b>{p ? p.n : `#${pid}`}</b> <span className="pteam">{p?.s || ''}</span></span>
      <span className={`inftag ${tag}`}>{children}</span>
      {azione || <span />}
    </div>
  )
}
