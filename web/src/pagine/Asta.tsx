import { useState, type FormEvent } from 'react'
import { ROLENAME, ROLES, type Motore } from '../domain/motore.ts'
import type { Giocatore } from '../domain/tipi.ts'
import { assegna, libera } from '../data/lega.ts'
import { appetCol } from '../viste/colori.ts'
import { FixStrip, MentChip, OutBadge, RigBadge, TitDot } from '../viste/segni.tsx'
import { Avviso, Bottone, Card, Ruolo as ChipRuolo } from '../ui.tsx'

const inflCol = (i: number) => i >= 0.12 ? 'var(--crit)' : i <= -0.12 ? 'var(--ok)' : 'var(--muted)'
const pressCol = (v: number) => v >= 1 ? 'var(--crit)' : v >= 0.6 ? 'var(--warn)' : 'var(--ok)'

/* ══ Asta live ═══════════════════════════════════════════════════════
   La console di chiamata dell'app a file singolo: cerchi, premi Invio,
   assegni. Mentre digiti il prezzo ti dice di quanto sei sopra il
   consigliato e quante alternative equivalenti restano libere. Tetto
   d'offerta e reparti pieni li applica il database, così la regola vale
   anche con più banditori insieme.                                     */
export default function Asta({ legaId, motore: m, puoScrivere, ricarica }: {
  legaId: string; motore: Motore; puoScrivere: boolean; ricarica: () => void
}) {
  const [q, setQ] = useState('')
  const [sel, setSel] = useState<number | null>(null)
  const [squadra, setSquadra] = useState(() => m.meId())
  const [prezzo, setPrezzo] = useState('')
  const [errore, setErrore] = useState<string | null>(null)
  const [invio, setInvio] = useState(false)

  const cerca = q.trim().toLowerCase()
  const trovati = cerca.length < 2 ? [] : m.PL
    .filter(p => p.n.toLowerCase().includes(cerca) || p.s.toLowerCase().includes(cerca))
    .sort((a, b) => {
      const an = a.n.toLowerCase().startsWith(cerca) ? 0 : 1, bn = b.n.toLowerCase().startsWith(cerca) ? 0 : 1
      return an - bn || (m.S.assign[a.id] ? 1 : 0) - (m.S.assign[b.id] ? 1 : 0) || b.q - a.q
    }).slice(0, 12)

  const p: Giocatore | null = sel !== null ? m.byId.get(sel) ?? null : null
  const scegli = (g: Giocatore) => { setSel(g.id); setQ(''); setErrore(null); setPrezzo(String(g.q)) }

  const me = m.meId(), mioStato = m.stats(squadra || me)
  const mercato = m.mercato()

  async function conferma(e: FormEvent) {
    e.preventDefault()
    if (!p) return
    const v = parseInt(prezzo)
    if (!(v >= 0)) { setErrore('Inserisci un prezzo valido'); return }
    setInvio(true); setErrore(null)
    try {
      await assegna(legaId, p.id, squadra, v, { id: p.id, r: p.r, n: p.n, s: p.s, q: p.q })
      setSel(null); setPrezzo(''); ricarica()
    } catch (err) { setErrore((err as Error).message) }
    setInvio(false)
  }
  const liberaGiocatore = (pid: number) => void libera(legaId, pid).then(() => { setSel(null); ricarica() }, (e: Error) => setErrore(e.message))

  return (
    <div className="space-y-[18px]">
      {errore && <Avviso tipo="errore">{errore}</Avviso>}
      {!puoScrivere && <Avviso>Stai guardando l'asta in sola lettura: vedi tutto aggiornarsi, ma le assegnazioni le registra chi ha il ruolo di banditore.</Avviso>}

      <Tabellone m={m} st={m.stats(me)} mercato={mercato} />

      <div className="astagrid">
        <div className="flex flex-col gap-[18px]">
          <Card titolo="Chiamata" azioni={<span className="hint">Cerca, premi Invio, assegna</span>}>
            {puoScrivere ? (
              <>
                <div className="searchbox">
                  <input type="text" value={q} onChange={e => setQ(e.target.value)} autoComplete="off" spellCheck={false}
                    placeholder="Nome giocatore o squadra…"
                    onKeyDown={e => { if (e.key === 'Enter' && trovati[0]) { e.preventDefault(); scegli(trovati[0]) } }}
                    className="w-full rounded-[7px] border border-line-strong bg-surface px-2.5 py-1.5 text-sm" />
                  {trovati.length > 0 && (
                    <div className="results">
                      {trovati.map(g => {
                        const a = m.S.assign[g.id]
                        return (
                          <button key={g.id} type="button" className={a ? 'gone' : ''} onClick={() => scegli(g)}>
                            <ChipRuolo r={g.r} />
                            <span className="min-w-0 flex-1"><b>{g.n}</b> <TitDot m={m} p={g} /><RigBadge m={m} p={g} /><OutBadge m={m} p={g} /> <span className="pteam">{g.s}</span></span>
                            <span className="mono text-[12.5px] text-muted">{g.q}</span>
                            {a && <span className="tag neu">{m.teamName(a.team)} {a.price}</span>}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
                {p ? <Chiamata m={m} p={p} squadra={squadra} setSquadra={setSquadra} prezzo={prezzo} setPrezzo={setPrezzo}
                  invio={invio} conferma={conferma} libera={liberaGiocatore} tetto={mioStato.max} />
                  : <p className="hint mt-3">Nessun giocatore selezionato. Digita almeno due lettere e premi Invio.</p>}
              </>
            ) : <p className="hint">La chiamata è riservata a chi registra l'asta.</p>}
          </Card>

          <Card titolo="Assegnazioni" denso azioni={<>
            <span className="hint mono">{Object.keys(m.S.assign).length} assegnati</span>
            {puoScrivere && m.S.log.length > 0 && <Bottone piccolo onClick={() => liberaGiocatore(m.S.log[0].pid)}>Annulla ultima</Bottone>}
          </>}>
            {m.S.log.length ? (
              <div className="log">
                {m.S.log.slice(0, 80).map(l => {
                  const g = m.byId.get(l.pid) ?? m.S.assign[l.pid]?.snap
                  if (!g) return null
                  const e = m.esitoPrezzo(l.pid, l.price)
                  return (
                    <div key={`${l.pid}-${l.t}`} className="logrow">
                      <ChipRuolo r={g.r} />
                      <span className="font-semibold">{g.n}</span><RigBadge m={m} p={g} />
                      <span className="who">→ {m.teamName(l.team)}{m.isMine(l.team) ? ' (io)' : ''}</span>
                      {e && <span className={`deal ${e.tipo === 'affare' ? 'ok' : 'bad'}`} title={`pagato ${l.price} contro un listino di ${e.atteso}`}>{e.tipo}</span>}
                      <span className="pr" style={{ color: l.price > g.q * 1.5 ? 'var(--warn)' : 'inherit' }}>{l.price}</span>
                      {puoScrivere && <button type="button" className="x" title="Libera" onClick={() => liberaGiocatore(l.pid)}>✕</button>}
                    </div>
                  )
                })}
              </div>
            ) : <div className="empty">L'asta non è ancora cominciata.</div>}
          </Card>
        </div>

        <div className="flex flex-col gap-[18px]">
          <Card titolo="Chi resta, chi cerca" azioni={<span className="hint">titolari liberi · squadre che li cercano</span>}>
            <Scarsita m={m} />
          </Card>
          <Card titolo="Crediti in sala" denso azioni={<span className="hint">residuo · max offerta</span>}>
            <div className="teamlist">
              {m.S.teams.map(t => {
                const st = m.stats(t.id)
                return (
                  <div key={t.id} className={`teamrow${m.isMine(t.id) ? ' me' : ''}`}>
                    <span className="tn">{t.name}{m.isMine(t.id) && <span className="tag neu"> io</span>}</span>
                    <span className="slots">{ROLES.map(r => (
                      <span key={r} className={`sq ${r}${st.perRole[r].count >= m.S.slots[r] ? ' full' : ''}`}>{st.perRole[r].count}/{m.S.slots[r]}</span>
                    ))}</span>
                    <span className="credits">{st.left}</span>
                    <span className="mono w-[34px] text-right text-[12px]" style={{ color: st.slotsLeft > 0 && st.max <= 2 ? 'var(--crit)' : 'inherit' }}>
                      {st.slotsLeft > 0 ? `·${st.max}` : '—'}</span>
                  </div>
                )
              })}
            </div>
          </Card>
          <Card titolo="La mia spesa per reparto">
            <div className="plan">
              {ROLES.map(r => {
                const st = m.stats(me)
                const target = Math.round(m.S.budget * m.S.plan[r] / 100), spesa = st.perRole[r].spent
                const scala = Math.max(target, spesa, 1) * 1.12
                const oltre = spesa > target
                return (
                  <div key={r} className="planrow">
                    <ChipRuolo r={r} />
                    <div className="track" title={`${ROLENAME[r]}: ${spesa} spesi su ${target} pianificati`}>
                      <div className="fill" style={{ width: `${Math.min(100, spesa / scala * 100)}%`, background: oltre ? 'var(--crit)' : `var(--r${r})`, opacity: .32 }} />
                      <div className="mark" style={{ left: `${Math.min(100, target / scala * 100)}%` }} />
                      <div className="lb">{spesa} / {target}</div>
                    </div>
                    <span className="mono text-right text-[12.5px]" style={{ color: oltre ? 'var(--crit)' : 'var(--muted)' }}>
                      {oltre ? `+${spesa - target}` : `${target - spesa} liberi`}</span>
                  </div>
                )
              })}
            </div>
          </Card>
          <Card titolo="Equilibrio della rosa" azioni={<span className="hint">chi spinge, chi copre</span>}>
            <Equilibrio m={m} />
          </Card>
        </div>
      </div>
    </div>
  )
}

function Tabellone({ m, st, mercato }: { m: Motore; st: ReturnType<Motore['stats']>; mercato: ReturnType<Motore['mercato']> }) {
  const stretto = st.slotsLeft > 0 && st.max <= Math.max(2, Math.round(m.S.budget * 0.02))
  return (
    <div className="gauges">
      <div className="gauge hi"><div className="lab">Crediti</div><div className="val">{st.left}</div><div className="sub">di {m.S.budget}</div></div>
      <div className={`gauge${stretto ? ' alarm' : ''}`}>
        <div className="lab">Max offerta</div><div className="val">{st.slotsLeft > 0 ? st.max : '—'}</div>
        <div className="sub">{st.slotsLeft} slot liberi</div>
      </div>
      {ROLES.map(r => {
        const c = st.perRole[r].count, tot = m.S.slots[r]
        const oltre = st.perRole[r].spent > Math.round(m.S.budget * m.S.plan[r] / 100)
        return (
          <div key={r} className={`gauge g${r}`}>
            <div className="lab">{r} · {st.perRole[r].spent}{oltre ? ' ⚠' : ''}</div>
            <div className="val">{c}<span className="text-[12px] opacity-50">/{tot}</span></div>
            <div className="slotbar">{Array.from({ length: tot }, (_, i) => <i key={i} className={i < c ? 'on' : ''} />)}</div>
          </div>
        )
      })}
      {mercato && (
        <div className={`gauge${Math.abs(mercato.infl) >= 0.12 ? (mercato.infl > 0 ? ' alarm' : ' good') : ''}`}
          title={`Finora la lega ha speso ${mercato.pagato} crediti per giocatori che di listino ne valevano ${mercato.atteso}`}>
          <div className="lab">Mercato</div>
          <div className="val" style={{ color: inflCol(mercato.infl) }}>
            {mercato.infl >= 0 ? '+' : '−'}{Math.abs(Math.round(mercato.infl * 100))}%</div>
          <div className="sub">{mercato.infl >= 0.12 ? 'si paga caro' : mercato.infl <= -0.12 ? 'si compra bene' : 'in linea'}</div>
        </div>
      )}
    </div>
  )
}

/* il giocatore scelto: quanto vale, quanto costa adesso, quanti come lui restano */
function Chiamata({ m, p, squadra, setSquadra, prezzo, setPrezzo, invio, conferma, libera: liberaG, tetto }: {
  m: Motore; p: Giocatore; squadra: number; setSquadra: (v: number) => void; prezzo: string; setPrezzo: (v: string) => void
  invio: boolean; conferma: (e: FormEvent) => void; libera: (pid: number) => void; tetto: number
}) {
  const a = m.S.assign[p.id]
  const from = m.giornataOggi(), span = 5
  const cs = m.calScore(p.s, p.r, from, span)
  const consigliato = m.attesaOra(p.id) || m.attesa(p.id)
  const v = parseInt(prezzo)
  const d = v >= 0 && consigliato ? v / consigliato - 1 : null
  const alt = m.alternative(p), sc = m.scarsita()[p.r]
  const st = m.stats(squadra)
  const repartoPieno = st.perRole[p.r].count >= m.S.slots[p.r]

  return (
    <>
      <div className="selected mt-3.5">
        <div className="selhead">
          <ChipRuolo r={p.r} />
          <div className="who">
            <div className="namewrap"><span className="big">{p.n}</span><RigBadge m={m} p={p} /><OutBadge m={m} p={p} /></div>
            <div className="sub"><TitDot m={m} p={p} /> <span title={m.titStato(p).nota}>{m.titStato(p).breve}</span> · {p.s}
              {p.rm && <> · <span className="rm">{p.rm}</span></>}<MentChip m={m} p={p} /></div>
          </div>
        </div>
        <div className="selstats">
          <div className="st"><div className="lab">Quotazione</div><div className="qv">{p.q}</div></div>
          <div className="st"><div className="lab">Prezzo atteso</div><div className="qv" style={{ color: 'var(--accent)' }}>{consigliato}</div></div>
          <div className="st"><div className="lab">Convenienza</div><div className="qv">{(p.v ?? 1).toFixed(2)}</div></div>
          <div className="st"><div className="lab">Appetibilità</div><div className="qv" style={{ color: appetCol(m.appet(p, from, span)) }}>{m.appet(p, from, span)}</div></div>
          {cs !== null && (
            <div className="st fix"><div className="lab">Prossime {span}</div>
              <div className="row"><FixStrip m={m} team={p.s} r={p.r} from={from} span={span} />
                <span className="calscore">{cs.toFixed(1)}</span></div></div>
          )}
        </div>
      </div>

      {a ? (
        <div className="suggest mt-3" style={{ border: '1px dashed var(--ink)', background: 'transparent' }}>
          Già assegnato a <b>{m.teamName(a.team)}</b> per <b>{a.price}</b> crediti.
          <Bottone piccolo className="ml-auto" onClick={() => liberaG(p.id)}>Libera</Bottone>
        </div>
      ) : (
        <form onSubmit={conferma}>
          <div className="assignrow">
            <label><span className="fl">Squadra</span>
              <select value={squadra} onChange={e => setSquadra(Number(e.target.value))}
                className="w-full rounded-[7px] border border-line-strong bg-surface px-2 py-1.5 text-sm">
                {m.S.teams.map(t => <option key={t.id} value={t.id}>{t.name}{m.isMine(t.id) ? ' (io)' : ''}</option>)}
              </select></label>
            <label><span className="fl">Prezzo</span>
              <input type="number" min={0} value={prezzo} onChange={e => setPrezzo(e.target.value)}
                className="w-full rounded-[7px] border border-line-strong bg-surface px-2.5 py-1.5 text-sm" /></label>
            <Bottone variante="primario" type="submit" disabled={invio}>Assegna</Bottone>
          </div>
          <div className="offerta">
            <div className="offbar">
              <span className="offlab">Consigliato ora</span>
              <b className="mono">{consigliato}</b>
              {d !== null && (
                <span className="offdelta" style={{ color: d >= 0.35 ? 'var(--crit)' : d >= 0.12 ? 'var(--warn)' : d <= -0.2 ? 'var(--ok)' : 'var(--muted)' }}>
                  {d >= 0 ? '+' : '−'}{Math.abs(Math.round(d * 100))}% · {d >= 0.35 ? 'stai strapagando' : d >= 0.12 ? 'sopra il suo prezzo' : d <= -0.2 ? 'lo stai prendendo bene' : 'in linea'}
                </span>
              )}
              {v > st.max && <span className="tag crit">oltre il tetto di {st.max}</span>}
            </div>
          </div>
          <div className={`altrow${alt.length <= 2 ? ' pochi' : ''}`}>
            <span>Come lui restano <b>{alt.length}</b></span>
            {alt.length > 0 && <span className="altnomi">{alt.slice(0, 3).map(x => x.n).join(', ')}{alt.length > 3 ? ` e altri ${alt.length - 3}` : ''}</span>}
            <span className="ml-auto">{p.r} titolari liberi <b>{sc.tit}</b> · cercati <b>{sc.domanda}</b></span>
          </div>
          <div className="suggest">
            <span>Il tuo tetto: <b>{tetto}</b></span>
            <span>{p.r} presi: <b>{st.perRole[p.r].count}/{m.S.slots[p.r]}</b>{repartoPieno && <span className="tag crit"> reparto pieno</span>}</span>
          </div>
        </form>
      )}
    </>
  )
}

/* verso la fine dell'asta i prezzi non li fa il valore, li fa quanti ne restano */
function Scarsita({ m }: { m: Motore }) {
  const sc = m.scarsita()
  return (
    <>
      <div className="scarsi">
        {ROLES.map(r => {
          const s = sc[r], larg = s.press === Infinity ? 100 : Math.max(4, Math.min(100, s.press / 2 * 100))
          const fasce = [s.fasce.top ? `${s.fasce.top} da oltre ${Math.round(0.08 * (m.S.budget || 500))}` : '',
            s.fasce.medio ? `${s.fasce.medio} di fascia media` : ''].filter(Boolean).join(' · ')
          return (
            <div key={r} className="scrow">
              <ChipRuolo r={r} />
              <div className="scmain">
                <div className="scnum"><b>{s.tit}</b> liber{s.tit === 1 ? 'o' : 'i'} <span className="sep">contro</span> <b>{s.domanda}</b> cercat{s.domanda === 1 ? 'o' : 'i'}
                  {!!s.mieiTit && <span className="mio" title="Titolari di questo ruolo che devi ancora prendere tu"> tu {s.mieiTit}</span>}</div>
                <div className="scbar"><span style={{ width: `${larg}%`, background: pressCol(s.press) }} /></div>
                <div className="scfa">{fasce || 'nessun titolare di valore rimasto'}</div>
              </div>
              <span className="scpress" style={{ color: pressCol(s.press) }}
                title="Quanti titolari servono ancora alle squadre per ogni titolare rimasto libero">
                {s.press === Infinity ? '—' : s.press.toFixed(1)}<small>{m.pressLab(s.press)}</small>
              </span>
            </div>
          )
        })}
      </div>
      <p className="hint mt-2.5">Sopra 1 ci sono più squadre a caccia che titolari rimasti: da lì in poi quel reparto si paga. Sotto 0,6 puoi aspettare.</p>
    </>
  )
}

/* quanto la rosa è sbilanciata fra chi spinge e chi copre (solo D e C) */
function Equilibrio({ m }: { m: Motore }) {
  const R = m.roster(m.meId())
  const righe = (['D', 'C'] as const).map(r => {
    const g = { off: 0, equ: 0, cop: 0 }
    for (const x of R[r]) { const l = m.mentLabel(x.p); if (l) g[l.k as keyof typeof g]++ }
    const n = g.off + g.equ + g.cop
    const poco = n >= 4 && g.off / n < 0.25
    return (
      <div key={r}>
        <div className="balrow">
          <ChipRuolo r={r} />
          <div className="balbar">
            {n ? (['off', 'equ', 'cop'] as const).map(k => g[k]
              ? <i key={k} className={k} style={{ flex: g[k] }} title={`${g[k]} ${k === 'off' ? 'offensivi' : k === 'equ' ? 'equilibrati' : 'di copertura'}`}>{g[k]}</i>
              : null) : <i className="none" />}
          </div>
          <span className="balnote" style={{ color: poco ? 'var(--warn)' : 'var(--muted)' }}>{n ? `${Math.round(g.off / n * 100)}% off` : '—'}</span>
        </div>
        {poco && <p className="hint ml-[37px]" style={{ color: 'var(--ink)', fontWeight: 600 }}>
          Solo {g.off} su {n} {r === 'D' ? 'difensori spingono' : 'centrocampisti spingono'}: rischi una rosa che prende pochi bonus.</p>}
      </div>
    )
  })
  const tot = R.D.length + R.C.length
  return (
    <div className="balance">
      {righe}
      <p className="hint">{tot
        ? <>La mentalità viene dal ruolo Mantra: <span className="ment off">offensiva</span> per ali, trequartisti ed esterni, <span className="ment cop">copertura</span> per centrali e mediani.</>
        : 'Qui vedrai quanto è sbilanciata la tua rosa fra chi spinge e chi copre, man mano che compri.'}</p>
    </div>
  )
}
