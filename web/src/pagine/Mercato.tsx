import { useState } from 'react'
import { ROLES, type Motore } from '../domain/motore.ts'
import type { Giocatore } from '../domain/tipi.ts'
import { annullaMovimento, registraScambio, registraSvincolo } from '../data/lega.ts'
import { TitDot, RigBadge } from '../viste/segni.tsx'
import { Avviso, Bottone, Card } from '../ui.tsx'

const RNOME: Record<string, [string, string]> = {
  P: ['i portieri', 'portiere'], D: ['i difensori', 'difensore'],
  C: ['i centrocampisti', 'centrocampista'], A: ['gli attaccanti', 'attaccante'],
}

/* ══ Mercato: scambi e svincoli ══════════════════════════════════════
   renderMercato() dell'app a file singolo. La giornata non è un dettaglio:
   i punti fatti prima restano a chi possedeva il giocatore allora, quindi
   il rendimento del passato non cambia. Uno scambio non muove i crediti di
   nessuno, anche fra giocatori che costavano molto diverso.            */
export default function Mercato({ legaId, motore: m, puoScrivere, ricarica }: {
  legaId: string; motore: Motore; puoScrivere: boolean; ricarica: () => void
}) {
  const squadre = m.S.teams
  const [modo, setModo] = useState<'scambio' | 'svincolo'>('scambio')
  const [scA, setScA] = useState(squadre[0]?.id ?? 0)
  const [scB, setScB] = useState(squadre[1]?.id ?? 0)
  const [scPA, setScPA] = useState(0)
  const [scPB, setScPB] = useState(0)
  const [scG, setScG] = useState(() => m.giornataOggi())
  const [svT, setSvT] = useState(squadre[0]?.id ?? 0)
  const [svOut, setSvOut] = useState(0)
  const [svQ, setSvQ] = useState('')
  const [svSel, setSvSel] = useState<Giocatore | null>(null)
  const [svR, setSvR] = useState(0)
  const [svC, setSvC] = useState(1)
  const [svG, setSvG] = useState(() => m.giornataOggi())
  const [esito, setEsito] = useState<{ tipo: 'ok' | 'errore'; testo: string } | null>(null)
  const [invio, setInvio] = useState(false)

  async function agisci(fare: () => Promise<void>, ok: string) {
    setInvio(true)
    try { await fare(); setEsito({ tipo: 'ok', testo: ok }); ricarica() } catch (e) { setEsito({ tipo: 'errore', testo: (e as Error).message }) }
    setInvio(false)
  }
  const rosaDi = (tid: number, ruolo?: string) =>
    ROLES.flatMap(r => m.roster(tid)[r].map(x => x.p)).filter(p => !ruolo || p.r === ruolo)

  /* ── scambio: scelta la prima squadra la seconda non può essere la stessa,
        e scelto il primo giocatore il secondo elenco si stringe al suo ruolo ── */
  const tb = scB && scB !== scA ? scB : (squadre.find(t => t.id !== scA)?.id ?? 0)
  const rosaA = rosaDi(scA), gA = scPA ? m.giocatoreDi(scPA) : null
  const rosaB = rosaDi(tb, gA?.r)
  const pa = rosaA.some(p => p.id === scPA) ? scPA : 0
  const pb = rosaB.some(p => p.id === scPB) ? scPB : 0
  const errScambio = pa && pb ? m.verificaScambio(pa, pb) : null

  /* ── svincolo ── */
  const rosaV = rosaDi(svT)
  const out = rosaV.some(p => p.id === svOut) ? svOut : 0
  const gOut = out ? m.giocatoreDi(out) : null
  // se nel frattempo è stato assegnato o ha cambiato ruolo, la scelta decade
  const dentro = svSel && !m.S.assign[svSel.id] && (!gOut || svSel.r === gOut.r) ? svSel : null
  const errSvincolo = out && dentro ? m.verificaSvincolo(svT, out, dentro.id) : null
  const residuo = svT ? m.stats(svT).left : 0
  const dopo = residuo + svR - svC
  const cerca = svQ.trim().toLowerCase()
  const liberi = cerca.length < 2 ? [] : m.PL
    .filter(p => !m.S.assign[p.id] && (!gOut || p.r === gOut.r) && (p.n.toLowerCase().includes(cerca) || (p.s || '').toLowerCase().includes(cerca)))
    .sort((a, b) => {
      const an = a.n.toLowerCase().startsWith(cerca) ? 0 : 1, bn = b.n.toLowerCase().startsWith(cerca) ? 0 : 1
      return an - bn || b.q - a.q || a.n.localeCompare(b.n)
    }).slice(0, 12)
  const rn = RNOME[gOut?.r ?? ''] ?? ['i giocatori', 'giocatore']

  const movimenti = m.moves().slice().reverse()
  const sceltaRosa = (tid: number, valore: number, set: (v: number) => void, ruolo?: string) => (
    <select value={valore} onChange={e => set(Number(e.target.value))} className="rounded-[7px] border border-line-strong bg-surface px-2 py-1.5 text-sm">
      <option value={0}>— scegli —</option>
      {rosaDi(tid, ruolo).map(p => <option key={p.id} value={p.id}>{p.n} · {p.r} {p.s || ''} — {m.prezzoDi(p.id)} cr</option>)}
    </select>
  )

  return (
    <div className="space-y-[18px]">
      {esito && <Avviso tipo={esito.tipo}>{esito.testo}</Avviso>}
      {!puoScrivere && <Avviso>Sei in sola lettura: vedi i movimenti registrati, ma non puoi registrarne di nuovi.</Avviso>}

      {puoScrivere && (
        <Card titolo="Registra un movimento">
          <div className="roleseg mb-3.5 w-fit">
            <button type="button" aria-pressed={modo === 'scambio'} onClick={() => setModo('scambio')}>Scambio fra squadre</button>
            <button type="button" aria-pressed={modo === 'svincolo'} onClick={() => setModo('svincolo')}>Svincolo e ripescaggio</button>
          </div>

          {modo === 'scambio' ? (
            <>
              <div className="mkgrid">
                <div className="mkside">
                  <span className="fl">Squadra</span>
                  <select value={scA} onChange={e => { setScA(Number(e.target.value)); setScPA(0) }} className="rounded-[7px] border border-line-strong bg-surface px-2 py-1.5 text-sm">
                    {squadre.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <span className="fl mt-2">Cede</span>
                  {sceltaRosa(scA, pa, v => { setScPA(v); setScPB(0) })}
                </div>
                <div className="mkvs">⇄</div>
                <div className="mkside">
                  <span className="fl">Squadra</span>
                  <select value={tb} onChange={e => { setScB(Number(e.target.value)); setScPB(0) }} className="rounded-[7px] border border-line-strong bg-surface px-2 py-1.5 text-sm">
                    {squadre.filter(t => t.id !== scA).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <span className="fl mt-2">Cede</span>
                  {sceltaRosa(tb, pb, setScPB, gA?.r)}
                </div>
              </div>
              <div className="mkfoot">
                <label className="block max-w-[150px]">
                  <span className="fl">Vale dalla giornata</span>
                  <input type="number" min={1} max={38} value={scG} onChange={e => setScG(parseInt(e.target.value) || 1)}
                    className="w-full rounded-[7px] border border-line-strong bg-surface px-2.5 py-1.5 text-sm" />
                </label>
                <div className="mkesito">
                  {!pa || !pb ? <span className="hint">Scegli i due giocatori.</span>
                    : errScambio ? <span className="mkno">{errScambio}</span>
                      : <span className="mkok">{m.giocatoreDi(pa)!.n} (<span className="fr-num">{m.prezzoDi(pa)}</span> cr) ⇄ {m.giocatoreDi(pb)!.n} (<span className="fr-num">{m.prezzoDi(pb)}</span> cr) · crediti invariati per entrambi</span>}
                </div>
                <Bottone variante="primario" disabled={invio || !pa || !pb || !!errScambio}
                  onClick={() => void agisci(() => registraScambio(legaId, pa, pb, scG), `Scambio registrato dalla giornata ${scG}`)}>Registra scambio</Bottone>
              </div>
            </>
          ) : (
            <>
              <div className="mkgrid">
                <div className="mkside">
                  <span className="fl">Squadra</span>
                  <select value={svT} onChange={e => { setSvT(Number(e.target.value)); setSvOut(0); setSvSel(null) }} className="rounded-[7px] border border-line-strong bg-surface px-2 py-1.5 text-sm">
                    {squadre.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <span className="fl mt-2">Svincola</span>
                  {sceltaRosa(svT, out, v => { setSvOut(v); setSvSel(null) })}
                  <label className="mt-2 block">
                    <span className="fl">Rimborso in crediti</span>
                    <input type="number" min={0} value={svR} onChange={e => setSvR(parseInt(e.target.value) || 0)}
                      className="w-full rounded-[7px] border border-line-strong bg-surface px-2.5 py-1.5 text-sm" />
                  </label>
                </div>
                <div className="mkvs">→</div>
                <div className="mkside">
                  <span className="fl">Prende fra gli svincolati</span>
                  <input type="text" value={svQ} onChange={e => setSvQ(e.target.value)} autoComplete="off" spellCheck={false}
                    placeholder={gOut ? `Cerca fra ${rn[0]} svincolati…` : 'Cerca per cognome o squadra…'}
                    className="w-full rounded-[7px] border border-line-strong bg-surface px-2.5 py-1.5 text-sm" />
                  {cerca.length >= 2 && (
                    <div className="infres">
                      {liberi.length ? liberi.map(p => (
                        <button key={p.id} type="button" onClick={() => { setSvSel(p); setSvQ('') }}>
                          <span className="fr-filo-ruolo" data-ruolo={p.r} aria-hidden="true" />
                          <span className="ruolo-lettera">{p.r}</span>
                          <span className="pnome"><b>{p.n}</b> <TitDot m={m} p={p} /><RigBadge m={m} p={p} /> <span className="pteam">{p.s}</span></span>
                          <span className="text-[12.5px] text-muted">q <span className="fr-num">{p.q}</span></span>
                        </button>
                      )) : <button type="button" disabled className="opacity-60">Nessun {rn[1]} svincolato con questo nome</button>}
                    </div>
                  )}
                  <div className="mkscelto">
                    {dentro ? (
                      <div className="mkpick">
                        <span className="fr-filo-ruolo" data-ruolo={dentro.r} aria-hidden="true" />
                        <span className="ruolo-lettera">{dentro.r}</span>
                        <span className="mkpn"><b>{dentro.n}</b> <span className="pteam">{dentro.s}</span> · q <span className="fr-num">{dentro.q}</span></span>
                        <Bottone piccolo onClick={() => setSvSel(null)}>Cambia</Bottone>
                      </div>
                    ) : <p className="hint mt-1.5">Nessuno scelto: digita almeno due lettere del cognome.</p>}
                  </div>
                  <label className="mt-2 block">
                    <span className="fl">Costo in crediti</span>
                    <input type="number" min={0} value={svC} onChange={e => setSvC(parseInt(e.target.value) || 0)}
                      className="w-full rounded-[7px] border border-line-strong bg-surface px-2.5 py-1.5 text-sm" />
                  </label>
                </div>
              </div>
              <div className="mkfoot">
                <label className="block max-w-[150px]">
                  <span className="fl">Vale dalla giornata</span>
                  <input type="number" min={1} max={38} value={svG} onChange={e => setSvG(parseInt(e.target.value) || 1)}
                    className="w-full rounded-[7px] border border-line-strong bg-surface px-2.5 py-1.5 text-sm" />
                </label>
                <div className="mkesito">
                  {!out || !dentro ? <span className="hint">Scegli chi esce e chi entra.</span>
                    : errSvincolo ? <span className="mkno">{errSvincolo}</span>
                      : <span className={dopo < 0 ? 'mkno' : 'mkok'}>crediti <span className="fr-num">{residuo}</span> → <b className="fr-num">{dopo}</b>{dopo < 0 ? ' — non bastano' : ''}</span>}
                </div>
                <Bottone variante="primario" disabled={invio || !out || !dentro || !!errSvincolo || dopo < 0}
                  onClick={() => void agisci(
                    () => registraSvincolo(legaId, svT, out, dentro!.id, svR, svC, svG, { id: dentro!.id, r: dentro!.r, n: dentro!.n, s: dentro!.s, q: dentro!.q }),
                    `Movimento registrato dalla giornata ${svG}`)}>Registra movimento</Bottone>
              </div>
            </>
          )}
          <p className="hint mt-3 max-w-[80ch]">La <b>giornata</b> non è un dettaglio: i punti fatti prima restano a chi possedeva il giocatore
            allora, quindi il rendimento del passato non cambia. Uno scambio non muove i crediti di nessuno, anche quando i due giocatori
            costavano molto diverso: il residuo che vedi resta quello vero.</p>
        </Card>
      )}

      <Card titolo="Movimenti registrati">
        {movimenti.length ? (
          <div className="mklist">
            {movimenti.map(mv => (
              <div key={mv.id} className="mkrow">
                <span className="mkg fr-num">g{mv.g}</span>
                <span className={`mktipo ${mv.tipo}`}>{mv.tipo}</span>
                <span className="mkchi">
                  {mv.voci.map(v => {
                    const g = m.giocatoreDi(v.pid)
                    return (
                      <span key={v.pid} className="mkmv">
                        {g?.r ?? '?'} · <b>{g?.n ?? '?'}</b> {v.da === null ? 'svincolati' : m.teamName(v.da)} → {v.a === null ? 'svincolati' : m.teamName(v.a)}
                      </span>
                    )
                  })}
                  <em>{new Date(mv.ts).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
                    {mv.tipo === 'svincolo' ? ` · rimborso ${mv.rimborso} cr, costo ${mv.costo} cr` : ''}</em>
                </span>
                {puoScrivere
                  ? <Bottone piccolo disabled={invio} onClick={() => void agisci(() => annullaMovimento(legaId, mv.id), 'Movimento annullato')}>Annulla</Bottone>
                  : <span />}
              </div>
            ))}
          </div>
        ) : <p className="hint">Nessun movimento registrato.</p>}
      </Card>
    </div>
  )
}
