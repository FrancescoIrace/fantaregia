import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { MODULI, ROLES, type Motore, type Rosa } from '../domain/motore.ts'
import {
  conModulo, descriviNota, generaFormazione, metti, normalizza, ordinaPerRuolo, sincronizzaPanchina, sposta, usati, vuota,
  type Formazione, type NotaFormazione,
} from '../domain/formazione.ts'
import { moduloPreferito, salvaModuloPreferito, salvaTitolariFissi, titolariFissi } from '../viste/preferenze-formazione.ts'
import type { Giocatore, Ruolo } from '../domain/tipi.ts'
import { miaSquadraDi, type RigheLega } from '../data/componi.ts'
import { salvaFormazioni } from '../data/lega.ts'
import { ABBR, appetCol, dataBreve, deltaCol, fmCol, segno } from '../viste/colori.ts'
import { Delta, FixStrip, OutBadge, RigBadge, TitDot } from '../viste/segni.tsx'
import { Avviso, Bottone, Card } from '../ui.tsx'
import PrevisioneRealta from './PrevisioneRealta.tsx'
import { useTelefono } from '../viste/telefono.ts'
import Campo from '../viste/Campo.tsx'

const REPARTI: [Ruolo, string][] = [['A', 'Attacco'], ['C', 'Centrocampo'], ['D', 'Difesa'], ['P', 'Porta']]
const NOME_REPARTO: Record<Ruolo, string> = { P: 'Porta', D: 'Difesa', C: 'Centrocampo', A: 'Attacco' }

/* ══ Formazioni ══════════════════════════════════════════════════════
   renderGiornata() dell'app a file singolo: il campo col modulo, una
   maglia per casella con il punteggio di giornata e la frase che lo
   spiega, la panchina in ordine d'ingresso, «Schiera la migliore».
   La formazione è privata: la vede solo chi la fa.                     */
export default function Formazioni({ legaId, utenteId, righe, motore: m, motorePrima, telefono: forzato }: {
  legaId: string; utenteId: string; righe: RigheLega; motore: Motore; motorePrima?: (g: number) => Motore
  /** per i test di resa, che girano fuori dal browser: altrimenti decide la larghezza */
  telefono?: boolean
}) {
  const larghezza = useTelefono()
  const telefono = forzato ?? larghezza
  const oggi = m.giornataOggi()
  const [g, setG] = useState(oggi)
  const [tutte, setTutte] = useState<Record<string, Formazione>>(() => (righe.preferenze?.formazioni ?? {}) as Record<string, Formazione>)
  const [casella, setCasella] = useState<{ r: Ruolo; i: number } | null>(null)
  const [stato, setStato] = useState<string | null>(null)
  // di chi guarda, su questo dispositivo: il modulo da cui partire e chi va sempre in campo
  const [preferito, setPreferito] = useState<string | null>(() => moduloPreferito(legaId))
  const [fissi, setFissi] = useState<number[]>(() => titolariFissi(legaId))
  const [note, setNote] = useState<{ g: number; note: NotaFormazione[] }>({ g: 0, note: [] })
  const attesa = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(attesa.current), [])

  const R = useMemo(() => m.roster(m.meId()), [m])
  const rosa = useMemo(() => ROLES.flatMap(r => R[r].map(x => x.p)), [R])
  // il punteggio di giornata si chiede decine di volte per giocatore: si calcola una volta per giornata
  const punteggi = useMemo(() => new Map(rosa.map(p => [p.id, m.dayScore(p, g)])), [m, g, rosa])
  const sc = (p: Giocatore) => punteggi.get(p.id) ?? m.dayScore(p, g)
  /* la stessa previsione una giornata prima: è il confronto che dà senso al
     numero («nessun numero senza la sua variazione»). Alla prima giornata
     non c'è, e il delta lascia lo spazio vuoto. */
  const punteggiPrima = useMemo(() => g > 1 ? new Map(rosa.map(p => [p.id, m.dayScore(p, g - 1)])) : null, [m, g, rosa])
  const scPrima = (p: Giocatore): number | null => punteggiPrima ? punteggiPrima.get(p.id) ?? m.dayScore(p, g - 1) : null
  const giocatore = (id: number): Giocatore | null => m.byId.get(id) ?? m.S.assign[id]?.snap ?? null
  // una giornata mai toccata parte dal modulo preferito; una già toccata tiene il suo
  const L0 = normalizza(tutte[g] ?? (preferito ? vuota(preferito) : undefined))
  const L: Formazione = { ...L0, bench: sincronizzaPanchina(L0, rosa, sc) }
  const dentro = usati(L)

  function cambia(nuova: Formazione, msg?: string) {
    const nuove = { ...tutte, [g]: nuova }
    setTutte(nuove); setStato(msg ?? 'salvo…')
    clearTimeout(attesa.current)
    attesa.current = setTimeout(() => {
      salvaFormazioni(legaId, utenteId, nuove).then(
        () => setStato('salvata'),
        (e: Error) => setStato(`non salvata: ${e.message}`),
      )
    }, 700)
  }

  /* «Schiera la migliore»: il modulo della giornata, prima i titolari fissi,
     poi il resto per punteggio. Quello che non torna lo dice, non lo scarta. */
  function schiera(mod = L.mod) {
    const { formazione, note: n } = generaFormazione(rosa, mod, { punteggio: sc, indisponibile: id => m.isOut(id), fissi })
    setNote({ g, note: n })
    cambia(formazione, `formazione proposta per la giornata ${g}`)
  }
  function cambiaFisso(pid: number) {
    const nuovi = fissi.includes(pid) ? fissi.filter(x => x !== pid) : [...fissi, pid]
    setFissi(nuovi)
    salvaTitolariFissi(legaId, nuovi)
  }
  const nomeDi = (id: number) => giocatore(id)?.n ?? `#${id}`

  const xi = ROLES.flatMap(r => L.start[r]).filter((x): x is number => !!x).map(giocatore).filter((p): p is Giocatore => !!p)
  const mancano = ROLES.reduce((n, r) => n + L.start[r].filter(x => !x).length, 0)
  const partita = (p: Giocatore) => m.fixtures(p.s, g, 1)[0]
  const difficolta = xi.length ? xi.reduce((a, p) => { const f = partita(p); return a + (f ? m.fixDiff(f.opp, m.isOff(p.r), f.home) : 3) }, 0) / xi.length : 0
  const inCasa = xi.filter(p => partita(p)?.home).length
  const ko = xi.filter(p => m.isOut(p.id)).length
  const media = xi.length ? Math.round(xi.reduce((a, p) => a + sc(p), 0) / xi.length) : null
  const mediaPrima = xi.length && g > 1 ? Math.round(xi.reduce((a, p) => a + (scPrima(p) ?? 0), 0) / xi.length) : null
  const spie = <>
    {mancano ? <span className="tag warn">{mancano} {mancano > 1 ? 'caselle vuote' : 'casella vuota'}</span>
      : L.bench.length ? <span className="tag ok">formazione completa</span> : null}
    {ko > 0 && <span className="tag crit">{ko} in campo {ko > 1 ? 'sono segnati indisponibili' : 'è segnato indisponibile'}</span>}
  </>
  // i disponibili di un reparto rimasti fuori dall'undici: chi potrebbe prendere il posto di un titolare
  const alternative = (r: Ruolo) => R[r].map(x => x.p).filter(x => !dentro.has(x.id) && !m.isOut(x.id))
  /* In panchina, sul telefono: la casella da scrivania diceva «↑ nome in
     panchina»; il disco del campo non ha lo spazio, quindi lo dice la riga di
     chi entrerebbe. Stessa soglia: più di quattro punti sopra un titolare. */
  const superaTitolare = (p: Giocatore) => !m.isOut(p.id)
    && L.start[p.r].some(id => { const q = id ? giocatore(id) : null; return !!q && sc(p) > sc(q) + 4 })

  return (
    <div>
      {/* vale anche la squadra di cui si è allenatore: a chi l'ha ricevuta
          dall'admin questo avviso diceva di sceglierla, e ce l'aveva già */}
      {!miaSquadraDi(righe, utenteId) && (
        <div className="mb-4">
          <Avviso>
            Non hai ancora scelto la tua squadra: fallo in <Link to={`/lega/${legaId}`} className="font-semibold underline">Panoramica</Link>.
            Intanto qui vedi la rosa di <b>{m.teamName(m.meId())}</b>.
          </Avviso>
        </div>
      )}
      {telefono && (
        <div className="m-formazione">
          <div className="m-fascia">
            <div className="m-selettore">
              <button type="button" disabled={g <= 1} onClick={() => setG(g - 1)} aria-label="Giornata precedente">‹</button>
              <div className="m-quale">
                <b>Giornata {g}</b>
                <em>{dataBreve(m.CAL.dates[g - 1])}{g === oggi && <> · <span className="oggi">oggi</span></>}</em>
              </div>
              <button type="button" disabled={g >= 38} onClick={() => setG(g + 1)} aria-label="Giornata successiva">›</button>
            </div>
          </div>
          {/* i sette moduli a portata di pollice: una tendina chiede due tocchi e copre il campo */}
          <div className="m-moduli" role="group" aria-label="Modulo della giornata">
            {Object.keys(MODULI).map(mod => (
              <button key={mod} type="button" aria-pressed={L.mod === mod} className="fr-num" onClick={() => cambia(conModulo(L, mod))}>{mod}</button>
            ))}
          </div>
          <div className="m-comandi">
            <Bottone variante="primario" disabled={!rosa.length} onClick={() => schiera()}>Schiera la migliore</Bottone>
            <Bottone onClick={() => cambia(vuota(L.mod))}>Svuota</Bottone>
          </div>
          <label className="m-preferito" title="Il modulo da cui partono le giornate che non hai ancora toccato. Cambiare modulo in una giornata non cambia la preferenza.">
            <span>Modulo preferito<em>da cui partono le giornate che non hai toccato</em></span>
            <select value={preferito ?? ''} className="m-select"
              onChange={e => { const v = e.target.value || null; setPreferito(v); salvaModuloPreferito(legaId, v) }}>
              <option value="">nessuno</option>
              {Object.keys(MODULI).map(mod => <option key={mod}>{mod}</option>)}
            </select>
          </label>
          <p className="m-spie">{spie}{stato && <span className="hint">{stato}</span>}</p>
        </div>
      )}
      {!telefono && <div className="gbar">
        <div className="gnav">
          <button type="button" disabled={g <= 1} onClick={() => setG(g - 1)} title="Giornata precedente">‹</button>
          <div className="gcur">
            <b>Giornata {g}</b>
            <span>{dataBreve(m.CAL.dates[g - 1])}{g === oggi && <> <span className="oggi">oggi</span></>}</span>
          </div>
          <button type="button" disabled={g >= 38} onClick={() => setG(g + 1)} title="Giornata successiva">›</button>
        </div>
        <label className="block min-w-[118px]">
          <span className="mb-1 block text-[11px] font-semibold tracking-wider text-muted uppercase">Modulo</span>
          <select value={L.mod} onChange={e => cambia(conModulo(L, e.target.value))}
            className="w-full rounded-[7px] border border-line-strong bg-surface px-2.5 py-1.5 text-sm">
            {Object.keys(MODULI).map(mod => <option key={mod}>{mod}</option>)}
          </select>
        </label>
        <label className="block min-w-[118px]" title="Il modulo da cui partono le giornate che non hai ancora toccato. Cambiare modulo in una giornata non cambia la preferenza.">
          <span className="mb-1 block text-[11px] font-semibold tracking-wider text-muted uppercase">Preferito</span>
          <select value={preferito ?? ''} className="w-full rounded-[7px] border border-line-strong bg-surface px-2.5 py-1.5 text-sm"
            onChange={e => { const v = e.target.value || null; setPreferito(v); salvaModuloPreferito(legaId, v) }}>
            <option value="">nessuno</option>
            {Object.keys(MODULI).map(mod => <option key={mod}>{mod}</option>)}
          </select>
        </label>
        <Bottone variante="primario" disabled={!rosa.length}
          onClick={() => schiera()}>Schiera la migliore</Bottone>
        <Bottone onClick={() => cambia(vuota(L.mod))}>Svuota</Bottone>
        <span className="ml-auto flex max-w-[40ch] flex-wrap items-center justify-end gap-1.5 text-right">
          {spie}
          {stato && <span className="hint w-full">{stato}</span>}
        </span>
      </div>}

      {note.g === g && note.note.length > 0 && (
        <div className="mb-4">
          <Avviso tipo="attenzione">
            {note.note.map((n, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <span>{descriviNota(n, nomeDi)}</span>
                {n.tipo === 'modulo-scoperto' && n.proposto && (
                  <Bottone piccolo onClick={() => schiera(n.proposto!)}>Usa il {n.proposto} per questa giornata</Bottone>
                )}
              </div>
            ))}
          </Avviso>
        </div>
      )}
      {!rosa.length ? (
        <Card>
          <div className="empty">
            La tua rosa è vuota.<br />Scegli la tua squadra in <b>Panoramica</b>: qui compariranno i suoi giocatori da schierare.
          </div>
        </Card>
      ) : (
        <>
          <div className="distinta">
            <Dato v={<>{xi.length}<span>/11</span></>} k="titolari" col={mancano ? 'var(--warn)' : 'var(--ok)'} />
            <Dato v={media ?? '—'} k="punteggio medio" col={media === null ? undefined : appetCol(media)}
              delta={media !== null && mediaPrima !== null ? <Delta ora={media} prima={mediaPrima} titolo="gli stessi undici, rispetto alla giornata prima" /> : undefined} />
            <Dato v={xi.length ? <>{difficolta.toFixed(1)}<span>/5</span></> : '—'} k="difficoltà del turno" />
            <Dato v={<>{inCasa}<span>/{xi.length || 11}</span></>} k="in casa" />
            {ko > 0 && <Dato v={ko} k="indisponibili in campo" col="var(--crit)" />}
          </div>

          {telefono ? (
            <>
              <div className="m-campo-guscio">
                <Campo m={m} g={g} L={L} giocatore={giocatore} sc={sc} fissi={fissi} alternative={alternative}
                  onApri={(r, i) => setCasella({ r, i })} />
              </div>
              <p className="m-legenda">
                Tocca un giocatore per cambiarlo: si apre il confronto con gli altri del reparto, ciascuno con il suo perché.
                Nel disco c'è il punteggio di giornata; il puntino vuol dire titolare fisso, la freccia che in panchina c'è di meglio,
                il bordo rosso che non può giocare.
              </p>
            </>
          ) : (
          <div className="campo">
            <div className="linee" aria-hidden="true">
              <span className="lmezzo" /><span className="lcerchio" /><span className="larea" /><span className="lareola" />
            </div>
            {REPARTI.map(([r, lab]) => (
              <div key={r} className="greparto">
                <div className="rowlab"><span>{lab}</span></div>
                <div className="prow" data-n={L.start[r].length}>
                  {L.start[r].map((id, i) => (
                    <CasellaCampo key={i} m={m} g={g} p={id ? giocatore(id) : null} sc={sc} scPrima={scPrima} fisso={!!id && fissi.includes(id)}
                      alternative={alternative(r)}
                      onApri={() => setCasella({ r, i })} />
                  ))}
                </div>
              </div>
            ))}
          </div>
          )}

          <div className="mt-[18px]">
            <Card denso titolo="Panchina" azioni={<>
              <span className="hint">nell'ordine in cui vuoi che entrino</span>
              {L.bench.length > 1 && (
                <Bottone piccolo title="Rimette in fila per reparto: portieri, difensori, centrocampisti, attaccanti"
                  onClick={() => cambia({ ...L, bench: ordinaPerRuolo(L.bench, id => giocatore(id)?.r, id => { const p = m.byId.get(id); return p ? sc(p) : 0 }) })}>
                  Ordina per ruolo
                </Bottone>
              )}
            </>}>
              <div className="benchlist">
                {L.bench.length ? L.bench.map((id, i) => {
                  const p = giocatore(id); if (!p) return null
                  const prima = i > 0 ? giocatore(L.bench[i - 1]) : null
                  const s = sc(p)
                  return (
                    <div key={id} className={`benchrow${prima && prima.r !== p.r ? ' reparto' : ''}`}>
                      <span className="fr-filo-ruolo" data-ruolo={p.r} aria-hidden="true" />
                      <span className="ord">{i + 1}</span>
                      <span className="ruolo-lettera">{p.r}</span>
                      <span className="bn">{p.n} <span className="pteam">{p.s}</span></span>
                      {telefono && superaTitolare(p) && <span className="m-supera">supera un titolare</span>}
                      <FixStrip m={m} team={p.s} r={p.r} from={g} span={1} />
                      <OutBadge m={m} p={p} />
                      <span className="dsc fr-num" style={{ color: appetCol(s), margin: 0 }}>{s}</span>
                      <Delta ora={s} prima={scPrima(p)} />
                      <button type="button" className={`fisso${fissi.includes(id) ? ' on' : ''}`} aria-pressed={fissi.includes(id)}
                        title="Titolare fisso: «Schiera la migliore» lo mette sempre in campo" onClick={() => cambiaFisso(id)}>fisso</button>
                      <button type="button" className="mv" title="Sali" disabled={i === 0} onClick={() => cambia({ ...L, bench: sposta(L.bench, i, -1) })}>▲</button>
                      <button type="button" className="mv" title="Scendi" disabled={i === L.bench.length - 1} onClick={() => cambia({ ...L, bench: sposta(L.bench, i, 1) })}>▼</button>
                    </div>
                  )
                }) : <div className="empty">Nessuno in panchina.</div>}
              </div>
            </Card>
          </div>
          <p className="hint mt-[11px] max-w-[76ch]">
            Le formazioni sono tue: nessuno degli altri partecipanti le vede. <b>Schiera la migliore</b> ordina i tuoi per valore
            corretto con la difficoltà della partita di giornata — partendo dal modulo della giornata e tenendo in campo i titolari fissi. È un punto di partenza, non il tuo ultimo giudizio.
          </p>
          {motorePrima && <div className="mt-[18px]"><PrevisioneRealta m={m} motorePrima={motorePrima} formazioni={tutte} /></div>}
        </>
      )}

      {casella && (
        <ChiSchierare m={m} g={g} L={L} R={R} casella={casella} sc={sc} scPrima={scPrima} fissi={fissi} onFisso={cambiaFisso}
          onChiudi={() => setCasella(null)}
          onScegli={pid => { cambia(metti(L, casella.r, casella.i, pid)); setCasella(null) }} />
      )}
    </div>
  )
}

/* .fr-num sta sul contenitore, non su uno span attorno al numero: in
   legacy.css «.dsv span» rende piccolo e grigio ogni span lì dentro (è il
   «/11»), e avvolgerci il numero lo spegnerebbe. */
function Dato({ v, k, col, delta }: { v: ReactNode; k: string; col?: string; delta?: ReactNode }) {
  return (
    <div className="dst">
      <div className="dsv fr-num" style={col ? { color: col } : undefined}>{v}{delta}</div>
      <div className="dsk">{k}</div>
    </div>
  )
}

/* La casella di una formazione (fantaregia-design.md, «Casella di formazione»).
   Il bordo superiore dice lo stato, il corpo porta il punteggio e la frase che
   lo spiega. Gli stati, in quest'ordine: indisponibile (costa punti, rosso);
   da rivedere (in panchina c'è chi fa più di quattro punti meglio: bordo
   d'inchiostro, una forma e non un colore); alta (dai 75 in su, la stessa
   soglia che colora i punteggi); neutra. Il titolare fisso ha il bordo scuro
   sugli altri tre lati, così lo stato in cima resta.
   Prima era una maglia oro, argento o bronzo: il numero bianco sulla sfumatura
   stava intorno ai 2:1 nel tema giorno. Scelta di Francesco, 16/09/2026. */
const SOGLIA_ALTA = 75

function CasellaCampo({ m, g, p, sc, scPrima, fisso, alternative, onApri }: {
  m: Motore; g: number; p: Giocatore | null; sc: (p: Giocatore) => number; scPrima: (p: Giocatore) => number | null; fisso: boolean; alternative: Giocatore[]; onApri: () => void
}) {
  if (!p) return (
    <button type="button" className="gslot vuoto" onClick={onApri}>
      <span className="gs-piu">+</span><span className="gs-vuoto">scegli</span>
    </button>
  )
  const s = sc(p), ko = m.isOut(p.id)
  const meglio = alternative.length ? alternative.reduce((a, x) => sc(x) > sc(a) ? x : a, alternative[0]) : null
  const su = !!meglio && sc(meglio) > s + 4
  const st = m.statFor(p.id), fo = m.formaOf(p.id, 3)
  const stato = ko ? 'ko' : su ? 'rivedere' : s >= SOGLIA_ALTA ? 'alta' : 'neutra'
  return (
    <button type="button" className={`casella ${stato}${fisso ? ' bloccata' : ''}`} onClick={onApri}>
      <span className="cas-testa">
        <span className="cas-nome">{p.n}{fisso && <span className="cas-fisso">fisso</span>}</span>
        <b className="fr-num cas-punti" style={{ color: appetCol(s) }}>{s}</b>
      </span>
      <span className="cas-sq">
        <span className="ruolo-lettera">{p.r}</span><TitDot m={m} p={p} /> {p.s}
        {m.rigOf(p) && <RigBadge m={m} p={p} />}{ko && <OutBadge m={m} p={p} />}
      </span>
      <span className="cas-stat">
        <FixStrip m={m} team={p.s} r={p.r} from={g} span={1} />
        <Delta ora={s} prima={scPrima(p)} />
        {st && st.pres ? <span className="gsv"><i>fm</i><b className="fr-num" style={{ color: fmCol(st.fm!) }}>{st.fm!.toFixed(1)}</b></span> : null}
        {fo && <span className="gsv"><i>for</i><b className="fr-num" style={{ color: deltaCol(fo.delta) }}>{segno(fo.delta)}</b></span>}
      </span>
      <span className="cas-why">{m.dayWhy(p, g)}</span>
      {su && meglio && <span className="cas-meglio">↑ {meglio.n} <span className="fr-num">{sc(meglio)}</span> in panchina</span>}
    </button>
  )
}

/* «Chi schierare»: i candidati per una casella, uno sotto l'altro, con il
   perché di ciascuno. Risponde alla domanda del sabato mattina. */
function ChiSchierare({ m, g, L, R, casella, sc, scPrima, fissi, onFisso, onChiudi, onScegli }: {
  m: Motore; g: number; L: Formazione; R: Rosa; casella: { r: Ruolo; i: number }
  sc: (p: Giocatore) => number; scPrima: (p: Giocatore) => number | null; fissi: number[]; onFisso: (pid: number) => void
  onChiudi: () => void; onScegli: (pid: number) => void
}) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onChiudi() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onChiudi])
  const { r, i } = casella
  const qui = L.start[r][i], occupati = usati(L)
  const cand = R[r].map(x => x.p).filter(p => p.id === qui || !occupati.has(p.id)).sort((a, b) => sc(b) - sc(a))
  return (
    <div className="modal on" onClick={e => { if (e.target === e.currentTarget) onChiudi() }}>
      <div className="pcard" role="dialog" aria-modal="true" aria-label="Chi schierare">
        <div className="phead">
          <div className="pid"><h3>Chi schierare</h3><div className="sub">{NOME_REPARTO[r]} · casella {i + 1} · giornata {g}</div></div>
          <button type="button" className="pclose" onClick={onChiudi} title="Chiudi" autoFocus>✕</button>
        </div>
        <div className="psec">
          <div className="cands">
            {cand.length ? cand.map(p => {
              const s = sc(p), f = m.fixtures(p.s, g, 1)[0], st = m.statFor(p.id), fo = m.formaOf(p.id, 3), ora = p.id === qui
              return (
                <div key={p.id} className={`cand${ora ? ' now' : ''}${m.isOut(p.id) ? ' ko' : ''}`}>
                  <div className="cn">
                    <span className="nm">{p.n}</span><TitDot m={m} p={p} /><RigBadge m={m} p={p} /><OutBadge m={m} p={p} />
                    <span className="pteam">{p.s}</span>{ora && <span className="tag ok">in campo</span>}
                    <button type="button" className={`fisso${fissi.includes(p.id) ? ' on' : ''}`} aria-pressed={fissi.includes(p.id)}
                      title="Titolare fisso: «Schiera la migliore» lo mette sempre in campo" onClick={() => onFisso(p.id)}>fisso</button>
                  </div>
                  <div className="cw">{m.dayWhy(p, g)}</div>
                  <div className="cf">
                    {f ? <span className={`fix d${Math.round(m.fixDiff(f.opp, m.isOff(p.r), f.home))}${f.home ? '' : ' away'}`}>{ABBR(f.opp)}</span>
                      : <span className="hint">riposa</span>}
                    {st && st.pres ? <span style={{ color: fmCol(st.fm!) }}>FM {st.fm!.toFixed(2)}</span> : null}
                    {fo && <span style={{ color: deltaCol(fo.delta) }}>{segno(fo.delta)}</span>}
                  </div>
                  <div className="cs fr-num" style={{ color: appetCol(s) }}>{s}<Delta ora={s} prima={scPrima(p)} /></div>
                  <Bottone piccolo className="btn" variante={ora ? 'normale' : 'primario'} disabled={ora} onClick={() => onScegli(p.id)}>
                    {ora ? 'già dentro' : 'Schiera'}
                  </Bottone>
                </div>
              )
            }) : <div className="empty">Nessun altro {NOME_REPARTO[r].toLowerCase()} disponibile in rosa.</div>}
          </div>
        </div>
        <div className="psec">
          <p className="hint">
            Il punteggio di giornata pesa titolarità, valore nel ruolo, avversario di quella partita, rigori e forma recente.
            È un consiglio, non un verdetto: se sai qualcosa che i numeri non sanno, vince quello che sai tu.
          </p>
        </div>
      </div>
    </div>
  )
}
