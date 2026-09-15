import { useEffect, type ReactNode } from 'react'
import type { Motore, StatGiocatore, VoceSerie } from '../domain/motore.ts'
import type { Giocatore, Obiettivo } from '../domain/tipi.ts'
import { libera, segnaIndisponibile, togliIndisponibile } from '../data/lega.ts'
import { ABBR, appetCol, deltaCol, fmCol } from '../viste/colori.ts'
import { FixStrip, MentChip, OutBadge, RigBadge, Spark, TitDot } from '../viste/segni.tsx'
import { Bottone, Ruolo as ChipRuolo } from '../ui.tsx'

/* ══ La scheda del giocatore ═════════════════════════════════════════
   openPlayer() dell'app a file singolo: l'appetibilità con le sue voci,
   il prezzo atteso, il calendario, la stagione scorsa (che si guarda ma
   non entra in nessun indice), il rendimento di quest'anno e la giornata
   per giornata con i bonus come li conta il fantavoto.                 */
export default function Scheda({ m, id, legaId, puoScrivere, obiettivo, onObiettivo, onChiudi, ricarica, finestra }: {
  m: Motore; id: number; legaId: string; puoScrivere: boolean
  obiettivo: Obiettivo | undefined; onObiettivo: (o: Obiettivo | null) => void
  onChiudi: () => void; ricarica: () => void; finestra: { from: number; span: number }
}) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onChiudi() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onChiudi])

  // può arrivare dalla fotografia del momento dell'acquisto: lì ruolo Mantra,
  // FVM e convenienza non ci sono, e infatti nel tipo sono opzionali
  const p: Giocatore | undefined = m.byId.get(id) ?? m.S.assign[id]?.snap ?? undefined
  if (!p) return null
  const { from, span } = finestra
  const a = m.S.assign[p.id], sc = m.appet(p, from, span), parti = m.appetParts(p, from, span)
  const cs = m.calScore(p.s, p.r, from, span), st = m.statFor(p.id), f = m.formaOf(p.id)
  const ment = m.mentLabel(p), fuori = m.isOut(p.id)

  return (
    <div className="modal on" onClick={e => { if (e.target === e.currentTarget) onChiudi() }}>
      <div className="pcard" role="dialog" aria-modal="true" aria-label={p.n}>
        <div className="phead">
          <div className="povr"><div className="n" style={{ color: appetCol(sc) }}>{sc}</div><div className="l">Appetibilità</div></div>
          <div className="pid">
            <h3>{p.n}</h3>
            <div className="sub">
              <ChipRuolo r={p.r} /><TitDot m={m} p={p} /> <span title={m.titStato(p).nota}>{m.titStato(p).breve}</span>
              {' · '}{p.s}{p.rm ? <> · <span className="rm">{p.rm}</span></> : null}
              <RigBadge m={m} p={p} /><OutBadge m={m} p={p} />{ment && <MentChip m={m} p={p} />}
            </div>
          </div>
          <button type="button" className="pclose" onClick={onChiudi} title="Chiudi" aria-label="Chiudi" autoFocus>✕</button>
        </div>

        <div className="psec">
          <div className="pstats" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
            <Dato v={p.q} k="Quotazione" />
            <Dato v={p.f ?? 0} k="FVM" col="var(--muted)" />
            <Dato v={m.attesaOra(p.id) || m.attesa(p.id)} k="Prezzo atteso" col="var(--accent)" />
            <Dato v={(p.v ?? 1).toFixed(2)} k="Convenienza" col={(p.v ?? 1) >= 1.15 ? 'var(--ok)' : (p.v ?? 1) <= 0.85 ? 'var(--crit)' : 'var(--muted)'} />
          </div>
        </div>

        <div className="psec">
          <h5>Come nasce l'appetibilità</h5>
          <div className="brk">
            {parti.map(x => (
              <div key={x.k} className="brkrow">
                <span className="lab">{x.k}<small>{x.nota}</small></span>
                <div className="brkbar"><span style={{ width: `${Math.round(x.v / x.max * 100)}%`, background: x.v / x.max >= 0.7 ? 'var(--ok)' : x.v / x.max <= 0.3 ? 'var(--crit)' : 'var(--accent)' }} /></div>
                <span className="val">{Math.round(x.v)}<span style={{ opacity: .55 }}>/{x.max}</span></span>
              </div>
            ))}
          </div>
        </div>

        {cs !== null && (
          <div className="psec">
            <h5>Prossime {span} · dalla giornata {from}</h5>
            <div className="prow2">
              <FixStrip m={m} team={p.s} r={p.r} from={from} span={span} />
              <span className="calscore" style={{ color: cs >= 3.4 ? 'var(--ok)' : cs <= 2.75 ? 'var(--crit)' : 'var(--muted)' }}>{cs.toFixed(1)}</span>
              <span className="hint">5 = calendario morbido</span>
            </div>
          </div>
        )}

        <StagioneScorsa m={m} p={p} />

        {st && st.pres ? (
          <>
            <div className="psec">
              <h5>Rendimento · {st.su} {st.su === 1 ? 'giornata caricata' : 'giornate caricate'}</h5>
              <div className="pstats" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
                <Dato v={<>{st.pres}<span className="text-[12px] text-muted">/{st.su}</span></>} k="Presenze" />
                <Dato v={st.mv === null || st.mv === undefined ? '—' : st.mv.toFixed(2)} k="Media voto" />
                <Dato v={st.fm!.toFixed(2)} k="Fantamedia" col={fmCol(st.fm!)} />
                <Dato v={f ? <span style={{ color: deltaCol(f.delta) }}>{f.delta >= 0 ? '+' : ''}{f.delta.toFixed(1)}</span> : '—'} k="Forma" />
              </div>
              <div className="bonusgrid">
                <Tile n={st.gf!} k="Gol" cls="gol" />
                <Tile n={st.ass!} k="Assist" cls="ass" />
                {p.r === 'P' ? <>
                  <Tile n={st.cs!} k="Porta inviolata" cls="cs" />
                  <Tile n={st.rp!} k="Rigori parati" cls="par" />
                  <Tile n={st.sub!} k="Gol subiti" cls="mal" />
                </> : <>
                  <Tile n={st.amm!} k="Ammonizioni" cls="amm" />
                  <Tile n={st.esp! + st.au! + st.rs!} k="Esp. autogol rig." cls="mal" />
                </>}
              </div>
              <div className="exline">
                <span>Bonus per presenza <b style={{ color: st.bonus ? 'var(--ok)' : 'var(--muted)' }}>{st.bonus ? '+' + st.bonus.toFixed(2) : '0'}</b></span>
                <span>Malus <b style={{ color: st.malus ? 'var(--crit)' : 'var(--muted)' }}>{st.malus ? '−' + st.malus.toFixed(2) : '0'}</b></span>
                {st.scarto !== null && st.scarto !== undefined && (
                  <span title="Quanto la fantamedia si stacca dalla media voto: è il valore che porta oltre la pagella">
                    Scarto sulla pagella <b style={{ color: st.scarto >= 1 ? 'var(--ok)' : st.scarto <= -0.3 ? 'var(--crit)' : 'var(--muted)' }}>
                      {Math.abs(st.scarto) < 0.005 ? '0' : (st.scarto > 0 ? '+' : '') + st.scarto.toFixed(2)}</b>
                  </span>
                )}
                <span>Giornate con bonus <b>{st.conBonus}/{st.pres}</b></span>
                {st.sv ? <span>{st.sv} senza voto</span> : null}
              </div>
              {st.pres > 2 && <div className="exline mt-[7px]"><span>Andamento</span><span className="ml-auto"><Spark serie={st.serie} /></span></div>}
            </div>
            <Giornate m={m} p={p} st={st} />
          </>
        ) : st && st.su ? (
          <>
            <Giornate m={m} p={p} st={st} />
            <div className="psec"><p className="hint">Mai sceso in campo nelle giornate caricate.</p></div>
          </>
        ) : (
          <div className="psec"><h5>Rendimento</h5>
            <p className="hint">Nessun voto caricato. Da <b>Carica dati</b>, in Panoramica, compaiono presenze, medie, gol e assist.</p></div>
        )}

        <div className="pact">
          {puoScrivere && (
            <Bottone piccolo variante={fuori ? 'pericolo' : 'normale'}
              title="Toglilo dagli indici e dalla formazione automatica finché non torna"
              onClick={() => void (fuori ? togliIndisponibile(legaId, p.id) : segnaIndisponibile(legaId, p.id, 'infortunio', m.nextG())).then(ricarica)}>
              {fuori ? '↩ È tornato' : '⛑ Indisponibile'}
            </Bottone>
          )}
          {a ? (
            <>
              <span className="text-[13px]">Preso da <b>{m.teamName(a.team)}</b> per <b>{a.price}</b> crediti</span>
              {puoScrivere && <Bottone piccolo className="ml-auto" onClick={() => void libera(legaId, p.id).then(() => { ricarica(); onChiudi() })}>Libera</Bottone>}
            </>
          ) : (
            <>
              <span className="tag ok">svincolato</span>
              <Bottone piccolo onClick={() => onObiettivo(obiettivo ? null : { max: p.q })}>{obiettivo ? '★ Obiettivo' : '☆ Segna obiettivo'}</Bottone>
              <label className="hint flex items-center gap-1.5">max
                <input type="number" min={0} value={obiettivo?.max ?? ''} placeholder="—"
                  onChange={e => onObiettivo({ max: parseInt(e.target.value) || 0 })}
                  className="w-[78px] rounded-[7px] border border-line-strong bg-surface px-2 py-1 text-sm" />
              </label>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Dato({ v, k, col }: { v: ReactNode; k: string; col?: string }) {
  return <div className="pstat"><div className="v" style={col ? { color: col } : undefined}>{v}</div><div className="k">{k}</div></div>
}
function Tile({ n, k, cls }: { n: number; k: string; cls: string }) {
  return <div className={`btile ${cls}${n ? '' : ' off'}`}><div className="v">{n}</div><div className="k">{k}</div></div>
}

/* la stagione scorsa: numeri, non punteggi. Il mercato l'ha già prezzata
   (quotazione ↔ fantamedia 0,79 sugli attaccanti), quindi non entra negli
   indici; entrano solo le presenze, dentro la titolarità. */
function StagioneScorsa({ m, p }: { m: Motore; p: Giocatore }) {
  const h = m.annoScorso(p.id)
  if (!h) return (
    <div className="psec"><h5>Stagione 2025/26</h5>
      <p className="hint">Nessuna presenza in Serie A nel 2025/26: è un arrivo nuovo, o non ha giocato. Finché non arrivano i voti di
        quest'anno i suoi indici stanno tutti sulle quotazioni.</p></div>
  )
  const M = m.medieRuolo()[p.r], rk = m.rangoFm(p), nz = h.pv >= 15
  const cmp = (v: number, med: number | null | undefined, dec = 2) => {
    if (med === null || med === undefined) return null
    const d = v - med
    return <span className="hcmp" style={{ color: d >= 0 ? 'var(--ok)' : 'var(--crit)' }}
      title="rispetto alla mediana del suo ruolo, fra chi ha giocato almeno 15 partite">{d >= 0 ? '▲' : '▼'}{Math.abs(d).toFixed(dec)}</span>
  }
  const cambio = h.sq && h.sq !== p.s
  return (
    <div className="psec">
      <h5>Stagione 2025/26{cambio ? <span className="normal-case tracking-normal"> · era al {String(h.sq)}</span> : null}</h5>
      <div className="pstats" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <Dato v={<>{h.pv}<span className="text-[12px] text-muted">/38</span></>} k="Presenze" />
        <Dato v={h.mv.toFixed(2)} k="Media voto" />
        <Dato v={h.fm.toFixed(2)} k="Fantamedia" col={fmCol(h.fm)} />
        {p.r === 'P' ? <Dato v={h.gs} k="Gol subiti" /> : <Dato v={<>{h.gf}<span className="text-[13px] text-muted">+{h.ass}</span></>} k="Gol + assist" />}
      </div>
      <div className="exline">
        {nz && M.fm !== null && <span>Fantamedia sul ruolo {cmp(h.fm, M.fm)}{rk && <span className="hint"> {rk.pos}ª su {rk.su} con almeno 15 presenze</span>}</span>}
        <span>Bonus per presenza <b style={{ color: h.bonus ? 'var(--ok)' : 'var(--muted)' }}>{h.bonus ? '+' + h.bonus.toFixed(2) : '0'}</b>{nz && cmp(h.bonus, M.bonus)}</span>
        <span>Cartellini per presenza <b>{h.cart.toFixed(2)}</b>{nz && cmp(h.cart, M.cart)}</span>
        {p.r === 'P' && <span>Rigori parati <b style={{ color: h.rp ? 'var(--ok)' : 'var(--muted)' }}>{h.rp}</b></span>}
        {!!h.rc && <span>Rigori calciati <b>{h.rc}</b>{h.rmeno ? <span style={{ color: 'var(--crit)' }}> {h.rmeno} sbagliat{h.rmeno === 1 ? 'o' : 'i'}</span> : null}</span>}
        {!!h.au && <span style={{ color: 'var(--crit)' }}>{h.au} autogol</span>}
        {!!h.esp && <span style={{ color: 'var(--crit)' }}>{h.esp} espulsion{h.esp === 1 ? 'e' : 'i'}</span>}
      </div>
      {h.pv < 15 && <p className="hint mt-[9px]">Poche partite: questi numeri dicono poco.</p>}
    </div>
  )
}

/* giornata per giornata: voto, bonus ricevuti come li conta il fantavoto, fantavoto */
function Giornate({ m, p, st }: { m: Motore; p: Giocatore; st: StatGiocatore }) {
  const gs = m.giornateGiocate()
  const best = st.pres > 1 ? st.best : null
  return (
    <div className="psec">
      <h5>{st.su === 1 ? `Dati Giornata ${gs[0]}` : 'Dati giornata per giornata'}</h5>
      <div className="gdays">
        {gs.map((g, i) => {
          const e = st.serie[i]
          const fx = m.fixtures(p.s, g, 1)[0]
          const opp = fx ? `${fx.home ? '' : '@'}${ABBR(fx.opp)}` : '—'
          const tit = fx ? `Giornata ${g} — ${fx.home ? 'in casa contro' : 'in trasferta a'} ${fx.opp}` : `Giornata ${g}`
          if (!e) return (
            <div key={g} className="gdrow out">
              <span className="gnum">G{g}</span><span className="gopp" title={tit}>{opp}</span>
              <span className="gv sv">—</span>
              <span className="gchips"><span className="bchip nil">non ha giocato</span></span>
              <span className="gfv text-muted">—</span>
            </div>
          )
          const top = !!best && e.g === best.g
          return (
            <div key={g} className={`gdrow${top ? ' top' : ''}`} title={top ? 'La sua giornata migliore fra quelle caricate' : undefined}>
              <span className="gnum">G{g}{top && <span className="gstar"> ★</span>}</span>
              <span className="gopp" title={tit}>{opp}</span>
              <span className={`gv${e.sv ? ' sv' : ''}`}>{e.sv ? 's.v.' : e.v.toFixed(1).replace('.', ',')}<small>voto</small></span>
              <span className="gchips"><Bonus e={e} r={p.r} /></span>
              <span className="gfv" style={{ color: fmCol(e.fv) }}>{e.fv.toFixed(1).replace('.', ',')}<small>fantavoto</small></span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Bonus({ e, r }: { e: VoceSerie; r: string }) {
  const c: ReactNode[] = []
  const chip = (k: string, cls: string, testo: string, val?: string) => c.push(<span key={k} className={`bchip ${cls}`}>{testo}{val && <> <b>{val}</b></>}</span>)
  if (e.gf) chip('gf', 'pos', e.gf > 1 ? `${e.gf} gol` : 'Gol', `+${3 * e.gf}`)
  if (e.ass) chip('ass', 'ast', e.ass > 1 ? `${e.ass} assist` : 'Assist', `+${e.ass}`)
  if (e.rp) chip('rp', 'pos', e.rp > 1 ? `${e.rp} rig. parati` : 'Rigore parato', `+${3 * e.rp}`)
  if (r === 'P' && !e.sv && !e.sub) chip('cs', 'neu', 'Porta inviolata')
  if (r === 'P' && e.sub) chip('sub', 'neg', e.sub > 1 ? `${e.sub} gol subiti` : 'Gol subito', `−${e.sub}`)
  if (e.rs) chip('rs', 'neg', e.rs > 1 ? `${e.rs} rig. sbagliati` : 'Rigore sbagliato', `−${3 * e.rs}`)
  if (e.au) chip('au', 'neg', e.au > 1 ? `${e.au} autogol` : 'Autogol', `−${2 * e.au}`)
  if (e.amm) chip('amm', 'neu', 'Ammonito', `−${(0.5 * e.amm).toFixed(1).replace('.', ',')}`)
  if (e.esp) chip('esp', 'neg', 'Espulso', `−${e.esp}`)
  if (!c.length) chip('nil', 'nil', 'nessun bonus')
  return <>{c}</>
}
