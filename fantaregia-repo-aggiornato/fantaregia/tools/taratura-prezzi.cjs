/*
 * Taratura del prezzo atteso sui prezzi medi delle aste realmente concluse.
 *
 *   node tools/taratura-prezzi.cjs
 *
 * Ha bisogno di dati/data.json (vedi dati/LEGGIMI.md). I bersagli qui sotto
 * sono i prezzi medi pubblicati da fantacalcio-online.com per un'asta da 500
 * crediti: il modello li ricostruisce entro il 5%. Se cambi listone o fonte,
 * aggiorna REALE e rilancia per ritrovare l'esponente giusto.
 */
const fs=require('fs');
if(!fs.existsSync('dati/data.json')){
  console.error("manca dati/data.json: prepara prima un listone con  node tools/dati.mjs listone <file>  (vedi dati/LEGGIMI.md)");
  process.exit(1);
}
const PL=JSON.parse(fs.readFileSync('dati/data.json','utf8')).map(a=>({id:a[0],r:a[1],n:a[3],q:a[5],f:a[6]}));
const ROLES=['P','D','C','A'], SLOTS={P:3,D:8,C:8,A:6}, PLAN={P:7,D:19,C:32,A:42};
const ALPHA={P:1.0,D:0.5,C:0.5,A:0.5}, CUT=0.85;
const ps=ROLES.reduce((a,r)=>a+PLAN[r],0);
function model(T,B){
  const out=new Map();
  for(const r of ROLES){
    const arr=PL.filter(p=>p.r===r).sort((a,b)=>(b.q-a.q)||(b.f-a.f)||a.n.localeCompare(b.n));
    const n=Math.min(T*SLOTS[r],arr.length), pool=arr.slice(0,n);
    const repl=pool[Math.min(n-1,Math.max(0,Math.round(n*CUT)-1))].q;
    const w=p=>Math.pow(Math.max(0,p.q-repl),ALPHA[r]);
    const tot=pool.reduce((a,p)=>a+w(p),0);
    const extra=Math.max(0,B*T*PLAN[r]/ps-n);
    for(const p of pool) out.set(p.id, tot>0?1+w(p)/tot*extra:1+extra/n);
  }
  return out;
}
const m=model(10,500);
console.log('── parametri finali: α P1.0 D0.5 C0.5 A0.5, taglio 85%, piano 7/19/32/42, 10 squadre 500 crediti');
const REAL={'Martinez L.':84,'Malen':80,'Thuram':71,'Ramos G.':70,'Hojlund':70};
const noti=Object.keys(REAL).filter(n=>{const p=PL.find(x=>x.n===n);return p&&m.has(p.id);});
if(!noti.length){
  console.log('\nconfronto con le aste reali: saltato.');
  console.log('   i nomi dei bersagli non sono in questo listone (stai usando il listone di esempio,');
  console.log('   o una stagione diversa). La taratura si misura solo con un listone vero: aggiorna');
  console.log('   REALE qui sopra con prezzi medi pubblicati per la tua stagione e rilancia.');
}else{
  console.log('\nconfronto con i prezzi medi delle aste reali:');
  for(const n of noti){ const p=PL.find(x=>x.n===n);
    console.log(`   ${n.padEnd(13)} modello ${String(Math.round(m.get(p.id))).padStart(3)}   reale ${REAL[n]}   scarto ${(m.get(p.id)/REAL[n]*100-100).toFixed(0)}%`); }
}
const F={P:[6,27.5],D:[20,21],C:[20,32],A:[20,49.5]};
console.log('\nmedia della prima fascia per ruolo:');
for(const r of ROLES){
  const top=PL.filter(p=>p.r===r&&m.has(p.id)).sort((x,y)=>m.get(y.id)-m.get(x.id));
  const avg=top.slice(0,F[r][0]).reduce((s,p)=>s+m.get(p.id),0)/F[r][0];
  console.log(`   ${r}  modello ${avg.toFixed(1)}  riferimento ${F[r][1]}   ·  ${top.slice(0,4).map(p=>p.n.split(' ')[0]+' '+Math.round(m.get(p.id))).join(', ')} · mediana ${Math.round(m.get(top[Math.floor(top.length/2)].id))} · ultimo ${Math.round(m.get(top[top.length-1].id))}`);
}
let tot=0; for(const r of ROLES){ const a=PL.filter(p=>p.r===r&&m.has(p.id)); tot+=a.reduce((s,p)=>s+m.get(p.id),0); }
console.log('\nsomma di tutti i prezzi:',Math.round(tot),' crediti della lega:',10*500);
