/* ══ Il guscio del telefono ══════════════════════════════════════════
   Sotto i 900px la lega non ha più tre fasce in cima (testata con email
   ed Esci, riga del titolo che va a capo, striscia di undici schede che
   scorre di lato: su 390px erano ~150px di cromatura, con la navigazione
   il più lontano possibile dal pollice). Al loro posto:

   - una testata sola, alta ~50px, con chi sei e dove sei;
   - una barra in basso a cinque caselle — «Oggi», le prime tre della
     modalità corrente e «Altro» — fissa, appoggiata al bordo;
   - un cassetto solo, che si apre dal menu in testata e da «Altro», e
     contiene tutto il resto.

   Niente sparisce: quello che non entra in barra sta nel cassetto, che
   ha lo spazio per spiegare ogni voce. L'ordine non lo decide questo
   file — lo legge da ORDINE e PRIME_TELEFONO di modo.ts, che restano l'unica
   sorgente anche per le schede da scrivania.                          */
import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router'
import { OGGI, ORDINE, PANORAMICA, PRIME_TELEFONO, SCHEDE, type Modo } from './modo.ts'
import { ICONE, ICONA_ESCI, ICONA_LEGHE, ICONA_LUNA, ICONA_MENU, ICONA_OGGI, ICONA_PANORAMICA } from './icone.ts'
import { scegliTema, temaSalvato, type Tema } from './tema.ts'
import SceltaTema from './SceltaTema.tsx'
import { ContestoAzione, type Azione } from './barra-azione.ts'

const Icona = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg>
)

export interface GuscioProps {
  legaId: string
  nomeLega: string
  /** la propria squadra, per il gagliardetto e la riga sotto il nome */
  squadra: { nome: string; colore: string | null } | null
  modo: Modo
  onModo: (m: Modo) => void
  email?: string | null
  onEsci: () => void
  children: ReactNode
}

export default function Guscio({ legaId, nomeLega, squadra, modo, onModo, email, onEsci, children }: GuscioProps) {
  const [cassetto, setCassetto] = useState(false)
  // l'azione principale della pagina aperta, se ne ha una (viste/barra-azione.ts)
  const [azione, setAzione] = useState<Azione | null>(null)
  const chiudi = () => setCassetto(false)
  const { pathname } = useLocation()
  const vai = useNavigate()
  /* «/lega/<id>/<pagina>», o «/lega/<id>» per Oggi */
  const attiva = pathname.split('/')[3] ?? ''
  const inBarra = ORDINE[modo].slice(0, PRIME_TELEFONO)
  const altre = ORDINE[modo].slice(PRIME_TELEFONO)

  /* Il cassetto si chiude perché hai toccato una voce, non perché il path
     è cambiato: chiuderlo guardando l'indirizzo vorrebbe dire far ridisegnare
     tutto il guscio a ogni navigazione per poi spegnere una cosa che si sa
     già di voler spegnere. Lo fa `chiudi` dove si tocca. */
  useEffect(() => {
    if (!cassetto) return
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setCassetto(false) }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [cassetto])

  return (
    <ContestoAzione.Provider value={setAzione}>
    <div className={`guscio${azione ? ' con-azione' : ''}`}>
      <header className="g-testata">
        <div className="g-riga">
          {squadra?.colore && <span className="gagliardetto g-gagl" style={{ ['--tinta' as string]: squadra.colore }} />}
          <div className="g-chi">
            <p className="g-nome">{nomeLega}</p>
            <p className="g-sotto">
              {squadra && <>{squadra.nome} · </>}
              <span className="g-spia">{modo === 'asta' ? 'asta' : 'stagione'}</span>
            </p>
          </div>
          <BottoneTema />
          <button type="button" className="g-tondo" aria-label="Menu della lega"
            aria-expanded={cassetto} onClick={() => setCassetto(true)}>
            <Icona d={ICONA_MENU} />
          </button>
        </div>
      </header>

      <div className="g-corpo">{children}</div>

      {azione && (
        <div className="g-azione">
          <div className="g-azione-testo"><b>{azione.titolo}</b>{azione.sotto && <em>{azione.sotto}</em>}</div>
          <button type="button" className="g-principale" disabled={azione.disabilitata} onClick={azione.fai}>{azione.etichetta}</button>
        </div>
      )}

      <nav className="g-nav" aria-label="Le pagine della lega">
        {/* la casa: la giornata in breve, e da lì ogni pagina */}
        <NavLink to={`/lega/${legaId}`} end className={({ isActive }) => `g-vai${isActive ? ' on' : ''}`}>
          <Icona d={ICONA_OGGI} />{OGGI.testo}
        </NavLink>
        {inBarra.map(k => (
          <NavLink key={k} to={`/lega/${legaId}/${SCHEDE[k].path}`}
            className={({ isActive }) => `g-vai${isActive ? ' on' : ''}`}>
            <Icona d={ICONE[k]} />{SCHEDE[k].testo}
          </NavLink>
        ))}
        {/* «Altro» è acceso quando quello che guardi non è in barra: Lega e
            dati, o una delle pagine di seconda fila. */}
        <button type="button" className={`g-vai${attiva === '' || inBarra.some(k => SCHEDE[k].path === attiva) ? '' : ' on'}`}
          aria-expanded={cassetto} onClick={() => setCassetto(true)}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="6" cy="12" r="1.3" /><circle cx="12" cy="12" r="1.3" /><circle cx="18" cy="12" r="1.3" />
          </svg>
          Altro
        </button>
      </nav>

      {cassetto && (
        <>
          <div className="g-velo" onClick={chiudi} />
          <aside className="g-cassetto" role="dialog" aria-modal="true" aria-label="Altro">
            <div className="g-maniglia" />
            <div className="g-cassetto-t">
              <h2>Altro</h2>
              <button type="button" className="g-chiudi" onClick={chiudi}>chiudi</button>
            </div>

            {/* La Panoramica non sta in nessuno dei due ordini: qui è la
                prima voce, staccata. Il nome dice cosa c'è dentro, che è
                come la si cerca. */}
            <Link to={`/lega/${legaId}/${PANORAMICA.path}`} className="g-voce primaria" onClick={chiudi}>
              <Icona d={ICONA_PANORAMICA} />
              <span>{PANORAMICA.testo}<em>{PANORAMICA.spiega}</em></span>
              <span className="g-freccia">›</span>
            </Link>

            {/* Da scrivania l'interruttore sta in testata, e sotto i 620px
                perdeva l'etichetta (.modo .mlab{display:none}): restava una
                levetta senza nome proprio dove serviva di più. Qui ha il
                nome per esteso e dice cosa fa. */}
            <button type="button" className="g-interruttore" role="switch" aria-checked={modo === 'asta'}
              onClick={() => {
                /* cambiando modalità si torna a Oggi, che cambia con lei: con
                   l'asta accesa dice crediti e posti, spenta la giornata */
                const nuovo: Modo = modo === 'asta' ? 'stagione' : 'asta'
                onModo(nuovo); chiudi()
                void vai(`/lega/${legaId}`)
              }}>
              <span>
                <b>Modalità asta</b>
                <em>{modo === 'asta'
                  ? 'accesa: Oggi e la barra servono a comprare'
                  : 'spenta: Oggi e la barra servono alla stagione'}</em>
              </span>
              <span className="g-leva" data-on={modo === 'asta'} />
            </button>

            <p className="g-gruppo-t">
              {modo === 'asta' ? 'Le altre pagine, la stagione compresa' : 'Le altre pagine, asta compresa'}
            </p>
            {altre.map(k => (
              <NavLink key={k} to={`/lega/${legaId}/${SCHEDE[k].path}`} onClick={chiudi}
                className={({ isActive }) => `g-voce${isActive ? ' on' : ''}`}>
                <Icona d={ICONE[k]} />
                <span>{SCHEDE[k].testo}<em>{SCHEDE[k].spiega}</em></span>
                <span className="g-freccia">›</span>
              </NavLink>
            ))}

            <p className="g-gruppo-t">Il tuo accesso</p>
            <div className="g-voce statica">
              <Icona d={ICONA_LUNA} />
              {/* il tondo in testata cambia fra notte e giorno con un tocco;
                  «come il sistema» resta scegliibile qui */}
              <SceltaTema />
            </div>
            <Link to="/" className="g-voce" onClick={chiudi}>
              <Icona d={ICONA_LEGHE} />
              <span>Le tue leghe<em>{nomeLega}</em></span>
              <span className="g-freccia">›</span>
            </Link>
            <button type="button" className="g-voce" onClick={onEsci}>
              <Icona d={ICONA_ESCI} />
              <span>Esci<em>{email ?? 'dal tuo accesso'}</em></span>
              <span className="g-freccia">›</span>
            </button>
          </aside>
        </>
      )}
    </div>
    </ContestoAzione.Provider>
  )
}

/* Il tondo in testata fa il gesto che si fa dieci volte al giorno: passa
   da notte a giorno e viceversa, con un tocco. Le tre scelte per intero —
   compreso «come il sistema» — restano nel cassetto, quindi non si perde
   niente. Con nessuna scelta salvata, il verso lo decide il sistema:
   toccando si vuole l'altro di quello che si sta vedendo. */
function BottoneTema() {
  const [tema, setTema] = useState<Tema | null>(temaSalvato)
  // fuori dal browser (le anteprime rese sul server) matchMedia non c'è: vale il notte, che è il tema di partenza
  const scuro = typeof matchMedia !== 'function' || matchMedia('(prefers-color-scheme: dark)').matches
  const attuale: Tema = tema ?? (scuro ? 'notte' : 'giorno')
  const altro: Tema = attuale === 'notte' ? 'giorno' : 'notte'
  return (
    <button type="button" className="g-tondo" aria-label={`Passa al tema ${altro}`} title={`Passa al tema ${altro}`}
      onClick={() => { setTema(altro); scegliTema(altro) }}>
      <Icona d={ICONA_LUNA} />
    </button>
  )
}
