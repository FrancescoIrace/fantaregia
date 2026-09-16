/* Il tabellone delle squadre della Panoramica: crediti, slot per reparto,
   tetto, giudizio e chi le allena. Da scrivania è la tabella di sempre; sul
   telefono la stessa roba in righe, perché la tabella chiedeva 640px e a
   390 si scorreva di lato per leggere il residuo. Nessuna colonna sparisce:
   in riga ci sono tutte, disposte su tre livelli. */
import { ROLES, type Motore } from '../domain/motore.ts'
import type { RigheLega } from '../data/componi.ts'
import { Bottone, Ruolo } from '../ui.tsx'
import { useTelefono } from '../viste/telefono.ts'

export interface MembroLega { utente_id: string; nome: string | null }

export default function SquadreLega({ motore, righe, mia, utenteId, membri, puoAssegnare, onAllenatore, telefono: forzato }: {
  motore: Motore; righe: RigheLega; mia: number | null; utenteId: string; membri: MembroLega[]
  puoAssegnare: boolean; onAllenatore: (tid: number, uid: string | null) => void
  /** per i test di resa, che girano fuori dal browser: altrimenti decide la larghezza */
  telefono?: boolean
}) {
  const larghezza = useTelefono()
  const telefono = forzato ?? larghezza
  const colore = (tid: number) => righe.squadre.find(s => s.id === tid)?.colore ?? null
  const allenatore = (tid: number) => righe.squadre.find(s => s.id === tid)?.allenatore ?? null
  const nomeMembro = (uid: string) => membri.find(m => m.utente_id === uid)?.nome ?? 'un altro membro'
  const votoCol = (g: { voto: number } | null) => !g ? 'text-muted' : g.voto >= 70 ? 'text-ok' : g.voto >= 55 ? 'text-warn' : 'text-crit'

  /* Chi allena la squadra: chi scrive assegna, chi no vede il nome o se la
     prende se è libera. Uguale nei due disegni, cambia solo la misura. */
  const allenatoreDi = (tid: number, classe: string) =>
    righe.allenatoreMancante ? <span className="text-muted">—</span>
      : puoAssegnare ? (
        <select value={allenatore(tid) ?? ''} onChange={e => onAllenatore(tid, e.target.value || null)} className={classe}>
          <option value="">libera</option>
          {membri.map(m => <option key={m.utente_id} value={m.utente_id}>{m.nome ?? 'utente'}</option>)}
        </select>
      ) : allenatore(tid) ? (
        <span className={allenatore(tid) === utenteId ? 'font-semibold' : 'text-muted'}>
          {allenatore(tid) === utenteId ? 'tu' : nomeMembro(allenatore(tid)!)}
        </span>
      ) : <Bottone piccolo onClick={() => onAllenatore(tid, utenteId)}>Prendila</Bottone>

  if (telefono) return (
    <div className="m-squadre">
      {motore.S.teams.map(t => {
        const st = motore.stats(t.id), g = motore.giudizio(t.id), c = colore(t.id)
        return (
          <div key={t.id} className={`m-squadra${t.id === mia ? ' mia' : ''}`} style={c ? { ['--tinta' as string]: c } : undefined}>
            <div className="m-testo">
              <p className="m-nome">
                {t.name}{t.id === mia && <span className="m-io">io</span>}
              </p>
              <div className="m-allenatore">{allenatoreDi(t.id, 'm-select')}</div>
              <p className="m-slot">
                {ROLES.map(r => (
                  <span key={r} className={st.perRole[r].count >= motore.S.slots[r] ? 'pieno' : ''}>
                    <span className="ruolo-lettera">{r}</span><span className="fr-num">{st.perRole[r].count}/{motore.S.slots[r]}</span>
                  </span>
                ))}
              </p>
            </div>
            <div className="m-crediti">
              <b className="fr-num">{st.left}</b>
              <span className="m-meta">residuo · spesi <span className="fr-num">{st.spent}</span></span>
              <span className={`m-meta${st.slotsLeft > 0 && st.max <= 2 ? ' text-crit' : ''}`}>tetto <span className="fr-num">{st.slotsLeft > 0 ? st.max : '—'}</span></span>
              <span className="m-meta">giudizio <b className={`fr-num ${votoCol(g)}`}>{g ? g.voto : '—'}</b></span>
            </div>
          </div>
        )
      })}
    </div>
  )

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="text-left text-[11px] tracking-wider text-muted uppercase">
            <th className="py-1.5 pr-3 font-semibold">Squadra</th>
            <th className="px-2 py-1.5 font-semibold">Allenatore</th>
            {ROLES.map(r => <th key={r} className="px-1.5 py-1.5 text-center"><Ruolo r={r} /></th>)}
            <th className="px-2 py-1.5 text-right font-semibold">Spesi</th>
            <th className="px-2 py-1.5 text-right font-semibold">Residuo</th>
            <th className="px-2 py-1.5 text-right font-semibold">Tetto</th>
            <th className="py-1.5 pl-2 text-right font-semibold">Giudizio</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {motore.S.teams.map(t => {
            const st = motore.stats(t.id), g = motore.giudizio(t.id)
            return (
              <tr key={t.id} className={t.id === mia ? 'bg-accent-soft' : ''}>
                <td className="py-1.5 pr-3 font-semibold">
                  {colore(t.id) && <span className="gagliardetto mr-2" style={{ ['--tinta' as string]: colore(t.id)! }} />}
                  {t.name}{t.id === mia && <span className="ml-2 text-[11px] text-accent">io</span>}
                </td>
                <td className="px-2 py-1.5 text-[12.5px]">
                  {allenatoreDi(t.id, 'rounded-[7px] border border-line-strong bg-surface px-1.5 py-0.5 text-[12.5px]')}
                </td>
                {ROLES.map(r => (
                  <td key={r} className={`px-1.5 py-1.5 text-center font-mono text-[12.5px] ${st.perRole[r].count >= motore.S.slots[r] ? 'text-muted' : ''}`}>
                    {st.perRole[r].count}/{motore.S.slots[r]}
                  </td>
                ))}
                <td className="px-2 py-1.5 text-right font-mono">{st.spent}</td>
                <td className="px-2 py-1.5 text-right font-mono font-semibold">{st.left}</td>
                <td className={`px-2 py-1.5 text-right font-mono ${st.slotsLeft > 0 && st.max <= 2 ? 'text-crit' : ''}`}>{st.slotsLeft > 0 ? st.max : '—'}</td>
                <td className={`py-1.5 pl-2 text-right font-mono font-semibold ${votoCol(g)}`}>{g ? g.voto : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
