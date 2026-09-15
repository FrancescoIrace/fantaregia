import { useState } from 'react'
import { ROLES, type Motore } from '../domain/motore.ts'
import type { Ruolo } from '../domain/tipi.ts'
import { salvaAbbinamento, salvaMiaSquadra } from '../data/lega.ts'
import TestaATesta from './TestaATesta.tsx'
import { ABBR } from '../viste/colori.ts'
import { Avviso, Card } from '../ui.tsx'

type Scontro = NonNullable<ReturnType<Motore['scontro']>>
const p1 = (x: number) => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(1)
const seg = (x: number) => x > 0 ? '+' : ''
const probCol = (pct: number) => pct >= 58 ? 'var(--ok)' : pct <= 42 ? 'var(--crit)' : 'var(--warn)'
const NOMI: Record<Ruolo, string> = { P: 'Portiere', D: 'Difesa', C: 'Centrocampo', A: 'Attacco' }
const CONSIGLI = {
  rischio: ['Alza il rischio', 'Sei sfavorito: con la media sotto, è la varianza a farti vincere. Meglio l\'attaccante che segna o niente della punta da 6 fisso, e il portiere di una squadra che può fare clean sheet.'],
  prudenza: ['Gioca prudente', 'Sei favorito: ogni scelta bizzarra lavora contro di te. Titolari sicuri, niente scommesse, e chi gioca poco resta fuori anche se costa tanto.'],
  pari: ['È una partita aperta', 'Meno di due punti di scarto: qui la varianza conta poco e conta molto chi scende davvero in campo. Guarda le titolarità prima dei nomi.'],
} as const

/* ══ Lega: chi affronti, e come giocartela ═══════════════════════════
   renderLega() dell'app a file singolo. Il calendario della lega dice CHI
   affronti; quello di serie A quanto è dura per i tuoi. Qui si incrociano:
   il punteggio atteso delle due rose, la probabilità di vincere, cosa
   conviene fare, e da chi arriva il pericolo.                          */
export default function Scontri({ legaId, utenteId, motore: m, puoScrivere, ricarica, motorePrima }: {
  legaId: string; utenteId: string; motore: Motore; puoScrivere: boolean; ricarica: () => void; motorePrima?: (g: number) => Motore
}) {
  const [scelta, setScelta] = useState<number | null>(null)
  const [errore, setErrore] = useState<string | null>(null)

  if (!m.legaOn()) return (
    <div className="space-y-[18px]">
      <Card titolo="Il calendario della lega non c'è ancora">
        <p className="hint max-w-[74ch]">
          Questa pagina dice <b>chi affronti</b> ogni giornata e quanto ci si aspetta che faccia la sua rosa — cose che il listone
          da solo non sa. Serve il calendario della tua lega: caricalo in <b>Panoramica → Carica dati</b>.
        </p>
      </Card>
      {motorePrima && (
        <Card titolo="Testa a testa" azioni={<span className="hint">due rose, le formazioni del modello</span>}>
          <TestaATesta m={m} motorePrima={motorePrima} a={m.meId()} />
        </Card>
      )}
    </div>
  )

  const oggi = m.legaOggi()
  const gl = Math.max(1, Math.min(m.legaGiornate() || 38, scelta ?? oggi))
  const tid = m.meId()
  const s = tid ? m.scontro(tid, gl) : null
  const nonAbbinate = m.S.teams.filter(t => m.legaIdx(t.id) === null)
  const segnala = (p: Promise<unknown>) => p.then(() => { setErrore(null); ricarica() }, (e: Error) => setErrore(e.message))

  return (
    <div className="space-y-[18px]">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block w-[150px]">
          <span className="mb-1 block text-[11px] font-semibold tracking-wider text-muted uppercase">Giornata di lega</span>
          <input type="number" min={1} max={m.legaGiornate()} value={gl} onChange={e => setScelta(parseInt(e.target.value) || 1)}
            className="w-full rounded-[7px] border border-line-strong bg-surface px-2.5 py-1.5 text-sm" />
        </label>
        <label className="block w-[190px]">
          <span className="mb-1 block text-[11px] font-semibold tracking-wider text-muted uppercase">Chi sono io</span>
          <select value={tid} onChange={e => void segnala(salvaMiaSquadra(legaId, utenteId, Number(e.target.value)))}
            className="w-full rounded-[7px] border border-line-strong bg-surface px-2.5 py-1.5 text-sm">
            {m.S.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        <span className="hint ml-auto text-right">
          {m.legaGiornate()} giornate · {m.S.lega!.teams.length} squadre · la 1ª di lega è la {m.legaSerieA(1)}ª di serie A ·{' '}
          {gl === oggi ? <span className="oggi">oggi</span> : <>oggi è la <b>{oggi}</b></>}
        </span>
      </div>
      {errore && <Avviso tipo="errore">{errore}</Avviso>}

      <Card>
        <div className="schead">
          <div className="scocc">Giornata {gl} di lega{s ? ` · ${s.ga}ª di serie A` : ''}</div>
          {s && <>
            <div className="scmatch">
              <span className="scteam io">{m.teamName(tid)}</span>
              <span className="scvs">vs</span>
              <span className="scteam loro">{s.avv.nome}</span>
            </div>
            <div className={`scdove ${s.avv.casa ? 'casa' : 'fuori'}`}>{s.avv.casa ? 'in casa' : 'fuori casa'}</div>
            <Giocata m={m} tid={tid} gl={gl} />
          </>}
        </div>
        {!s ? (
          <p className="hint">
            Questa squadra non è ancora abbinata a un nome del calendario di lega: sceglilo qui sotto, in <b>Abbinamenti</b>.
          </p>
        ) : !s.sua ? (
          <div className="scmain">
            <div className="lsnum fr-num" style={{ color: 'var(--accent)' }}>{s.mia.media.toFixed(1)}</div>
            <div><b>{s.avv.nome}</b> non è abbinato a nessuna squadra dell'asta, quindi la sua rosa non la conosco.
              <div className="hint">Il tuo atteso per questa giornata è {s.mia.media.toFixed(1)} con il {s.mia.mod}.</div></div>
          </div>
        ) : <Pronostico s={s} />}
      </Card>

      {s && (
        <div className="grid gap-[18px] lg:grid-cols-2">
          <Card titolo="Rosa contro rosa" azioni={<span className="hint">punti attesi per reparto</span>}><Reparti s={s} /></Card>
          <Card titolo="Chi mi porta i punti" azioni={<span className="hint">il mio undici, per quella giornata</span>}><Undici m={m} s={s} /></Card>
        </div>
      )}
      {s?.avv.tid && (
        <Card titolo="Da chi mi arriva il pericolo" azioni={<span className="hint">i più temibili della rosa avversaria</span>}>
          <Pericolosi m={m} s={s} />
        </Card>
      )}

      {m.legaGiocate().length > 0 && (
        <div className="grid gap-[18px] lg:grid-cols-2">
          <Card titolo="Classifica di lega" azioni={<span className="hint">{m.legaGiocate().length === 1 ? 'dopo 1 giornata' : `dopo ${m.legaGiocate().length} giornate`}</span>}>
            <Classifica m={m} tid={tid} />
          </Card>
          <Card titolo="Le previsioni tengono?" azioni={<span className="hint">previsto contro successo</span>}>
            <Verifica m={m} tid={tid} />
          </Card>
        </div>
      )}

      <Card titolo={`Le ${m.legaGiornate()} giornate`} azioni={<span className="hint">avversario di lega × calendario di serie A</span>}>
        <Striscia m={m} tid={tid} gl={gl} onScegli={setScelta} />
      </Card>

      {nonAbbinate.length > 0 && (
        <Card titolo="Abbinamenti" azioni={<span className="hint">{nonAbbinate.length} {nonAbbinate.length === 1 ? 'squadra senza nome' : 'squadre senza nome'} nel calendario di lega</span>}>
          <div className="grid gap-x-3 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
            {m.S.teams.map(t => (
              <label key={t.id} className="grid gap-0.5 text-[12.5px]">
                <span className={`truncate font-semibold ${m.legaIdx(t.id) === null ? 'text-ink' : 'text-muted'}`}>{t.name}</span>
                <select disabled={!puoScrivere} value={m.legaIdx(t.id) ?? ''}
                  onChange={e => void segnala(salvaAbbinamento(legaId, t.id, e.target.value === '' ? null : Number(e.target.value)))}
                  className="rounded-[7px] border border-line-strong bg-surface px-2 py-1 text-sm">
                  <option value="">—</option>
                  {m.S.lega!.teams.map((n, i) => <option key={i} value={i}>{n}</option>)}
                </select>
              </label>
            ))}
          </div>
          {!puoScrivere && <p className="hint mt-2">Gli abbinamenti li cambiano admin e banditori.</p>}
        </Card>
      )}

      {motorePrima && (
        <Card titolo="Testa a testa" azioni={<span className="hint">due rose, le formazioni del modello</span>}>
          <TestaATesta m={m} motorePrima={motorePrima} a={tid} b={s?.avv.tid} ga={s?.ga} />
        </Card>
      )}

      <details className="rounded-card border border-line bg-surface p-4 text-sm shadow-card">
        <summary className="cursor-pointer font-semibold">Come nascono questi numeri, e quanto valgono</summary>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div>
            <h4 className="font-semibold">Il punteggio atteso</h4>
            <p className="hint mt-1">Per ogni giocatore del miglior undici possibile: la sua pagella media, più i bonus per presenza corretti
              dalla durezza della partita di serie A di quella giornata. Il tutto pesato dalla probabilità che giochi davvero: chi non
              scende in campo lascia il posto a una riserva che rende meno.</p>
          </div>
          <div>
            <h4 className="font-semibold">Lo scarto, e perché conta più della media</h4>
            <p className="hint mt-1">Il fantavoto di un attaccante che segna spesso oscilla molto più di quello di un difensore: ogni gol vale 3
              e porta varianza 9λ. Sommando i giocatori viene lo scarto della squadra, e da media e scarto la probabilità di vincere.
              I giocatori sono trattati come indipendenti, quindi lo scarto vero è un po' più largo di quello scritto qui.</p>
          </div>
        </div>
      </details>
    </div>
  )
}

function Giocata({ m, tid, gl }: { m: Motore; tid: number; gl: number }) {
  const e = m.esitoDi(tid, gl)
  if (!e) return null
  const es = e.gf !== null ? (e.gf > e.gc! ? 'vinta' : e.gf < e.gc! ? 'persa' : 'pari') : (e.pf > e.pc ? 'vinta' : e.pf < e.pc ? 'persa' : 'pari')
  return (
    <div className={`scfatta ${es}`}>
      <span className="sfl">giocata</span>
      {e.gf !== null && <span className="sfg fr-num">{e.gf}<i>–</i>{e.gc}</span>}
      <span className="sfp fr-num">{(e.pf || 0).toFixed(1)} <i>a</i> {(e.pc || 0).toFixed(1)}</span>
    </div>
  )
}

function Pronostico({ s }: { s: Scontro }) {
  const pv = Math.round(s.pVinco! * 100), col = probCol(pv)
  const [titolo, testo] = CONSIGLI[s.strategia!]
  return (
    <>
      <div className="legasc">
        <div className="lsq"><div className="lslab">tu</div><div className="lsnum fr-num">{s.mia.media.toFixed(1)}</div><div className="lssd">± {s.mia.sd.toFixed(1)} · {s.mia.mod}</div></div>
        <div className="lsmid">
          <div className="lsprob fr-num" style={{ color: col }}>{pv}%</div>
          <div className="lsplab">probabilità di vincere</div>
          <div className="lsbar"><i style={{ width: `${pv}%`, background: col }} /></div>
          <div className="lsdiff">{p1(s.diff!)} punti attesi</div>
        </div>
        <div className="lsq"><div className="lslab">{s.avv.nome}</div><div className="lsnum fr-num">{s.sua!.media.toFixed(1)}</div><div className="lssd">± {s.sua!.sd.toFixed(1)} · {s.sua!.mod}</div></div>
      </div>
      <div className={`lscons ${s.strategia}`}><b>{titolo}</b><p>{testo}</p></div>
    </>
  )
}

function Reparti({ s }: { s: Scontro }) {
  if (!s.sua) return <p className="hint">Serve l'abbinamento dell'avversario per fare il confronto.</p>
  const sua = s.sua
  return (
    <>
      {ROLES.map(r => {
        const a = s.mia.perRuolo[r] || 0, b = sua.perRuolo[r] || 0
        // quanti ne schiera ciascuno: con moduli diversi i totali non sono confrontabili
        const na = s.mia.xi.filter(x => x.p.r === r).length, nb = sua.xi.filter(x => x.p.r === r).length
        const tot = Math.max(a, b, 1), d = a - b
        return (
          <div key={r} className="cmprow">
            <div className="cmplab">{NOMI[r]}</div>
            <div className="cmpbars">
              <div className="cmpb mine"><span className="tr"><i style={{ width: `${(a / tot * 100).toFixed(1)}%` }} /></span><span className="v fr-num">{a.toFixed(1)} <em>×{na}</em></span></div>
              <div className="cmpb his"><span className="tr"><i style={{ width: `${(b / tot * 100).toFixed(1)}%` }} /></span><span className="v fr-num">{b.toFixed(1)} <em>×{nb}</em></span></div>
            </div>
            <div className="cmpd fr-num" style={{ color: d >= 1.5 ? 'var(--ok)' : d <= -1.5 ? 'var(--crit)' : 'var(--muted)' }}>{p1(d)}</div>
          </div>
        )
      })}
      <p className="hint mt-2.5">La barra chiara sei tu, quella scura l'avversario; <b>×n</b> è quanti ne schiera ciascuno. Con moduli diversi il
        totale di un reparto non basta: tre attaccanti fanno più punti di due anche quando valgono meno, quindi guarda il ×n prima del segno.</p>
    </>
  )
}

function Undici({ m, s }: { m: Motore; s: Scontro }) {
  return (
    <>
      <div className="undlist">
        {s.mia.xi.map(x => {
          const fx = x.a.fx, dur = fx ? m.fixDiff(fx.opp, m.isOff(x.p.r), fx.home) : 3
          return (
            <div key={x.p.id} className="undrow">
              <span className="fr-filo-ruolo" data-ruolo={x.p.r} aria-hidden="true" /><span className="ruolo-lettera">{x.p.r}</span>
              <span className="undn">{x.p.n}<em>{x.p.s || ''}{fx ? ' · ' + (fx.home ? '' : 'a ') + ABBR(fx.opp) : ''}</em></span>
              <span className="undsd fr-num" title="quanto oscilla">±{x.a.sd.toFixed(1)}</span>
              <span className="undd" style={{ background: dur <= 2.2 ? 'var(--ok)' : dur >= 3.6 ? 'var(--crit)' : 'var(--warn)' }} />
              <b className="undv fr-num">{x.atteso.toFixed(1)}</b>
            </div>
          )
        })}
      </div>
      <p className="hint mt-2.5">Il pallino è la durezza della partita di serie A; ± è quanto quel giocatore può oscillare. Chi ha il ± alto è la
        tua arma quando sei sfavorito.</p>
    </>
  )
}

/* ordinati per TETTO, non per media: quanto fa in una giornata buona */
function Pericolosi({ m, s }: { m: Motore; s: Scontro }) {
  const lista = m.pericolosi(s.avv.tid, s.ga, 6)
  if (!lista.length) return <p className="hint">Non conosco la rosa di {s.avv.nome}.</p>
  const max = lista[0].tetto || 1
  return (
    <>
      <div className="perlist">
        {lista.map((x, i) => {
          const fx = x.a.fx
          return (
            <div key={x.p.id} className={`perrow${i === 0 ? ' primo' : ''}`}>
              <span className="fr-filo-ruolo" data-ruolo={x.p.r} aria-hidden="true" /><span className="ruolo-lettera">{x.p.r}</span>
              <span className="pern">{x.p.n}{x.rig && <b className="perig" title="primo rigorista">R</b>}
                <em>{x.p.s || ''}{fx ? ' · ' + (fx.home ? '' : 'a ') + ABBR(fx.opp) : ''} · {x.perche}</em></span>
              <span className="perbar"><i style={{ width: `${(x.tetto / max * 100).toFixed(0)}%` }} /></span>
              <span className="permed fr-num">{x.atteso.toFixed(1)}</span>
              <b className="pertet fr-num">{x.tetto.toFixed(1)}</b>
            </div>
          )
        })}
      </div>
      <p className="hint mt-2.5">Ordinati per <b>tetto</b>, non per media: il tetto è quanto quel giocatore fa in una giornata buona — il valore
        che supera circa una volta su dieci. Il primo numero è la sua media attesa. Un difensore da 6 fisso non ti ribalta una giornata, una
        punta che segna una volta su tre sì. <b>R</b> è il primo rigorista.</p>
    </>
  )
}

function Classifica({ m, tid }: { m: Motore; tid: number }) {
  const mio = m.legaIdx(tid)
  return (
    <div className="overflow-x-auto">
      <table className="clatab">
        <tbody>
          <tr className="clahead"><td /><td>Squadra</td><td className="num">G</td><td className="num">V</td><td className="num">N</td>
            <td className="num">P</td><td className="num">Gol</td><td className="num">Fantapunti</td><td className="num">Pt</td></tr>
          {m.classificaLega().map((x, i) => (
            <tr key={x.i} className={x.i === mio ? 'claio' : undefined}>
              <td className="cpos fr-num">{i + 1}</td>
              <td className="tname">{x.nome}</td>
              <td className="num csm fr-num">{x.g}</td><td className="num csm fr-num">{x.v}</td>
              <td className="num csm fr-num">{x.n}</td><td className="num csm fr-num">{x.p}</td>
              <td className="num csm fr-num">{x.gf}:{x.gs}</td>
              <td className="num csm fr-num">{x.pf.toFixed(1)}</td>
              <td className="num cpt fr-num">{x.pt}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* una previsione che nessuno controlla non è una previsione: com'è andata davvero */
function Verifica({ m, tid }: { m: Motore; tid: number }) {
  const v = m.verifica(tid)
  if (!v.length) return <p className="hint">Nessuna giornata giocata ancora.</p>
  const s = m.sintesiVerifica(v)
  return (
    <>
      {s && (
        <div className="vsint">
          <div className="vs1"><div className="vsv fr-num" style={{ color: Math.abs(s.scarto) < 4 ? 'var(--ok)' : Math.abs(s.scarto) < 8 ? 'var(--warn)' : 'var(--crit)' }}>{seg(s.scarto)}{s.scarto.toFixed(1)}</div>
            <div className="vsk">il mio scarto medio</div></div>
          {s.scartoAvv !== null && <div className="vs1"><div className="vsv fr-num">{seg(s.scartoAvv)}{s.scartoAvv.toFixed(1)}</div><div className="vsk">quello degli avversari</div></div>}
          <div className="vs1"><div className="vsv fr-num">{s.centrate}<span className="text-base text-muted">/{s.n}</span></div><div className="vsk">pronostici azzeccati</div></div>
        </div>
      )}
      <div className="vlist">
        {v.map(x => {
          const sc = x.atteso !== null ? x.pf - x.atteso : null
          const es = x.vinta > 0 ? 'vinta' : x.vinta < 0 ? 'persa' : 'pari'
          return (
            <div key={x.gl} className="vrow">
              <span className="vg fr-num">{x.gl}ª</span>
              <span className="vavv">{m.S.lega!.teams[x.avv] || '?'}<i>{x.casa ? 'in casa' : 'fuori'}</i></span>
              <span className={`vpt ${es}`}>{x.gf !== null ? `${x.gf}–${x.gc}` : es}</span>
              <span className="vnum fr-num">{x.pf !== null ? x.pf.toFixed(1) : '—'}<i>fatti</i></span>
              <span className="vnum fr-num">{x.atteso !== null ? x.atteso.toFixed(1) : '—'}<i>attesi</i></span>
              <span className="vsc fr-num" style={{ color: sc === null ? 'var(--muted)' : sc > 0 ? 'var(--ok)' : sc < 0 ? 'var(--crit)' : 'var(--muted)' }}>{sc === null ? '' : seg(sc) + sc.toFixed(1)}</span>
            </div>
          )
        })}
      </div>
      <p className="hint mt-2.5">Lo scarto è quanto la tua rosa ha reso <b>in più o in meno</b> di quello che l'app si aspettava. Uno scarto grosso
        e sempre nello stesso verso vuol dire che la stima è tarata male; uno che salta di segno è solo la domenica che fa la domenica
        {s && s.n < 4 ? ' — e con così poche giornate non si può ancora dire niente' : ''}.</p>
    </>
  )
}

/* le giornate della stagione: probabilità di vincere, e la «giornata nera» —
   avversario forte E turno di serie A duro per i tuoi */
function Striscia({ m, tid, gl, onScegli }: { m: Motore; tid: number; gl: number; onScegli: (g: number) => void }) {
  const righe = m.legaIncroci(tid)
  if (!righe.length) return <p className="hint">Abbina le squadre dell'asta ai nomi del calendario per vedere le giornate.</p>
  const nerCol = (n: number) => n >= 68 ? 'var(--crit)' : n >= 50 ? 'var(--warn)' : 'var(--ok)'
  const peggio = [...righe].sort((a, b) => b.nera - a.nera)[0], meglio = [...righe].sort((a, b) => a.nera - b.nera)[0]
  return (
    <>
      <div className="lgrid">
        {righe.map(r => {
          const p = Math.round(r.pVinco * 100)
          return (
            <button key={r.gl} type="button" className={`lcell${r.gl === gl ? ' on' : ''}`} onClick={() => onScegli(r.gl)}
              title={`giornata ${r.gl} di lega · ${r.ga}ª di serie A`}>
              <span className="lg fr-num">g{r.gl}</span>
              <span className="lavv">{r.avv.nome}</span>
              <span className="lprob fr-num" style={{ color: probCol(p) }}>{p}%</span>
              <span className="lner"><i style={{ width: `${r.nera}%`, background: nerCol(r.nera) }} /></span>
            </button>
          )
        })}
      </div>
      <p className="hint mt-2.5">La percentuale è la probabilità di vincere quella giornata; la barra sotto mette insieme la forza dell'avversario e
        la durezza del turno di serie A per i tuoi. Clicca una giornata per aprirla sopra.</p>
      <p className="hint mt-1">La giornata peggiore è la <b>{peggio.gl}</b> contro {peggio.avv.nome} ({peggio.ga}ª di serie A); la più comoda
        la <b>{meglio.gl}</b> contro {meglio.avv.nome}.</p>
    </>
  )
}
