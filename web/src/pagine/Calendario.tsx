import { useState } from 'react'
import type { Motore } from '../domain/motore.ts'
import { FixStrip } from '../viste/segni.tsx'
import { Bottone, Card } from '../ui.tsx'

const scoreCol = (s: number) => s >= 3.4 ? 'var(--ok)' : s <= 2.75 ? 'var(--crit)' : 'var(--muted)'
const giornoMese = (s: string | null | undefined) => { if (!s) return ''; const p = s.split('-'); return p[2] + '/' + p[1] }
const giornata = (x: number) => Math.max(1, Math.min(38, Math.trunc(x) || 1))
const segno2 = (x: number) => (x >= 0 ? '+' : '') + x.toFixed(2)

/* ══ Calendario ══════════════════════════════════════════════════════
   renderCal() e renderRisultati() dell'app a file singolo: le venti
   squadre ordinate per morbidezza del calendario su una finestra di
   giornate, separando chi cerca bonus da chi cerca la porta inviolata;
   i risultati veri ricavati dai voti; da dove nasce l'indice.          */
export default function Calendario({ motore: m }: { motore: Motore }) {
  const [attacco, setAttacco] = useState(true)
  const [from, setFrom] = useState(() => m.giornataOggi())
  const [span, setSpan] = useState(5)
  const [risScelta, setRisScelta] = useState<number | null>(null)

  if (!m.CAL.teams.length) return (
    <Card><div className="empty">Il calendario di serie A non è caricato: prendilo da openfootball in <b>Carica dati</b>, in Panoramica.</div></Card>
  )

  const f = giornata(from), sp = giornata(span), role = attacco ? 'A' : 'D'
  const d0 = m.CAL.dates[f - 1], d1 = m.CAL.dates[Math.min(37, f + sp - 2)]
  // come nell'originale: chi non ha partite nella finestra conta zero e va in fondo
  const righe = m.CAL.teams.map(t => ({ t, s: m.calScore(t, role, f, sp) })).sort((a, b) => (b.s ?? 0) - (a.s ?? 0))

  const gg = m.giornateGiocate()
  const risG = risScelta !== null && gg.includes(risScelta) ? risScelta : gg[gg.length - 1]
  const F = m.forze()
  const forze = m.CAL.teams.map(t => ({ t, a: F[t].att, d: F[t].dif })).sort((x, y) => (y.a + y.d) - (x.a + x.d))
  const peso = m.pesoRisultati()

  return (
    <div className="space-y-[18px]">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <span className="mb-1 block text-[11px] font-semibold tracking-wider text-muted uppercase">Chi guarda il calendario</span>
          <div className="roleseg">
            <button type="button" aria-pressed={attacco} onClick={() => setAttacco(true)}>Attacco (C e A)</button>
            <button type="button" aria-pressed={!attacco} onClick={() => setAttacco(false)}>Difesa (P e D)</button>
          </div>
        </div>
        {([['Da giornata', f, setFrom], ['Per quante', sp, setSpan]] as const).map(([lab, v, set]) => (
          <label key={lab} className="block w-[112px]">
            <span className="mb-1 block text-[11px] font-semibold tracking-wider text-muted uppercase">{lab}</span>
            <input type="number" min={1} max={38} value={v} onChange={e => set(parseInt(e.target.value) || 1)}
              className="w-full rounded-[7px] border border-line-strong bg-surface px-2.5 py-1.5 text-sm" />
          </label>
        ))}
        <span className="hint ml-auto pb-2">Giornate {f}–{Math.min(38, f + sp - 1)}{d0 ? ` · dal ${giornoMese(d0)} al ${giornoMese(d1)}` : ''}</span>
      </div>

      <div className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
        <div className="overflow-x-auto">
          <table className="list caltab">
            <tbody>
              {righe.map((r, i) => (
                <tr key={r.t}>
                  <td className="w-8 text-muted fr-num">{i + 1}</td>
                  <td className="tname">{r.t}</td>
                  <td><FixStrip m={m} team={r.t} r={role} from={f} span={sp} /></td>
                  <td className="num">{r.s === null ? '—' : <span className="calscore fr-num" style={{ color: scoreCol(r.s) }}>{r.s.toFixed(2)}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Card titolo="Come sta andando davvero" azioni={gg.length ? <span className="hint">{gg.length === 1 ? '1 giornata caricata' : `${gg.length} giornate caricate`}</span> : undefined}>
        {!gg.length ? (
          <p className="hint max-w-[74ch]">Qui compaiono i risultati veri e la classifica, appena carichi i voti di una giornata da <b>Carica dati</b>.
            Non serve altro: i gol stanno già dentro quel file.</p>
        ) : <Risultati m={m} gg={gg} g={risG} onG={setRisScelta} />}
      </Card>

      <Card titolo="Come nasce questo indice">
        <p className="hint mb-3 max-w-[76ch]">
          La forza di ogni squadra parte dalle quotazioni del listone, cioè dal giudizio del mercato: l'<b>attacco</b> pesa le quotazioni dei
          tre attaccanti e dei quattro centrocampisti più cari, la <b>difesa</b> quelle del portiere titolare e dei quattro difensori più cari.{' '}
          {gg.length
            ? <>Poi arriva il campo: con <b>{gg.length === 1 ? 'una giornata' : `${gg.length} giornate`}</b> caricat{gg.length === 1 ? 'a' : 'e'} i
              risultati veri pesano già il <b>{Math.round(peso * 100)}%</b>, e a dieci giornate conteranno metà.</>
            : <>Finché non carichi i voti sono solo valori di partenza: reggono in agosto e vanno riletti quando il campo dice altro.</>}
          {' '}Il fattore campo vale mezzo gradino di difficoltà.
        </p>
        {/* Attacco e difesa si distinguono con l'etichetta, non con il colore del ruolo: i colori di ruolo
            stanno solo su fili e chip, mai sul testo (regola 3 dei token). */}
        <div className="forcegrid">
          {forze.map(x => (
            <div key={x.t} className="forcerow">
              <span className="fn">{x.t}</span>
              <span className="fv" title="Forza d'attacco"><i className="forza-et">att</i><span className="fr-num">{segno2(x.a)}</span></span>
              <span className="fv" title="Solidità difensiva"><i className="forza-et">dif</i><span className="fr-num">{segno2(x.d)}</span></span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

/* i risultati si ricavano dai voti: i gol dei giocatori da una parte, i
   subiti dal portiere avversario dall'altra — e si controllano a vicenda */
function Risultati({ m, gg, g, onG }: { m: Motore; gg: number[]; g: number; onG: (g: number) => void }) {
  const lista = m.risultatiDi(g), i = gg.indexOf(g)
  const dubbie = Object.values(m.risultati()).flat().filter(r => r.torna === false).length
  return (
    <>
      <div className="risbar">
        <Bottone piccolo disabled={i <= 0} onClick={() => onG(gg[i - 1])}>‹</Bottone>
        <span className="risg">{g}ª giornata</span>
        <Bottone piccolo disabled={i >= gg.length - 1} onClick={() => onG(gg[i + 1])}>›</Bottone>
      </div>
      {lista.length ? (
        <div className="risgrid">
          {lista.map(r => (
            <div key={r.casa} className={`rispart${r.torna === false ? ' dubbia' : ''}`}
              title={r.torna === false ? 'i gol dei giocatori e quelli subiti dal portiere non tornano: forse il file di quella giornata è parziale' : undefined}>
              <span className={`rt${r.gc > r.go ? ' win' : ''}`}>{r.casa}</span>
              <span className={`rs fr-num${r.gc === r.go ? ' pari' : ''}`}>{r.gc}<i>–</i>{r.go}</span>
              <span className={`rt${r.go > r.gc ? ' win' : ''}`}>{r.osp}</span>
            </div>
          ))}
        </div>
      ) : <p className="hint">Di questa giornata non ho abbastanza voti per ricostruire le partite.</p>}
      <div className="clatop">Classifica</div>
      <div className="overflow-x-auto">
        <table className="clatab">
          <tbody>
            <tr className="clahead"><td /><td>Squadra</td><td className="num">G</td><td className="num">V</td><td className="num">N</td>
              <td className="num">P</td><td className="num">Gol</td><td className="num">DR</td><td className="num">Pt</td></tr>
            {m.classificaSerieA().map((x, k) => {
              const dr = x.gf - x.gs
              return (
                <tr key={x.t}>
                  <td className="cpos fr-num">{k + 1}</td><td className="tname">{x.t}</td>
                  <td className="num csm fr-num">{x.g}</td><td className="num csm fr-num">{x.v}</td><td className="num csm fr-num">{x.n}</td><td className="num csm fr-num">{x.p}</td>
                  <td className="num csm fr-num">{x.gf}:{x.gs}</td>
                  <td className="num csm fr-num" style={{ color: dr > 0 ? 'var(--ok)' : dr < 0 ? 'var(--crit)' : 'var(--muted)' }}>{dr > 0 ? '+' : ''}{dr}</td>
                  <td className="num cpt fr-num">{x.pt}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="hint mt-[11px]">
        Ricavati dai voti, senza importare altro: i gol dei giocatori di una squadra da una parte, i gol subiti dal suo portiere dall'altra. Le due
        strade si controllano a vicenda{dubbie ? <> — e in <b>{dubbie}</b> {dubbie === 1 ? 'partita non tornano' : 'partite non tornano'}, segno che quel
        file di voti è parziale.</> : ', e tornano tutte.'} La classifica vale {gg.length === 1 ? <>sull'unica <b>giornata</b></> : <>sulle <b>{gg.length} giornate</b></>} di
        cui hai caricato i voti, non sul campionato intero.
      </p>
    </>
  )
}
