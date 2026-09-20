/* ══ Gli indisponibili di tutte le tue leghe, con un file solo ═════════
   Il file lo prepara ogni giorno la routine che cerca infortuni e
   squalifiche di serie A: è lo stesso per tutte le leghe, ma ogni lega ha
   il suo listone, la sua rosa e i suoi infortunati, quindi la proposta si
   guarda lega per lega e solo dopo si applica.

   Vale per le leghe che gestisci (admin o banditore): sono le sole in cui
   puoi già scrivere, e la scrittura è la stessa di «Infermeria». Quello che
   non si può applicare da qui — un omonimo da scegliere, un nome che non
   c'è — resta indicato per lega, con il modo di arrivarci.              */
import { useState } from 'react'
import { Link } from 'react-router'
import { applicaLega, preparaLega, type LegaGestita, type Preparata } from '../data/infortuni-leghe.ts'
import { daApplicare, leggiFileIndisponibili, riassuntoProposta, segnalazioni } from '../domain/indisponibili.ts'
import { righeDaFile } from '../lib/fogli.ts'
import { Avviso, Bottone, Card } from '../ui.tsx'

type Esito = { file: string; righe: { id: string; nome: string; ok: boolean; testo: string }[] }

export default function InfortuniLeghe({ utenteId, leghe }: { utenteId: string; leghe: LegaGestita[] }) {
  const [file, setFile] = useState<string | null>(null)
  const [elenco, setElenco] = useState<Preparata[] | null>(null)
  const [scelte, setScelte] = useState<Set<string>>(new Set())
  const [lavoro, setLavoro] = useState<'leggo' | 'applico' | null>(null)
  const [esito, setEsito] = useState<Esito | null>(null)
  const [errore, setErrore] = useState<string | null>(null)

  async function leggi(f: File) {
    setErrore(null); setEsito(null); setElenco(null); setLavoro('leggo')
    try {
      const voci = leggiFileIndisponibili(await righeDaFile(f, false))
      if (!voci.length) throw new Error('nel file non c\'è nessuna riga con un nome')
      const preparate = await Promise.all(leghe.map(l => preparaLega(l, utenteId, voci)))
      setFile(f.name); setElenco(preparate)
      // si parte da quelle in cui c'è qualcosa da fare: le altre si possono solo guardare
      setScelte(new Set(preparate.filter(p => p.stato === 'pronta' && daApplicare(p.proposta) > 0).map(p => p.lega.id)))
    } catch (e) { setErrore(`${f.name}: ${(e as Error).message}`) }
    setLavoro(null)
  }

  const scegli = (id: string, su: boolean) => setScelte(s => { const n = new Set(s); if (su) n.add(id); else n.delete(id); return n })

  async function applica() {
    if (!elenco || !file) return
    setLavoro('applico')
    const righe: Esito['righe'] = []
    // una lega alla volta: un errore in una non deve fermare le altre, e si sa dov'è successo
    for (const p of elenco) {
      if (p.stato !== 'pronta' || !scelte.has(p.lega.id)) continue
      try {
        const r = await applicaLega(p)
        const mancano = [p.notaMancante && 'le note', !r.storico && p.proposta.rientrano.length && 'lo storico dei rientri'].filter(Boolean)
        righe.push({ id: p.lega.id, nome: p.lega.nome, ok: true,
          testo: r.parti.join(', ') + (mancano.length ? ` (non salvati ${mancano.join(' e ')}: manca la migrazione)` : '') })
      } catch (e) { righe.push({ id: p.lega.id, nome: p.lega.nome, ok: false, testo: (e as Error).message }) }
    }
    setEsito({ file, righe }); setElenco(null); setFile(null); setLavoro(null)
  }

  const scelte_ = elenco?.filter((p): p is Extract<Preparata, { stato: 'pronta' }> => p.stato === 'pronta' && scelte.has(p.lega.id)) ?? []
  const quanti = scelte_.reduce((n, p) => n + daApplicare(p.proposta), 0)

  return (
    <Card titolo="Infortunati di tutte le tue leghe"
      azioni={<span className="hint">{leghe.length} leghe · csv o xlsx · nome;stato;nota</span>}>
      <div className="space-y-3">
        {!elenco && (
          <>
            <p className="hint">
              Il file degli indisponibili, quello con <b>nome;stato;nota</b>, si carica una volta sola e vale per tutte le leghe
              che gestisci. Non scrivo niente subito: per ogni lega ti faccio vedere chi entra, chi rientra e cosa non torna.
            </p>
            <label className="fr-bottone inline-flex cursor-pointer items-center rounded-[7px] border border-line-strong bg-surface px-3.5 py-1.5 text-[13.5px] font-medium hover:border-accent hover:text-accent">
              {lavoro === 'leggo' ? 'Leggo le leghe…' : 'Scegli il file'}
              <input type="file" className="hidden" accept=".csv,.txt,.xlsx,.xls" disabled={lavoro !== null}
                onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void leggi(f) }} />
            </label>
          </>
        )}

        {errore && <Avviso tipo="errore">{errore}</Avviso>}

        {esito && (
          <Avviso tipo={esito.righe.every(r => r.ok) ? 'ok' : 'errore'}>
            <b>{esito.file}</b>{esito.righe.length ? '' : ': nessuna lega scelta, non ho scritto niente.'}
            <ul className="mt-1 space-y-0.5">
              {esito.righe.map(r => <li key={r.id}><b>{r.nome}</b>: {r.ok ? r.testo : `non applicato — ${r.testo}`}</li>)}
            </ul>
          </Avviso>
        )}

        {elenco && (
          <>
            <p className="hint"><b>{file}</b> · {quanti ? `${quanti} ${quanti === 1 ? 'cambiamento' : 'cambiamenti'} in ${scelte_.length} ${scelte_.length === 1 ? 'lega' : 'leghe'}` : 'niente da applicare'}</p>
            <ul className="divide-y divide-line">
              {elenco.map(p => {
                const pronta = p.stato === 'pronta'
                const fare = pronta ? daApplicare(p.proposta) : 0
                const guai = pronta ? segnalazioni(p.proposta) : []
                return (
                  <li key={p.lega.id} className="py-2.5">
                    <label className="flex items-start gap-3">
                      <input type="checkbox" checked={scelte.has(p.lega.id)} disabled={!fare || lavoro !== null}
                        aria-label={`Applica a ${p.lega.nome}`} onChange={e => scegli(p.lega.id, e.target.checked)} />
                      <span className="min-w-0 flex-1">
                        <b>{p.lega.nome}</b>
                        <span className="block text-sm text-muted">
                          {p.stato === 'pronta' && (fare ? riassuntoProposta(p.proposta).join(' · ') : 'niente da fare: è già tutto com\'è nel file')}
                          {p.stato === 'senza-listone' && 'senza listone: non c\'è ancora niente da abbinare, la salto'}
                          {p.stato === 'errore' && `non riesco a leggerla — ${p.testo}`}
                        </span>
                        {/* nella stessa colonna del nome, così si allinea con qualunque larghezza della casella */}
                        {guai.length > 0 && (
                          <span className="mt-1 block text-sm text-muted">
                            Da sistemare a mano: {guai.join(', ')}. Queste righe non le applico.{' '}
                            <Link to={`/lega/${p.lega.id}/infermeria`} className="text-accent underline">Apri l'Infermeria</Link>
                          </span>
                        )}
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Bottone variante="primario" disabled={!quanti || lavoro !== null} onClick={() => void applica()}>
                {lavoro === 'applico' ? 'Applico…' : `Applica${quanti ? ` (${quanti})` : ''}`}
              </Bottone>
              <Bottone disabled={lavoro !== null} onClick={() => { setElenco(null); setFile(null) }}>Annulla</Bottone>
            </div>
          </>
        )}
      </div>
    </Card>
  )
}
