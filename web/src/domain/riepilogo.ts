/* ══ Il riepilogo d'asta da esportare ════════════════════════════════
   righeRiepilogo() e righeRose() dell'app a file singolo. L'Excel riporta
   i fatti dell'asta e basta: i giudizi restano dentro l'app, dove si vede
   da cosa nascono. Qui non c'è grafica: due tabelle di valori, così si
   possono provare senza aprire niente.                                  */
import { ROLES, type Motore } from './motore.ts'

const TITLAB: Record<number, string> = { 1: 'titolare', 2: 'ballottaggio', 3: 'panchina', 4: 'fuori lista' }
export type Riga = (string | number)[]

/** una riga per giocatore, con prezzo pagato e prezzo atteso a confronto */
export function righeRose(m: Motore, finestra: { from: number; span: number }): Riga[] {
  const out: Riga[] = [['Squadra', 'Ruolo', 'Giocatore', 'Squadra di A', 'Prezzo', 'Prezzo atteso', 'Scarto',
    'Titolarità', 'Rigorista', 'Appetibilità', 'FM 25/26', 'Presenze 25/26']]
  for (const t of m.S.teams) {
    const R = m.roster(t.id)
    for (const r of ROLES) for (const x of R[r]) {
      const noto = m.byId.has(x.p.id)
      const p = m.byId.get(x.p.id) ?? x.p
      const a = m.attesaSnap(x.p), h = m.annoScorso(x.p.id)
      const e = noto ? m.rigOf(p) : null
      out.push([t.name, r, p.n, p.s, x.price, a, x.price - a,
        noto ? TITLAB[m.titStato(p).liv] : '—',
        e ? `${e[0]}º` : '', noto ? m.appet(p, finestra.from, finestra.span) : '',
        h && h.pv ? h.fm : '', h && h.pv ? h.pv : ''])
    }
  }
  return out
}

/** una riga per squadra: spesa, residuo, reparti, quanto ha pagato rispetto alla lega */
export function righeRiepilogo(m: Motore): Riga[] {
  const out: Riga[] = [['Squadra', 'Spesa', 'Crediti rimasti', 'Giocatori',
    'Portieri', 'Difensori', 'Centrocampisti', 'Attaccanti',
    'P %', 'D %', 'C %', 'A %', 'Speso vs media %', 'Titolari', 'Rigoristi']]
  for (const t of m.S.teams) {
    const st = m.stats(t.id), g = m.giudizio(t.id)
    if (!g) continue
    // spesa e residuo devono fare il budget: g.pagato è la somma dei prezzi della
    // rosa di adesso, che dopo uno svincolo non è più quanto ha speso davvero
    out.push([t.name, st.spent, st.left, g.n,
      st.perRole.P.spent, st.perRole.D.spent, st.perRole.C.spent, st.perRole.A.spent,
      g.dev.P.reale, g.dev.D.reale, g.dev.C.reale, g.dev.A.reale,
      Math.round((1 / g.resa - 1) * 100), g.titolari, g.rig])
  }
  return out
}
