import { useMemo, useState } from 'react'
import { parseRoseLega, type FileRose, type Motore, type RigaConfronto } from '../domain/motore.ts'
import { parseCSV } from '../domain/importa.ts'
import { allineaRose, registraScambio, registraSvincolo, salvaRoseMeta, type RigaAllinea } from '../data/lega.ts'
import { apriCartella } from '../lib/fogli.ts'
import { Avviso, Bottone, Card } from '../ui.tsx'

const ETICHETTA: Record<string, string> = {
  prezzo: 'prezzo diverso', squadra: "in un'altra squadra", solofile: 'solo nel file',
  soloapp: "solo nell'asta", ignoto: 'nome non riconosciuto',
}
const COLORE: Record<string, string> = { prezzo: 'warn', squadra: 'crit', solofile: 'crit', soloapp: 'crit', ignoto: 'muted' }

/* ══ Rose ufficiali della lega ═══════════════════════════════════════
   Il file che la lega pubblica dopo l'asta è la versione firmata: qui si
   confronta con quello che è stato segnato e si dice dove non combacia.
   Non tocca niente da solo. La scoperta della prima prova col file vero è
   che quasi nessuna differenza era uno sbaglio: erano movimenti di
   mercato, e vanno registrati come tali, non riscritti.                */
export default function RoseUfficiali({ legaId, motore: m, ricarica }: {
  legaId: string; motore: Motore; ricarica: () => void
}) {
  const [file, setFile] = useState<FileRose | null>(null)
  const [nomeFile, setNomeFile] = useState('')
  const [tutto, setTutto] = useState(false)
  const [giornata, setGiornata] = useState(() => m.nextG())
  const [esito, setEsito] = useState<{ tipo: 'ok' | 'errore' | 'attenzione'; testo: string } | null>(null)
  const [invio, setInvio] = useState(false)

  // il confronto si rifà da solo quando la lega cambia: dopo aver registrato
  // i movimenti, il rapporto qui sotto è già quello nuovo
  const cmp = useMemo(() => file ? m.confrontoRose(file) : null, [file, m])
  const prop = useMemo(() => cmp ? m.movimentiProposti(cmp) : null, [cmp, m])

  async function leggi(f: File | undefined) {
    if (!f) return
    setEsito(null); setTutto(false)
    try {
      let righe: unknown[][]
      if (/\.csv$/i.test(f.name)) righe = parseCSV(await f.text())
      else {
        const c = await apriCartella(f)
        righe = c.righe(c.fogli.find(n => /rose/i.test(n)) ?? c.fogli[0], false)
      }
      const letto = parseRoseLega(righe)
      setFile(letto); setNomeFile(f.name)
      const piene = letto.squadre.filter(s => s.gio.length).length
      const cmpOra = m.confrontoRose(letto)
      await salvaRoseMeta(legaId, { nome: f.name, when: Date.now(), squadre: letto.squadre.length, diverse: cmpOra.diverse }).catch(() => {})
      setEsito({ tipo: 'ok', testo: `Letto: ${letto.squadre.length} squadre${piene < letto.squadre.length ? ` (di cui ${piene} con la rosa fatta)` : ''}, ${letto.squadre.reduce((s, x) => s + x.gio.length, 0)} giocatori.` })
    } catch (e) { setFile(null); setEsito({ tipo: 'errore', testo: `Non sono riuscito a leggere il file: ${(e as Error).message}` }) }
  }

  async function registraMovimenti() {
    if (!prop?.quanti) return
    setInvio(true)
    let fatti = 0; const guai: string[] = []
    for (const s of prop.scambi) {
      try { await registraScambio(legaId, s.a.pid!, s.b.pid!, giornata); fatti++ }
      catch (e) { guai.push(`${s.a.p!.n} ↔ ${s.b.p!.n}: ${(e as Error).message}`) }
    }
    for (const s of prop.svincoli) {
      const d = s.dentro.p!
      try {
        await registraSvincolo(legaId, Number(s.tid), s.fuori.pid!, s.dentro.pid!, m.prezzoDi(s.fuori.pid!), s.dentro.cr, giornata,
          { id: d.id, r: d.r, n: d.n, s: d.s, q: d.q })
        fatti++
      } catch (e) { guai.push(`${s.fuori.p!.n} → ${d.n}: ${(e as Error).message}`) }
    }
    setInvio(false); ricarica()
    setEsito(guai.length
      ? { tipo: 'attenzione', testo: `${fatti} registrati, ${guai.length} no: ${guai[0]}` }
      : { tipo: 'ok', testo: `${fatti} ${fatti === 1 ? 'movimento registrato' : 'movimenti registrati'} dalla ${giornata}ª` })
  }

  async function allinea() {
    if (!cmp) return
    setInvio(true)
    const righe: RigaAllinea[] = cmp.righe
      .filter(r => r.pid && (r.stato === 'solofile' || r.stato === 'squadra' || r.stato === 'prezzo' || (r.stato === 'soloapp' && !r.dubbio)))
      .map(r => ({ stato: r.stato, pid: r.pid!, squadra: r.tid, prezzo: r.cr, snap: r.p ? { id: r.p.id, r: r.p.r, n: r.p.n, s: r.p.s, q: r.p.q } : null }))
    try {
      const r = await allineaRose(legaId, righe)
      const pezzi = [r.corretti && `${r.corretti} corrett${r.corretti === 1 ? 'o' : 'i'}`, r.messi && `${r.messi} aggiunt${r.messi === 1 ? 'o' : 'i'}`,
        r.tolti && `${r.tolti} tolt${r.tolti === 1 ? 'o' : 'i'}`].filter(Boolean)
      setEsito({ tipo: 'ok', testo: pezzi.length ? `Rose allineate: ${pezzi.join(', ')}` : 'Niente da allineare' })
      ricarica()
    } catch (e) { setEsito({ tipo: 'errore', testo: (e as Error).message }) }
    setInvio(false)
  }

  const conta = cmp ? { ...cmp.conta, soloapp: cmp.conta.soloapp - cmp.dubbi } : null
  const spiegati = new Set<number>()
  if (prop) {
    for (const x of prop.scambi) { spiegati.add(x.a.pid!); spiegati.add(x.b.pid!) }
    for (const x of prop.svincoli) { spiegati.add(x.fuori.pid!); spiegati.add(x.dentro.pid!) }
  }
  const problemi = cmp ? cmp.righe.filter(r => r.stato !== 'ok' && !spiegati.has(r.pid ?? -1)) : []
  const mostra = tutto ? problemi : problemi.slice(0, 14)
  const spese = cmp ? cmp.totali.filter(t => t.file !== t.app) : []

  return (
    <Card titolo="Rose ufficiali della lega" azioni={nomeFile ? <span className="hint">{nomeFile}</span> : undefined}>
      <p className="hint mb-2">Il file delle rose che la lega pubblica su <b>leghe.fantacalcio.it</b> è la versione ufficiale: caricalo qui e
        ti dico dove non combacia con quello che è stato segnato all'asta. Non tocca niente da solo — decidi tu.</p>
      <label className="cursor-pointer rounded-[7px] border border-line-strong bg-surface px-2.5 py-1 text-[12.5px] font-medium hover:border-accent hover:text-accent">
        xlsx o csv
        <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; void leggi(f) }} />
      </label>
      {esito && <div className="mt-2"><Avviso tipo={esito.tipo}>{esito.testo}</Avviso></div>}

      {cmp && conta && (
        <div className="mt-3">
          <div className="rshead">
            <span className="rspill ok">{conta.ok} combaciano</span>
            {(['prezzo', 'squadra', 'solofile', 'soloapp', 'ignoto'] as const).map(k => conta[k]
              ? <span key={k} className={`rspill ${COLORE[k]}`}>{conta[k]} {ETICHETTA[k]}</span> : null)}
            {!!cmp.dubbi && <span className="rspill muted">{cmp.dubbi} da guardare a mano</span>}
          </div>

          {!!conta.ignoto && <p className="hint mt-2">I nomi che non riconosco sono quasi sempre giocatori arrivati dopo l'ultimo listone
            caricato: aggiorna le quotazioni e ricarica il file.</p>}
          {cmp.senza.length > 0 && <p className="hint mt-2"><span className="text-warn">Non ho capito a chi corrispondono</span>{' '}
            <b>{cmp.senza.join(', ')}</b>: se hai caricato il calendario di lega, sistema gli abbinamenti nella scheda Lega e ricarica il file.</p>}

          {prop && prop.quanti > 0 && (
            <div className="rsmov">
              <div className="rsmovh">Sembrano movimenti di mercato, non errori</div>
              <p className="hint">Uno esce e un altro entra nella stessa squadra e nello stesso ruolo, oppure due si scambiano di posto:
                registrarli come movimenti lascia i punti del passato a chi possedeva il giocatore allora. Riscriverli e basta, invece, li sposterebbe.</p>
              <div className="rslist mt-2">
                {prop.scambi.map(x => (
                  <div key={`s${x.a.pid}`} className="rsrow">
                    <span className="rsn"><span className={`sq ${x.a.p!.r}`}>{x.a.p!.r}</span><span className="nm">{x.a.p!.n} ↔ {x.b.p!.n}</span></span>
                    <span className="rsq">scambio</span>
                    <span className="rsw">{m.teamName(x.a.era!)} e {m.teamName(x.b.era!)} si scambiano di posto</span>
                  </div>
                ))}
                {prop.svincoli.map(x => (
                  <div key={`v${x.fuori.pid}`} className="rsrow">
                    <span className="rsn"><span className={`sq ${x.dentro.p!.r}`}>{x.dentro.p!.r}</span><span className="nm">{x.fuori.p!.n} → {x.dentro.p!.n}</span></span>
                    <span className="rsq">svincolo</span>
                    <span className="rsw">{m.teamName(Number(x.tid))} libera <b>{x.fuori.cr}</b> e prende a <b>{x.dentro.cr}</b></span>
                  </div>
                ))}
              </div>
              <div className="rsgo">
                <label><span className="fl">Valgono dalla giornata</span>
                  <input type="number" min={1} max={38} value={giornata} onChange={e => setGiornata(parseInt(e.target.value) || 1)}
                    className="w-[78px] rounded-[7px] border border-line-strong bg-surface px-2 py-1 text-sm" /></label>
                <Bottone variante="primario" disabled={invio} onClick={() => void registraMovimenti()}>
                  Registra {prop.quanti} {prop.quanti === 1 ? 'movimento' : 'movimenti'}
                </Bottone>
              </div>
              <p className="hint">Il rimborso di ogni svincolo è il prezzo pagato a suo tempo: è la regola più comune ed è quella che fa
                tornare i totali di spesa del file. Se nella tua lega è diverso, correggi dalla scheda <b>Mercato</b>.</p>
            </div>
          )}

          {problemi.length > 0 ? (
            <>
              {prop && prop.quanti > 0 && <div className="rsmovh mt-3.5 text-muted">Il resto, voce per voce</div>}
              <div className="rslist">{mostra.map((r, i) => <Riga key={`${r.pid ?? r.nome}-${i}`} m={m} r={r} />)}</div>
              {problemi.length > mostra.length && (
                <Bottone piccolo className="mt-2" onClick={() => setTutto(true)}>Vedi tutte e {problemi.length}</Bottone>
              )}
            </>
          ) : cmp.totali.length ? (
            <p className="hint mt-2">Tutto combacia: l'asta segnata è identica alle rose ufficiali.</p>
          ) : (
            <p className="hint mt-2"><span className="text-warn">Non ho abbinato nessuna squadra</span>: né i nomi né le rose del file somigliano
              a quelle di quest'asta. Controlla di aver preso il file della lega giusta.</p>
          )}

          {spese.length > 0 && (
            <p className="hint mt-3">Somma dei prezzi in rosa diversa: {spese.map(t => `${m.teamName(t.tid)} ${t.file} nel file, ${t.app} qui`).join(' · ')}.
              È la somma secca, come la fa il file: nella scheda Rose la spesa è al netto delle correzioni dei movimenti, quindi può non coincidere.</p>
          )}

          {cmp.diverse > 0 && (
            <div className="mt-3 rounded-lg border border-crit bg-crit-soft p-3">
              <Bottone variante={prop && prop.quanti ? 'normale' : 'primario'} disabled={invio} onClick={() => void allinea()}>Allinea l'asta al file</Bottone>
              <p className="hint mt-2">Riscrive {cmp.diverse} {cmp.diverse === 1 ? 'voce' : 'voci'} prendendo il file per buono. I nomi non
                riconosciuti restano come stanno.{prop && prop.quanti > 0 && <> <span className="text-warn">Comprese le {prop.quanti} qui sopra</span>:
                  riscritte così diventano correzioni d'asta, e i punti fatti prima seguono il giocatore invece di restare a chi ce l'aveva.
                  Meglio registrare prima i movimenti.</>}</p>
              {m.moves().length > 0 && <p className="hint mt-2"><span className="text-warn">Hai {m.moves().length}{' '}
                {m.moves().length === 1 ? 'movimento registrato' : 'movimenti registrati'}</span>: il file fotografa le rose di oggi, quindi dopo
                l'allineamento controlla i crediti nella scheda Rose.</p>}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

function Riga({ m, r }: { m: Motore; r: RigaConfronto }) {
  const sq = m.teamName(r.tid)
  if (r.stato === 'ignoto') return (
    <div className="rsrow">
      <span className="rsn"><span className="nm">{r.nome}</span></span><span className="rsq">{sq}</span>
      <span className="rsw">questo nome non sta nel listone — o è arrivato dopo l'ultimo listone caricato</span>
    </div>
  )
  const p = r.p!
  const testo = r.stato === 'prezzo' ? <>nel file <b>{r.cr}</b>, nell'asta <b>{r.prezzoApp}</b></>
    : r.stato === 'squadra' ? <>nell'asta è di <b>{m.teamName(r.era!)}</b> per {r.prezzoApp}, nel file di <b>{sq}</b> per {r.cr}</>
      : r.stato === 'solofile' ? <>nel file a <b>{r.cr}</b>, nell'asta risulta libero</>
        : <>nell'asta a <b>{r.cr}</b>, nel file non c'è{r.dubbio ? ' — ma in questa squadra c\'è un nome che non riconosco, quindi lo lascio dov\'è' : ''}</>
  return (
    <div className="rsrow">
      <span className="rsn"><span className={`sq ${p.r}`}>{p.r}</span><span className="nm">{p.n}</span></span>
      <span className="rsq">{sq}</span>
      <span className="rsw">{testo}</span>
    </div>
  )
}
