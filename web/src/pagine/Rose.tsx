import { useState } from 'react'
import { createPortal } from 'react-dom'
import { ROLENAME, ROLES, type Motore } from '../domain/motore.ts'
import { righeRiepilogo, righeRose } from '../domain/riepilogo.ts'
import { libera } from '../data/lega.ts'
import { scaricaCartella } from '../lib/fogli.ts'
import { OutBadge, RigBadge } from '../viste/segni.tsx'
import { Avviso, Bottone, Card } from '../ui.tsx'
import Scheda from './Scheda.tsx'

const votoCol = (v: number) => v >= 70 ? 'var(--ok)' : v >= 55 ? 'var(--warn)' : 'var(--crit)'
const CHIAVE_CHIUSE = 'fantaregia:rose-chiuse'
/* quali rose sono chiuse è una preferenza di chi guarda, su questo dispositivo */
function chiuseSalvate(): Record<string, 1> {
  try { return JSON.parse(localStorage.getItem(CHIAVE_CHIUSE) || '{}') as Record<string, 1> } catch { return {} }
}

/* ══ Rose ════════════════════════════════════════════════════════════
   renderRiepilogo() e renderRose() dell'app a file singolo: la classifica
   dei giudizi, e le rose di tutti richiudibili con una ricerca che apre
   da sola quelle con un riscontro. Il voto non viene da un modello
   linguistico: nasce dagli stessi indici usati in asta, e sotto ogni rosa
   c'è il dettaglio voce per voce.                                      */
export default function Rose({ legaId, motore: m, puoScrivere, ricarica }: {
  legaId: string; motore: Motore; puoScrivere: boolean; ricarica: () => void
}) {
  const [q, setQ] = useState('')
  const [chiuse, setChiuse] = useState<Record<string, 1>>(chiuseSalvate)
  const [aperto, setAperto] = useState<number | null>(null)
  const [esito, setEsito] = useState<string | null>(null)
  const finestra = { from: m.giornataOggi(), span: 5 }

  const salvaChiuse = (nuove: Record<string, 1>) => {
    setChiuse(nuove)
    try { localStorage.setItem(CHIAVE_CHIUSE, JSON.stringify(nuove)) } catch { /* senza memoria locale vale per questa visita */ }
  }
  const tutte = (aperte: boolean) => salvaChiuse(aperte ? {} : Object.fromEntries(m.S.teams.map(t => [t.id, 1 as const])))

  const cerca = q.trim().toLowerCase()
  const trova = (n: string, s: string) => n.toLowerCase().includes(cerca) || s.toLowerCase().includes(cerca)
  const giudizi = m.giudizi()
  const presi = Object.keys(m.S.assign).length
  const slotTot = m.totalSlots() * m.S.teams.length

  async function excel() {
    setEsito(null)
    try {
      await scaricaCartella([
        { nome: 'Riepilogo', righe: righeRiepilogo(m) },
        { nome: 'Rose', righe: righeRose(m, finestra) },
      ], `riepilogo-asta-${new Date().toISOString().slice(0, 10)}.xlsx`)
    } catch (e) { setEsito(`Non riesco a creare il file Excel: ${(e as Error).message}`) }
  }

  return (
    <div className="space-y-[18px]">
      {esito && <Avviso tipo="errore">{esito}</Avviso>}

      <Card titolo="Riepilogo asta" azioni={<>
        {presi > 0 && <span className="hint">{presi} giocatori su {slotTot} · {m.S.teams.length} squadre · {m.S.budget} crediti a testa</span>}
        <Bottone piccolo disabled={!presi} onClick={() => void excel()}>Scarica in Excel</Bottone>
        <Bottone piccolo disabled={!presi} onClick={() => window.print()}>Stampa o salva in PDF</Bottone>
      </>}>
        {!giudizi.length || !presi ? (
          <div className="empty">L'asta non è ancora cominciata: qui comparirà il riepilogo con il giudizio di ogni rosa.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="list riep">
                <thead><tr>
                  <th className="w-[34px]">#</th><th>Squadra</th>
                  <th className="num w-[74px]">Spesa</th><th className="num w-[64px]">Resta</th>
                  <th className="num w-[150px]">P · D · C · A</th>
                  <th className="num w-[104px]" title="Quanto ha speso rispetto alla media della lega, a parità di valore comprato">Speso vs media</th>
                  <th className="num w-[74px]">Undici</th><th className="num w-[74px]">Titolari</th><th className="num w-[78px]">Voto</th>
                </tr></thead>
                <tbody>
                  {giudizi.map((x, i) => {
                    const st = m.stats(x.t.id), g = x.g, d = 1 / g.resa - 1
                    return (
                      <tr key={x.t.id} className={m.isMine(x.t.id) ? 'mine' : undefined}>
                        <td className="text-muted fr-num">{i + 1}</td>
                        <td><b>{x.t.name}</b>{m.isMine(x.t.id) && <span className="tag neu"> io</span>}
                          <div className="pteam">{g.mod} · {g.n} giocatori</div></td>
                        <td className="num fr-num">{st.spent}</td>
                        <td className="num text-muted fr-num">{st.left}</td>
                        {/* l'ordine dei ruoli lo dice l'intestazione: i colori di ruolo non vanno sul testo (regola 3 dei token) */}
                        <td className="num text-[12px] fr-num">{ROLES.map((r, k) => (
                          <span key={r}>{k > 0 && ' · '}{g.dev[r].reale}</span>
                        ))}</td>
                        <td className="num fr-num" style={{ color: d <= -0.05 ? 'var(--ok)' : d >= 0.05 ? 'var(--crit)' : 'var(--muted)' }}>
                          {d >= 0 ? '+' : '−'}{Math.abs(Math.round(d * 100))}%</td>
                        <td className="num fr-num">{g.media.toFixed(0)}</td>
                        <td className="num fr-num">{g.titolari}</td>
                        <td className="num"><b className="text-base fr-num" style={{ color: votoCol(g.voto) }}>{g.voto}</b></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="hint mt-2.5">Il voto non viene da un modello linguistico, ma dagli stessi indici che hai usato in asta: undici tipo 40,
              profondità 15, prezzi pagati 20, titolari veri 15, rigoristi 5, rischi 5. Sotto ogni rosa c'è il dettaglio, voce per voce.</p>
          </>
        )}
      </Card>

      <div className="flex flex-wrap items-end gap-3">
        <label className="block min-w-[220px] flex-1">
          <span className="fl">Cerca nelle rose</span>
          <input type="text" value={q} onChange={e => setQ(e.target.value)} autoComplete="off" spellCheck={false}
            placeholder="Giocatore, squadra di A o partecipante…"
            className="w-full rounded-[7px] border border-line-strong bg-surface px-2.5 py-1.5 text-sm" />
        </label>
        <div className="flex gap-2 pb-0.5">
          <Bottone piccolo onClick={() => tutte(true)}>Apri tutte</Bottone>
          <Bottone piccolo onClick={() => tutte(false)}>Chiudi tutte</Bottone>
        </div>
        <span className="hint ml-auto pb-2">{m.S.teams.length} rose · {presi} giocatori assegnati</span>
      </div>

      <div className="rosegrid">
        {m.S.teams.map(t => {
          const st = m.stats(t.id), g = m.giudizio(t.id)
          const perNome = !!cerca && t.name.toLowerCase().includes(cerca)
          let match = 0
          const sezioni = ROLES.map(r => {
            const tutti = st.R[r]
            const lista = cerca && !perNome ? tutti.filter(x => trova(x.p.n, x.p.s)) : tutti
            if (cerca) match += perNome ? tutti.length : lista.length
            const buchi = m.S.slots[r] - tutti.length
            if (cerca && !lista.length) return null
            return (
              <div key={r} className="rosesec">
                <div className="sh"><span>{ROLENAME[r]}</span><span className="fr-num">{st.perRole[r].spent} cr</span></div>
                {lista.map(x => (
                  <div key={x.p.id} className={`rp${cerca && trova(x.p.n, x.p.s) ? ' trovato' : ''}`}>
                    <span className="fr-filo-ruolo" data-ruolo={r} aria-hidden="true" />
                    <span className="ruolo-lettera">{r}</span>
                    <button type="button" className="nm pname clic" onClick={() => setAperto(x.p.id)}>{x.p.n}</button>
                    <RigBadge m={m} p={x.p} /><OutBadge m={m} p={x.p} />
                    <span className="pteam text-[11px]">{x.p.s}</span>
                    <span className="pz fr-num">{x.price}</span>
                    {puoScrivere && <button type="button" className="x" title="Libera"
                      onClick={() => void libera(legaId, x.p.id).then(ricarica, (e: Error) => setEsito(e.message))}>✕</button>}
                  </div>
                ))}
                {!cerca && buchi > 0 && <div className="rp hole">{buchi} slot da riempire</div>}
              </div>
            )
          })
          if (cerca && !match) return null
          const aperta = cerca ? true : !chiuse[t.id]
          return (
            <details key={t.id} className="rosecard card" open={aperta}
              onToggle={e => { if (cerca) return; const nuove = { ...chiuse }; if ((e.target as HTMLDetailsElement).open) delete nuove[t.id]; else nuove[t.id] = 1; salvaChiuse(nuove) }}
              style={m.isMine(t.id) ? { borderColor: 'var(--accent)' } : undefined}>
              <summary className="rosehead">
                <span className="tw" aria-hidden="true">▸</span>
                <h3>{t.name}</h3>
                {m.isMine(t.id) && <span className="tag neu">io</span>}
                {!!cerca && <span className="tag ok">{match} {match === 1 ? 'trovato' : 'trovati'}</span>}
                {g && <span className="voto fr-num" style={{ color: votoCol(g.voto) }} title="Il voto della rosa">{g.voto}</span>}
                <span className="font-semibold fr-num">{st.left}</span>
              </summary>
              <div className="roseb">
                {sezioni}
                {!cerca && g && (
                  <div className="giud">
                    <div className="gh">Giudizio <b className="fr-num" style={{ color: votoCol(g.voto) }}>{g.voto}</b>
                      <span className="hint ml-auto">{g.mod} · undici da {g.media.toFixed(0)}</span></div>
                    <div className="gparts">
                      {g.parti.map(x => (
                        <div key={x.k} className="gpart" title={x.nota}>
                          <div className="gpl">{x.k}</div>
                          <div className="gpb"><span style={{ width: `${Math.round(x.v / x.max * 100)}%`, background: x.v / x.max >= 0.7 ? 'var(--ok)' : x.v / x.max <= 0.3 ? 'var(--crit)' : 'var(--accent)' }} /></div>
                          <div className="gpv fr-num">{Math.round(x.v)}<span style={{ opacity: .5 }}>/{x.max}</span></div>
                        </div>
                      ))}
                    </div>
                    {g.pro.length > 0 && <ul className="glist pro">{g.pro.map(x => <li key={x}>{x}</li>)}</ul>}
                    {g.contro.length > 0 && <ul className="glist contro">{g.contro.map(x => <li key={x}>{x}</li>)}</ul>}
                  </div>
                )}
              </div>
            </details>
          )
        })}
      </div>

      <Stampa m={m} />

      {aperto !== null && (
        <Scheda m={m} id={aperto} legaId={legaId} puoScrivere={puoScrivere} finestra={finestra}
          obiettivo={undefined} onObiettivo={() => {}} onChiudi={() => setAperto(null)} ricarica={ricarica} />
      )}
    </div>
  )
}

/* La stampa non usa la pagina a schermo: è una vista sua, densa, pensata
   per stare in due o tre fogli invece che in quindici. Resta sempre nel DOM
   (a schermo è display:none) e la stampa la fa comparire.

   Va appesa direttamente a <body>: la regola che nasconde il resto colpisce
   i figli di body, e come nell'originale non può usare :not(#id), che
   porterebbe con sé la specificità di un id e vincerebbe sulla regola che
   riaccende questa vista. */
function Stampa({ m }: { m: Motore }) {
  const vista = <StampaVista m={m} />
  return typeof document === 'undefined' ? vista : createPortal(vista, document.body)
}

function StampaVista({ m }: { m: Motore }) {
  const gs = m.giudizi()
  const oggi = new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })
  return (
    <div id="printview">
      <div className="psthead">
        <h1>Riepilogo asta</h1>
        <p>{m.S.teams.length} squadre · {m.S.budget} crediti a testa · {Object.keys(m.S.assign).length} giocatori assegnati · {oggi}</p>
      </div>
      <table className="ptab">
        <thead><tr><th>#</th><th>Squadra</th><th className="n">Spesa</th><th className="n">Resta</th>
          <th className="n">P</th><th className="n">D</th><th className="n">C</th><th className="n">A</th>
          <th className="n">vs media</th><th className="n">Tit.</th><th className="n">Voto</th></tr></thead>
        <tbody>
          {gs.map((x, i) => {
            const st = m.stats(x.t.id), g = x.g, d = 1 / g.resa - 1
            return (
              <tr key={x.t.id}>
                <td className="n">{i + 1}</td><td><b>{x.t.name}</b></td>
                <td className="n">{g.pagato}</td><td className="n">{st.left}</td>
                <td className="n">{st.perRole.P.spent}</td><td className="n">{st.perRole.D.spent}</td>
                <td className="n">{st.perRole.C.spent}</td><td className="n">{st.perRole.A.spent}</td>
                <td className="n">{d >= 0 ? '+' : '−'}{Math.abs(Math.round(d * 100))}%</td>
                <td className="n">{g.titolari}</td><td className="n"><b>{g.voto}</b></td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="pgrid">
        {gs.map((x, i) => {
          const st = m.stats(x.t.id), g = x.g
          return (
            <div key={x.t.id} className="pblock">
              <div className="pbh"><span className="pos">{i + 1}</span><b>{x.t.name}</b><span className="pbv">{g.voto}</span></div>
              <div className="pbs">{g.pagato} spesi · {st.left} rimasti · {g.mod}</div>
              {ROLES.map(r => st.R[r].length ? (
                <div key={r} className="pr">
                  <span className="prh">{r}</span>
                  {st.R[r].map(y => <span key={y.p.id} className="pp">{y.p.n} <b>{y.price}</b></span>)}
                </div>
              ) : null)}
              {g.pro[0] && <div className="pn ok">+ {g.pro[0]}</div>}
              {g.contro[0] && <div className="pn ko">{g.contro[0]}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
