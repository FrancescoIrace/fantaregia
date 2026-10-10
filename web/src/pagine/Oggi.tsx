/* ══ Oggi: la dashboard del telefono ═════════════════════════════════
   Sotto i 900px la lega si apre qui. Ogni pagina della lega, sul telefono,
   è una lunga colonna da scorrere: chi apre l'app il sabato mattina vuole
   sapere quattro cose e poi andare in una pagina sola. Quindi qui c'è
   solo quello che serve adesso, ognuno in una casella che porta alla
   pagina dove sta il resto, e sotto un bottone per ogni pagina.

   Le cose di «adesso» cambiano con la modalità:
   - in stagione: che giornata è, chi affronti e con che probabilità, se
     la formazione è schierata, chi dei tuoi è fuori, dove sei in
     classifica;
   - all'asta: i tuoi crediti e il massimo che puoi offrire, i posti per
     reparto, a che punto è l'asta della lega, l'ultimo acquisto (o la
     tua rosa, se il registro non c'è), gli obiettivi ancora liberi.

   Nessun conto nuovo: tutto viene dal motore (scontro, classificaLega,
   isOut, diffidati, stats, mercato) e dalla formazione salvata, letti
   come li leggono le pagine a cui ogni casella porta.                 */
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ROLES, type Motore } from '../domain/motore.ts'
import type { RigheLega } from '../data/componi.ts'
import { normalizza, type Formazione } from '../domain/formazione.ts'
import { dataBreve } from '../viste/colori.ts'
import { ICONE, ICONA_PANORAMICA } from '../viste/icone.ts'
import { ORDINE, PANORAMICA, SCHEDE, type Modo } from '../viste/modo.ts'
import type { Ruolo } from '../domain/tipi.ts'

const NOMI: Record<Ruolo, string> = { P: 'Portieri', D: 'Difensori', C: 'Centrocampisti', A: 'Attaccanti' }
const probCol = (pct: number) => pct >= 58 ? 'var(--ok)' : pct <= 42 ? 'var(--crit)' : 'var(--warn)'

const Icona = ({ d }: { d: string }) => <svg viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg>

export default function Oggi({ legaId, righe, motore: m, modo, puoScrivere }: {
  legaId: string; righe: RigheLega; motore: Motore; modo: Modo; puoScrivere: boolean
}) {
  const base = `/lega/${legaId}`
  return (
    <div className="m-vista o-vista">
      {modo === 'asta'
        ? <OggiAsta m={m} righe={righe} base={base} />
        : <OggiStagione m={m} righe={righe} base={base} puoScrivere={puoScrivere} />}

      <p className="m-titolo"><span>Tutte le pagine</span></p>
      <nav className="o-bottoni" aria-label="Tutte le pagine della lega">
        {ORDINE[modo].map(k => (
          <Link key={k} to={`${base}/${SCHEDE[k].path}`} className="o-bottone">
            <Icona d={ICONE[k]} />{SCHEDE[k].testo}
          </Link>
        ))}
        <Link to={`${base}/${PANORAMICA.path}`} className="o-bottone">
          <Icona d={ICONA_PANORAMICA} />{PANORAMICA.testo}
        </Link>
      </nav>
    </div>
  )
}

/* Una casella: titolo piccolo in alto, il numero o la frase che conta, una
   riga sotto. Tutta la casella è il link: col pollice non si mira. */
function Casella({ a, titolo, destra, children, larga }: {
  a: string; titolo: string; destra?: ReactNode; children: ReactNode; larga?: boolean
}) {
  return (
    <Link to={a} className={`o-casella${larga ? ' larga' : ''}`}>
      <span className="o-ctitolo"><span>{titolo}</span>{destra ?? <span className="m-freccia" aria-hidden="true">›</span>}</span>
      {children}
    </Link>
  )
}

/* ── in stagione ── */
function OggiStagione({ m, righe, base, puoScrivere }: { m: Motore; righe: RigheLega; base: string; puoScrivere: boolean }) {
  const tid = m.meId()
  const g = m.giornataOggi()
  const data = m.CAL.dates?.[g - 1]
  const giocate = m.giornateGiocate()
  const ultima = giocate.length ? Math.max(...giocate) : 0
  // giornataOggi() non scende mai sotto le giornate con i voti: se è più avanti di una, ne mancano
  const votiMancanti = g - 1 > ultima ? g - 1 : null

  const gl = m.legaOn() ? m.legaOggi() : null
  const s = gl !== null && tid ? m.scontro(tid, gl) : null
  const pv = s?.pVinco != null ? Math.round(s.pVinco * 100) : null

  // la formazione è quella salvata per la giornata di serie A, come la apre Formazioni
  const salvate = (righe.preferenze?.formazioni ?? {}) as Record<string, Formazione>
  const L = salvate[g] ? normalizza(salvate[g]) : null
  const caselle = L ? ROLES.flatMap(r => L.start[r]) : []
  const schierati = caselle.filter((x): x is number => !!x)
  const fuoriInCampo = schierati.filter(id => m.isOut(id)).length

  const R = m.roster(tid)
  const mieiId = new Set(ROLES.flatMap(r => R[r].map(x => x.p.id)))
  const mieiFuori = ROLES.flatMap(r => R[r].map(x => x.p)).filter(p => m.isOut(p.id))
  const mieiDiffidati = m.diffidati().filter(d => mieiId.has(d.pid)).length

  const classifica = m.classificaLega()
  const mioIdx = m.legaIdx(tid)
  const pos = classifica.findIndex(x => x.i === mioIdx)

  return (
    <>
      <div className="o-testa">
        <p className="o-grande fr-num">{g}ª giornata</p>
        <p className="o-sotto">di serie A{data ? ` · ${dataBreve(data)}` : ''}{gl !== null ? ` · ${gl}ª di lega` : ''}</p>
      </div>

      {votiMancanti && puoScrivere && (
        <Link to={`${base}/${PANORAMICA.path}`} className="o-avviso">
          <b>Mancano i voti della {votiMancanti}ª</b>
          <span>caricali in Lega e dati ›</span>
        </Link>
      )}

      <div className="o-griglia">
        {s ? (
          <Casella a={`${base}/scontri`} titolo="Il tuo scontro" larga destra={<span>{s.avv.casa ? 'in casa' : 'fuori casa'}</span>}>
            <span className="o-duello">
              <span className="o-sq io">{m.teamName(tid)}</span>
              <b className="fr-num">{s.mia.media.toFixed(1)}</b>
              <span className="o-vs">contro</span>
              <b className="fr-num fioco">{s.sua ? s.sua.media.toFixed(1) : '—'}</b>
              <span className="o-sq destro">{s.avv.nome}</span>
            </span>
            {pv !== null && (
              <>
                <span className="m-prob" role="img" aria-label={`probabilità di vincere ${pv}%`}><i style={{ width: `${pv}%`, background: probCol(pv) }} /></span>
                <span className="o-riga">vinci <b className="fr-num" style={{ color: probCol(pv) }}>{pv}%</b>{s.diff != null && <> · {s.diff >= 0 ? '+' : '−'}{Math.abs(s.diff).toFixed(1)} punti attesi</>}</span>
              </>
            )}
          </Casella>
        ) : (
          <Casella a={`${base}/scontri`} titolo="Il tuo scontro" larga>
            <span className="o-frase">{m.legaOn() ? 'La tua squadra non è abbinata al calendario di lega' : 'Il calendario di lega non c\'è ancora'}</span>
            <span className="o-riga">{m.legaOn() ? 'si abbina dalla pagina Giornata' : puoScrivere ? 'si carica in Lega e dati' : 'lo carica chi tiene la lega'}</span>
          </Casella>
        )}

        <Casella a={`${base}/formazioni`} titolo="Formazione">
          {schierati.length === 11 ? (
            <>
              <span className="o-frase">Schierata</span>
              <span className={`o-riga${fuoriInCampo ? ' attenzione' : ''}`}>
                {L!.mod}{fuoriInCampo ? ` · ${fuoriInCampo} ${fuoriInCampo === 1 ? 'indisponibile' : 'indisponibili'} in campo` : ''}
              </span>
            </>
          ) : (
            <>
              <span className="o-frase da-fare">Da schierare</span>
              <span className="o-riga">{schierati.length ? `${schierati.length} su 11` : 'per la ' + g + 'ª'}</span>
            </>
          )}
        </Casella>

        <Casella a={`${base}/infermeria`} titolo="I tuoi fuori">
          <span className="o-numero fr-num">{mieiFuori.length}</span>
          <span className="o-riga">
            {mieiFuori.length ? mieiFuori.slice(0, 2).map(p => p.n).join(', ') + (mieiFuori.length > 2 ? '…' : '') : 'tutti disponibili'}
            {mieiDiffidati ? ` · ${mieiDiffidati} diffidat${mieiDiffidati === 1 ? 'o' : 'i'}` : ''}
          </span>
        </Casella>

        {pos >= 0 && (
          <Casella a={`${base}/scontri`} titolo="Classifica" larga
            destra={<span>dopo {m.legaGiocate().length} {m.legaGiocate().length === 1 ? 'giornata' : 'giornate'}</span>}>
            <span className="o-classifica">
              <b className="o-numero fr-num">{pos + 1}º</b>
              <span className="o-riga">su {classifica.length} · <b className="fr-num">{classifica[pos].pt}</b> punti
                {pos > 0 ? ` · ${classifica[0].pt - classifica[pos].pt} dalla vetta` : ' · in vetta'}</span>
            </span>
          </Casella>
        )}
      </div>
    </>
  )
}

/* ── all'asta ── */
function OggiAsta({ m, righe, base }: { m: Motore; righe: RigheLega; base: string }) {
  const tid = m.meId()
  const st = m.stats(tid)
  const presi = Object.keys(m.S.assign).length
  const servono = m.totalSlots() * m.S.teams.length
  const avanzamento = servono ? Math.min(100, Math.round(presi / servono * 100)) : 0
  const mercato = m.mercato()
  const ultimo = m.S.log.length ? m.S.log[m.S.log.length - 1] : null
  const ultimoNome = ultimo ? (m.byId.get(ultimo.pid)?.n ?? m.S.assign[ultimo.pid]?.snap?.n ?? `#${ultimo.pid}`) : null
  const obiettivi = Object.keys(righe.preferenze?.obiettivi ?? {})
  const obLiberi = obiettivi.filter(id => !m.S.assign[id]).length

  return (
    <>
      <div className="o-testa">
        <p className="o-grande fr-num">{st.left} crediti</p>
        <p className="o-sotto">{m.teamName(tid)} · offri al massimo <b className="fr-num">{st.max}</b> · {st.slotsLeft ? `mancano ${st.slotsLeft}` : 'rosa completa'}</p>
      </div>

      <div className="o-griglia">
        <Casella a={`${base}/asta`} titolo="I tuoi posti" larga>
          <span className="o-reparti">
            {ROLES.map(r => {
              const n = st.perRole[r].count, tot = m.S.slots[r]
              return (
                <span key={r} className={`o-reparto${n >= tot ? ' pieno' : ''}`} title={NOMI[r]}>
                  <span className="fr-filo-ruolo" data-ruolo={r} aria-hidden="true" />
                  <span className="ruolo-lettera">{r}</span>
                  <b className="fr-num">{n}<i>/{tot}</i></b>
                </span>
              )
            })}
          </span>
        </Casella>

        <Casella a={`${base}/asta`} titolo="L'asta della lega" larga destra={<span className="fr-num">{presi}/{servono}</span>}>
          <span className="m-prob" role="img" aria-label={`asta al ${avanzamento}%`}><i style={{ width: `${avanzamento}%`, background: 'var(--fr-marchio)' }} /></span>
          <span className="o-riga">
            {mercato ? `la lega paga ${mercato.infl >= 0 ? '+' : '−'}${Math.abs(Math.round(mercato.infl * 100))}% sul listino` : 'appena cominciata'}
          </span>
        </Casella>

        {/* l'ultimo acquisto viene dal registro: una lega importata non ce l'ha,
            e allora si dice la propria rosa invece di «nessuno» a asta avviata */}
        {ultimo ? (
          <Casella a={`${base}/asta`} titolo="Ultimo acquisto">
            <span className="o-frase">{ultimoNome}</span>
            <span className="o-riga">{m.teamName(ultimo.team)} · <b className="fr-num">{ultimo.price}</b></span>
          </Casella>
        ) : (
          <Casella a={`${base}/rose`} titolo="La tua rosa">
            <span className="o-numero fr-num">{st.count}</span>
            <span className="o-riga">{st.count === 1 ? 'giocatore' : 'giocatori'}, spesi <b className="fr-num">{st.spent}</b></span>
          </Casella>
        )}

        <Casella a={`${base}/listone`} titolo="Obiettivi">
          <span className="o-numero fr-num">{obLiberi}</span>
          <span className="o-riga">{obiettivi.length ? `ancora liberi, su ${obiettivi.length}` : 'segnali nel listone'}</span>
        </Casella>
      </div>
    </>
  )
}
