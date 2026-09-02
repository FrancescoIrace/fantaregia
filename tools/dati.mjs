#!/usr/bin/env node
/*
 * Prepara i bundle di dati che build.sh incorpora nell'app.
 *
 *   node tools/dati.mjs listone      <file.xlsx|csv>   → dati/data.json
 *   node tools/dati.mjs calendario   <file.csv>        → dati/cal_bundle.json
 *   node tools/dati.mjs statistiche  <file.xlsx>       → dati/hist_bundle.json
 *
 * I file di partenza li procuri tu: vedi dati/LEGGIMI.md. Qui dentro non c'è
 * nessun dato, solo il codice che li trasforma.
 *
 * Il listone si può anche importare direttamente dall'app, da "Lega e dati":
 * questo comando serve se preferisci averlo già dentro al file costruito.
 * Calendario e statistiche invece passano solo da qui.
 */
import fs from "fs";
import path from "path";

const RUOLI = ["P", "D", "C", "A"];
const uscita = (nome, dato) => {
  fs.mkdirSync("dati", { recursive: true });
  const p = path.join("dati", nome);
  fs.writeFileSync(p, JSON.stringify(dato));
  console.log(`  ${p}: ${(fs.statSync(p).size / 1024).toFixed(0)} KB`);
};

async function xlsx() {
  try { return (await import("xlsx")).default ?? (await import("xlsx")); }
  catch { console.error("Serve il pacchetto xlsx: npm install"); process.exit(1); }
}

/* csv con le virgolette rispettate: i ruoli Mantra contengono ";" */
function leggiCSV(txt) {
  const righe = []; let riga = [], cella = "", virg = false;
  const testa = txt.split(/\r?\n/).slice(0, 20).join("\n").replace(/"[^"]*"/g, "");
  const sep = (testa.match(/;/g) || []).length >= (testa.match(/,/g) || []).length ? ";" : ",";
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (virg) { if (c === '"') { if (txt[i + 1] === '"') { cella += '"'; i++; } else virg = false; } else cella += c; }
    else if (c === '"') virg = true;
    else if (c === sep) { riga.push(cella.trim()); cella = ""; }
    else if (c === "\n") { riga.push(cella.trim()); righe.push(riga); riga = []; cella = ""; }
    else if (c !== "\r") cella += c;
  }
  riga.push(cella.trim());
  if (riga.length > 1 || riga[0]) righe.push(riga);
  return righe;
}

const INTEST = {
  id: ["id", "cod.", "cod"], r: ["r", "ruolo"], rm: ["rm", "ruolo mantra"],
  n: ["nome", "giocatore"], s: ["squadra", "team"],
  q: ["qt.a", "qta", "qt a", "quotazione", "valore"], f: ["fvm", "fvm m"],
};
function colonne(riga) {
  const b = riga.map(c => String(c ?? "").trim().toLowerCase());
  const trova = k => { for (const x of k) { const i = b.indexOf(x); if (i >= 0) return i; } return -1; };
  return Object.fromEntries(Object.entries(INTEST).map(([k, v]) => [k, trova(v)]));
}

async function listone(file) {
  let righe;
  if (/\.csv$/i.test(file)) righe = leggiCSV(fs.readFileSync(file, "utf8"));
  else {
    const X = await xlsx();
    const wb = X.readFile(file);
    const sh = wb.Sheets["Tutti"] || wb.Sheets[wb.SheetNames[0]];
    righe = X.utils.sheet_to_json(sh, { header: 1, raw: true });
  }
  let capo = -1, col = null;
  for (let i = 0; i < Math.min(12, righe.length); i++) {
    const c = colonne(righe[i] || []);
    if (c.n >= 0 && c.s >= 0 && c.q >= 0 && c.r >= 0) { capo = i; col = c; break; }
  }
  if (capo < 0) throw new Error("non trovo le colonne Nome, Squadra, R e Qt.A");
  const out = [], visti = new Set();
  for (let i = capo + 1; i < righe.length; i++) {
    const r = righe[i] || [];
    const nome = String(r[col.n] ?? "").trim();
    const squadra = String(r[col.s] ?? "").trim();
    const ruolo = String(r[col.r] ?? "").trim().toUpperCase().charAt(0);
    const q = Math.round(Number(r[col.q]));
    if (!nome || !squadra || !RUOLI.includes(ruolo) || !(q >= 0)) continue;
    let id = col.id >= 0 ? parseInt(r[col.id]) : NaN;
    if (!(id > 0)) { id = 0; const k = nome + "|" + squadra; for (const ch of k) id = (id * 31 + ch.charCodeAt(0)) | 0; id = Math.abs(id) % 900000 + 100000; }
    if (visti.has(id)) continue;
    visti.add(id);
    const f = col.f >= 0 ? Math.round(Number(r[col.f])) : 0;
    out.push([id, ruolo, col.rm >= 0 ? String(r[col.rm] ?? "").trim() : "", nome, squadra, q, f > 0 ? f : Math.max(1, q), 1]);
  }
  if (out.length < 50) throw new Error(`ho letto solo ${out.length} giocatori: il file non sembra un listone`);
  console.log(`  ${out.length} giocatori, ${new Set(out.map(p => p[4])).size} squadre`);
  uscita("data.json", out);
}

/* calendario: csv con giornata;casa;ospite  (una riga per partita, opzionale la data ISO) */
async function calendario(file) {
  const righe = leggiCSV(fs.readFileSync(file, "utf8")).filter(r => r.length >= 3 && /^\d+$/.test(r[0]));
  if (!righe.length) throw new Error("nessuna riga valida: serve giornata;casa;ospite");
  const squadre = [...new Set(righe.flatMap(r => [r[1].trim(), r[2].trim()]))].sort();
  const giornate = Math.max(...righe.map(r => +r[0]));
  const idx = new Map(squadre.map((t, i) => [t, i]));
  const fix = squadre.map(() => Array(giornate).fill(0));
  const date = Array(giornate).fill(null);
  for (const r of righe) {
    const g = +r[0] - 1, casa = r[1].trim(), osp = r[2].trim();
    fix[idx.get(casa)][g] = idx.get(osp) + 1;      // positivo: si gioca in casa
    fix[idx.get(osp)][g] = -(idx.get(casa) + 1);   // negativo: in trasferta
    if (r[3] && /^\d{4}-\d{2}-\d{2}$/.test(r[3].trim())) date[g] = r[3].trim();
  }
  const vuote = fix.flatMap((r, i) => r.map((v, g) => v ? null : `${squadre[i]} alla giornata ${g + 1}`)).filter(Boolean);
  console.log(`  ${squadre.length} squadre, ${giornate} giornate, ${righe.length} partite`);
  if (vuote.length) console.log(`  attenzione: ${vuote.length} caselle vuote (es. ${vuote[0]})`);
  uscita("cal_bundle.json", { teams: squadre, fix, dates: date });
}

/* statistiche di una stagione conclusa: stesso formato del file ufficiale,
   colonne Id, R, Rm, Nome, Squadra, Pv, Mv, Fm, Gf, Gs, Rp, Rc, R+, R-, Ass, Amm, Esp, Au */
async function statistiche(file) {
  const X = await xlsx();
  const wb = X.readFile(file);
  const sh = wb.Sheets["Tutti"] || wb.Sheets[wb.SheetNames[0]];
  const righe = X.utils.sheet_to_json(sh, { header: 1, raw: false }).filter(r => r && r[0]);
  const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
  const out = {}; let n = 0;
  for (const r of righe) {
    const id = parseInt(r[0]); if (!(id > 0)) continue;
    const pv = num(r[5]);
    out[id] = pv
      ? [pv, Math.round(num(r[6]) * 100) / 100, Math.round(num(r[7]) * 100) / 100,
         num(r[8]), num(r[9]), num(r[10]), num(r[11]), num(r[12]), num(r[13]),
         num(r[14]), num(r[15]), num(r[16]), num(r[17]), String(r[4] ?? "").trim()]
      : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, String(r[4] ?? "").trim()];
    n++;
  }
  console.log(`  ${n} giocatori con statistiche`);
  uscita("hist_bundle.json", out);
}

const [comando, file] = process.argv.slice(2);
const azioni = { listone, calendario, statistiche };
if (!azioni[comando] || !file) {
  console.log("uso: node tools/dati.mjs <listone|calendario|statistiche> <file>");
  process.exit(1);
}
azioni[comando](file).catch(e => { console.error("  errore:", e.message); process.exit(1); });
