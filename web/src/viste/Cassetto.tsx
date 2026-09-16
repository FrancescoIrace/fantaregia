/* ══ Il cassetto ═════════════════════════════════════════════════════
   Un pannello che sale dal basso sopra quello che stai guardando e lo
   lascia dov'era. Stesse classi della scheda giocatore e di «Chi
   schierare» (.modal, .pcard: il disegno da cassetto sta in
   componenti.css), così sul telefono tutto quello che si apre si apre
   allo stesso modo. Si chiude col ✕, toccando fuori o con Esc.        */
import { useEffect, type ReactNode } from 'react'

export default function Cassetto({ titolo, sotto, onChiudi, children }: {
  titolo: string; sotto?: ReactNode; onChiudi: () => void; children: ReactNode
}) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onChiudi() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onChiudi])
  return (
    <div className="modal on" onClick={e => { if (e.target === e.currentTarget) onChiudi() }}>
      <div className="pcard" role="dialog" aria-modal="true" aria-label={titolo}>
        <div className="phead">
          <div className="pid"><h3>{titolo}</h3>{sotto && <div className="sub">{sotto}</div>}</div>
          <button type="button" className="pclose" onClick={onChiudi} title="Chiudi" autoFocus>✕</button>
        </div>
        <div className="psec">{children}</div>
      </div>
    </div>
  )
}
