import { useState, type ReactNode } from 'react'
import type { Motore } from '../domain/motore.ts'
import type { Giocatore } from '../domain/tipi.ts'
import { annullaSqualifica, importaIndisponibili, impostaSqualifiche, segnaIndisponibile, togliIndisponibile } from '../data/lega.ts'
import {
  daApplicare, etichettaMotivo, leggiFileIndisponibili, proponi, scegliOmonimo, STATI_VALIDI, type Proposta,
} from '../domain/indisponibili.ts'
import type { RigaRientro } from '../data/componi.ts'
import { righeDaFile } from '../lib/fogli.ts'
import { TitDot } from '../viste/segni.tsx'
import { Avviso, Bottone, Card } from '../ui.tsx'

type Ordine = 'ruolo' | 'da' | 'nome'
const CHIAVE_ORDINE = 'fantaregia:infermeria-ordine'
/* l'ordine della lista è una preferenza di chi guarda, su questo dispositivo */
function ordineSalvato(): Ordine {
  try { const v = localStorage.getItem(CHIAVE_ORDINE); return v === 'da' || v === 'nome' ? v : 'ruolo' } catch { return 'ruolo' }
}
const RO: Record<string, number> = { P: 0, D: 1, C: 2, A: 3 }

interface Riga { pid: number; p: Giocatore | null; tipo: 'inf' | 'squal'; da: number; ts: number; motivo?: string; nota?: string; n?: number; g?: number }

/* ══ Infermeria ══════════════════════════════════════════════════════
   renderInfermeria() dell'app a file singolo. Gli infortuni sono l'unica
   cosa che nessun file dà: si segnano a mano e cadono da soli appena il
   giocatore ricompare nei voti. Le squalifiche da cartellino le ricava il
   motore; il rosso resta a mano, perché le giornate le dà il giudice.  */
export default function Infermeria({ legaId, motore: m, puoScrivere, ricarica, notaMancante = false, rientri = [] }: {
  legaId: string; motore: Motore; puoScrivere: boolean; ricarica: () => void
  /** il database non ha ancora la colonna della nota: il file si carica, le note no */
  notaMancante?: boolean
  /** lo storico dei rientri, dal più recente */
  rientri?: RigaRientro[]
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
      const inf = (m.infoOut(pid) || {}) as { motivo?: string; da?: number; ts?: number; nota?: string }
      return { pid: +pid, p: nomeDi(+pid), tipo: 'inf' as const, da: inf.da || 0, ts: inf.ts || 0, motivo: inf.motivo, nota: inf.nota }
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
                      <span className="fr-filo-ruolo" data-ruolo={p.r} aria-hidden="true" />
                      <span className="ruolo-lettera">{p.r}</span>
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

      <Card titolo="Carica un file di indisponibili" azioni={<span className="hint">csv o xlsx · nome;stato;nota</span>}>
        {puoScrivere
          ? <CaricaIndisponibili legaId={legaId} m={m} g={g} notaMancante={notaMancante} ricarica={ricarica} onEsito={setEsito} />
          : <p className="hint">Il file lo caricano admin e banditori.</p>}
      </Card>

      <Card titolo="Chi non puoi schierare" azioni={<span className="hint">{totPrima ? <><b className="fr-num">{totPrima}</b> fuori</> : 'nessuno fuori'} · prossima giornata la <b className="fr-num">{g}ª</b></span>}>
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
              squalificato · salta la <b className="fr-num">{x.g}ª</b> <i>({x.n}ª ammonizione)</i>
            </RigaInf>
          )
          const quante = x.da ? Math.max(0, g - x.da) : 0
          return (
            <RigaInf key={`i${x.pid}`} p={x.p} pid={x.pid} tag="inf" nota={x.nota}
              azione={puoScrivere && <Bottone piccolo disabled={invio}
                onClick={() => void agisci(() => togliIndisponibile(legaId, x.pid), 'Rientrato fra i disponibili')}>È tornato</Bottone>}>
              {etichettaMotivo(x.motivo)}
              {x.da ? <> · fuori dalla <b className="fr-num">{x.da}ª</b>{quante ? <i> ({quante} giornat{quante === 1 ? 'a' : 'e'})</i> : <i> (da questa)</i>}</> : null}
            </RigaInf>
          )
        }) : totPrima ? <p className="hint">Nessuno corrisponde a «{filtro}».</p>
          : <p className="hint">Nessuno fuori. Gli infortunati li segni qui sopra; le squalifiche da cartellino le trova l'app da sola quando carichi i voti.</p>}
      </Card>

      {rientri.length > 0 && (
        <Card titolo="Rientrati di recente" azioni={<span className="hint">con le note di quando sono usciti e rientrati</span>}>
          {rientri.slice(0, 10).map((r, i) => (
            <RigaInf key={`${r.giocatore_id}-${r.rientrato_il}-${i}`} p={nomeDi(r.giocatore_id)} pid={r.giocatore_id} tag="rientro" nota={r.nota ?? undefined}>
              rientrato il {new Date(r.rientrato_il).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
              {r.motivo ? <> · era {etichettaMotivo(r.motivo)}{r.da_giornata ? <> dalla <b className="fr-num">{r.da_giornata}ª</b></> : null}</> : null}
              {r.nota_uscita && <i> ({r.nota_uscita})</i>}
            </RigaInf>
          ))}
        </Card>
      )}

      <div className="grid gap-[18px] lg:grid-cols-2">
        <Card titolo="Diffidati" azioni={<span className="hint">a un giallo dallo stop</span>}>
          {diffidati.length ? diffidati.map(x => (
            <RigaInf key={x.pid} p={nomeDi(x.pid)} pid={x.pid} tag="diff"><b className="fr-num">{x.amm}</b> ammonizioni — al prossimo giallo salta</RigaInf>
          )) : <p className="hint">Nessuno in diffida. Si diventa diffidati alla 4ª ammonizione, poi all'8ª, 12ª, 15ª, 17ª.</p>}
        </Card>
        <Card titolo="Da controllare" azioni={<span className="hint">espulsi: le giornate le dà il giudice</span>}>
          {rossi.length ? (
            <>
              {rossi.map(x => (
                <RigaInf key={x.pid} p={nomeDi(x.pid)} pid={x.pid} tag="rosso"
                  azione={puoScrivere && !m.isOut(x.pid) && <Bottone piccolo disabled={invio}
                    onClick={() => void agisci(() => segnaIndisponibile(legaId, x.pid, 'espulsione', g), 'Messo fuori')}>Mettilo fuori</Bottone>}>
                  espulso alla <b className="fr-num">{x.g}ª</b>
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

function RigaInf({ p, pid, tag, nota, azione, children }: { p: Giocatore | null; pid: number; tag: string; nota?: string; azione?: ReactNode; children: ReactNode }) {
  return (
    <div className="infrow">
      {p && <span className="fr-filo-ruolo" data-ruolo={p.r} aria-hidden="true" />}
      <span className="ruolo-lettera">{p ? p.r : '?'}</span>
      <span className="infn"><b>{p ? p.n : `#${pid}`}</b> <span className="pteam">{p?.s || ''}</span>
        {nota && <span className="infnota" title={nota}>{nota}</span>}</span>
      <span className={`inftag ${tag}`}>{children}</span>
      {azione || <span />}
    </div>
  )
}

/* ══ Il file degli indisponibili ═════════════════════════════════════
   Un csv o un xlsx con nome, stato e nota — quello che prepara ogni giorno
   la routine che cerca infortuni e squalifiche. Si carica, si guarda la
   proposta divisa per quello che succederà, e solo allora si conferma.
   Quello che non torna resta lì con la sua riga: un nome che non c'è, due
   giocatori con lo stesso nome (si sceglie qui), uno stato che non si capisce. */
function CaricaIndisponibili({ legaId, m, g, notaMancante, ricarica, onEsito }: {
  legaId: string; m: Motore; g: number; notaMancante: boolean; ricarica: () => void
  onEsito: (e: { tipo: 'ok' | 'errore'; testo: string } | null) => void
}) {
  const [file, setFile] = useState<string | null>(null)
  const [proposta, setProposta] = useState<Proposta | null>(null)
  const [invio, setInvio] = useState(false)

  // il listone, più chi è in rosa ma non c'è più: anche loro si infortunano
  const giocatori = [...m.PL, ...Object.keys(m.S.assign).map(pid => m.giocatoreDi(pid)).filter((p): p is Giocatore => !!p && !m.byId.has(p.id))]
  const fuoriOra = (pid: number) => {
    if (!m.S.out?.[pid]) return null
    const v = (m.infoOut(pid) || {}) as { motivo?: string; nota?: string }
    return { motivo: v.motivo, nota: v.nota }
  }

  async function leggi(f: File) {
    onEsito(null); setProposta(null)
    try {
      const voci = leggiFileIndisponibili(await righeDaFile(f, false))
      if (!voci.length) throw new Error('nel file non c\'è nessuna riga con un nome')
      setFile(f.name)
      setProposta(proponi(voci, giocatori, fuoriOra))
    } catch (e) { onEsito({ tipo: 'errore', testo: `${f.name}: ${(e as Error).message}` }) }
  }

  async function applica() {
    if (!proposta) return
    setInvio(true)
    try {
      const fuori = [
        ...proposta.entrano.map(x => ({ giocatore_id: x.pid, motivo: x.motivo, nota: x.nota, da_giornata: g })),
        // chi era già fuori tiene la giornata da cui lo è
        ...proposta.aggiornati.map(x => ({ giocatore_id: x.pid, motivo: x.motivo, nota: x.nota, da_giornata: (m.infoOut(x.pid) as { da?: number } | null)?.da || g })),
      ]
      const { storico } = await importaIndisponibili(legaId, fuori, proposta.rientrano.map(x => ({ giocatore_id: x.pid, nota: x.nota })), !notaMancante)
      const parti = [
        proposta.entrano.length && `${proposta.entrano.length} in infermeria`,
        proposta.aggiornati.length && `${proposta.aggiornati.length} aggiornati`,
        proposta.rientrano.length && `${proposta.rientrano.length} rientrati`,
      ].filter(Boolean)
      const mancano = [notaMancante && 'le note', !storico && proposta.rientrano.length && 'lo storico dei rientri'].filter(Boolean)
      onEsito({ tipo: 'ok', testo: `${file}: ${parti.join(', ')}.${mancano.length ? ` Non salvati ${mancano.join(' e ')}: manca la migrazione (npx supabase db push).` : ''}` })
      setProposta(null); setFile(null); ricarica()
    } catch (e) { onEsito({ tipo: 'errore', testo: (e as Error).message }) }
    setInvio(false)
  }

  if (!proposta) return (
    <>
      <p className="hint mb-[9px]">Una riga per giocatore: <b>nome;stato;nota</b>. Lo <b>stato</b> è uno di tre valori:
        {' '}<b>infortunio</b> o <b>squalifica</b> lo mettono fuori, <b>rientrato</b> lo rimette disponibile. La <b>nota</b> è facoltativa e resta
        in Infermeria, anche per i rientri. Prima di scrivere qualcosa ti faccio vedere chi entra, chi rientra e chi non ho riconosciuto.</p>
      <label className="fr-bottone inline-flex cursor-pointer items-center rounded-[7px] border border-line-strong bg-surface px-3.5 py-1.5 text-[13.5px] font-medium hover:border-accent hover:text-accent">
        Scegli il file
        <input type="file" className="hidden" accept=".csv,.txt,.xlsx,.xls"
          onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void leggi(f) }} />
      </label>
    </>
  )
  return <AnteprimaIndisponibili proposta={proposta} file={file} notaMancante={notaMancante} invio={invio}
    onScegli={(riga, p) => setProposta(scegliOmonimo(proposta, riga, p, fuoriOra))}
    onApplica={() => void applica()} onAnnulla={() => { setProposta(null); setFile(null) }} />
}

/** La proposta, divisa per quello che succederà. Esportata per i test di resa. */
export function AnteprimaIndisponibili({ proposta: pr, file, notaMancante, invio, onScegli, onApplica, onAnnulla }: {
  proposta: Proposta; file: string | null; notaMancante: boolean; invio: boolean
  onScegli: (riga: number, p: Giocatore) => void; onApplica: () => void; onAnnulla: () => void
}) {
  const n = daApplicare(pr)
  const gruppo = (titolo: string, quanti: number, figli: ReactNode, classe = '') => quanti > 0 && (
    <div className={`indgruppo ${classe}`}>
      <p className="indtitolo">{titolo} <b className="fr-num">{quanti}</b></p>
      {figli}
    </div>
  )
  const riga = (p: Giocatore, testo: ReactNode, chiave: string | number) => (
    <div key={chiave} className="indriga">
      <span className="fr-filo-ruolo" data-ruolo={p.r} aria-hidden="true" />
      <span className="indnome"><b>{p.n}</b> <span className="pteam">{p.s}</span></span>
      <span className="indcosa">{testo}</span>
    </div>
  )
  return (
    <div className="space-y-3">
      <p className="hint">{file ? <><b>{file}</b> · </> : null}{n ? `${n} ${n === 1 ? 'cambiamento' : 'cambiamenti'} da applicare` : 'niente da applicare'}</p>
      {notaMancante && (pr.entrano.some(x => x.nota) || pr.aggiornati.some(x => x.nota)) && (
        <Avviso tipo="attenzione">Le note non si possono ancora salvare: manca la migrazione <b>nota_indisponibili</b> (<code>npx supabase db push</code>).
          I giocatori vanno fuori lo stesso.</Avviso>
      )}

      {gruppo('Entrano in infermeria', pr.entrano.length, pr.entrano.map(x => riga(x.p,
        <>{etichettaMotivo(x.motivo)}{x.nota && <i> — {x.nota}</i>}</>, x.pid)))}
      {gruppo('Già fuori, cambiano motivo o nota', pr.aggiornati.length, pr.aggiornati.map(x => riga(x.p,
        <>{etichettaMotivo(x.motivo)}{x.nota && <i> — {x.nota}</i>}{x.prima.nota && x.prima.nota !== x.nota && <s className="indprima"> {x.prima.nota}</s>}</>, x.pid)))}
      {gruppo('Rientrano', pr.rientrano.length, pr.rientrano.map(x => riga(x.p, <>torna disponibile{x.nota && <i> — {x.nota}</i>}</>, x.pid)))}

      {gruppo('Più giocatori con questo nome: scegli chi è', pr.omonimi.length, pr.omonimi.map(v => (
        <div key={v.riga} className="indriga scelta">
          <span className="indnome"><b>{v.nome}</b> <span className="pteam">riga {v.riga} · {v.stato}</span></span>
          <span className="indscegli">
            {v.candidati.map(p => <Bottone key={p.id} piccolo onClick={() => onScegli(v.riga, p)}>{p.n} · {p.s}</Bottone>)}
          </span>
        </div>
      )), 'da-sistemare')}
      {gruppo('«Rientrato», ma non era fuori', pr.nonFuori.length, <>
        {pr.nonFuori.map(v => riga(v.p, <>riga {v.riga}{v.nota && <i> — {v.nota}</i>}</>, `nf${v.riga}`))}
        <p className="hint">Non risultano in infermeria: non c'è niente da togliere, e queste righe le ignoro.</p>
      </>)}
      {gruppo('Non riconosciuti', pr.nonTrovati.length, <>
        {pr.nonTrovati.map(v => (
          <div key={v.riga} className="indriga"><span className="indnome"><b>{v.nome}</b> <span className="pteam">riga {v.riga}</span></span>
            <span className="indcosa">{v.stato}</span></div>
        ))}
        <p className="hint">Nessun giocatore del listone con questo nome: se c'è, segnalo a mano con la ricerca qui sopra.</p>
      </>, 'da-sistemare')}
      {gruppo('Stato che non capisco', pr.statiIgnoti.length, <>
        {pr.statiIgnoti.map(v => (
          <div key={v.riga} className="indriga"><span className="indnome"><b>{v.nome}</b> <span className="pteam">riga {v.riga}</span></span>
            <span className="indcosa">«{v.stato || 'vuoto'}»</span></div>
        ))}
        <p className="hint">Gli stati validi sono {STATI_VALIDI.join(', ')}. Queste righe non le applico.</p>
      </>, 'da-sistemare')}
      {pr.invariati.length > 0 && (
        <p className="hint">Niente da fare per {pr.invariati.map(x => `${x.p.n} (${x.perche})`).join(', ')}.</p>
      )}

      <div className="flex flex-wrap gap-2">
        <Bottone variante="primario" disabled={!n || invio} onClick={onApplica}>{invio ? 'Applico…' : `Applica${n ? ` (${n})` : ''}`}</Bottone>
        <Bottone disabled={invio} onClick={onAnnulla}>Annulla</Bottone>
      </div>
    </div>
  )
}
