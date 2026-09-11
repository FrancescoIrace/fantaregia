/*
 * La forma delle squadre esiste? Misura su una stagione vera.
 *
 *   node tools/studio-forma.cjs
 *
 * Risposta breve: la FORZA di una squadra è persistente, la FORMA no. Pesare
 * di più le partite recenti peggiora la previsione in modo monotono, fino a
 * fare peggio del non sapere niente. Da qui la scelta, nell'app, di dare a
 * tutte le giornate lo stesso peso e di smorzare la stima verso la media.
 *
 * I risultati sono fatti sportivi, non un dataset altrui: vengono da
 * openfootball, incrociati con football-data.co.uk e verificati contro la
 * classifica di Wikipedia.
 */
const fs=require('fs');
const M=fs.readFileSync('esempi/serie-a-2025-26-risultati.txt','utf8').trim().split('\n').map(r=>{
  const p=r.split('|'); return {g:+p[0],c:p[1],o:p[2],gc:+p[3],go:+p[4]};});
const teams=[...new Set(M.flatMap(x=>[x.c,x.o]))].sort();
const med=a=>a.reduce((x,y)=>x+y,0)/a.length;
const cor=(a,b)=>{const n=a.length,ma=med(a),mb=med(b);let sa=0,sb=0,sab=0;
  for(let i=0;i<n;i++){const da=a[i]-ma,db=b[i]-mb;sa+=da*da;sb+=db*db;sab+=da*db;}
  return sab/Math.sqrt(sa*sb||1);};
/* serie per squadra in ordine di giornata */
const S={}; for(const t of teams) S[t]=[];
for(const m of M){ S[m.c].push({g:m.g,gf:m.gc,gs:m.go,avv:m.o,casa:1}); S[m.o].push({g:m.g,gf:m.go,gs:m.gc,avv:m.c,casa:0}); }
for(const t of teams) S[t].sort((a,b)=>a.g-b.g);

console.log('══ 1. la forza di una squadra è persistente? (prime 14 giornate contro le seconde 14)');
for(const [nome,sel] of [['gol fatti',x=>x.gf],['gol subiti',x=>x.gs]]){
  const a=teams.map(t=>med(S[t].filter(x=>x.g<=14).map(sel)));
  const b=teams.map(t=>med(S[t].filter(x=>x.g>14).map(sel)));
  console.log(`   ${nome.padEnd(11)} r = ${cor(a,b).toFixed(3)}`);
}
console.log('\n══ 2. memoria fra una partita e la successiva (scarti dalla media di squadra)');
for(const [nome,sel] of [['gol fatti',x=>x.gf],['gol subiti',x=>x.gs]]){
  const out=[];
  for(const lag of [1,2,3,5]){
    const A=[],B=[];
    for(const t of teams){ const v=S[t].map(sel), m=med(v);
      for(let i=0;i+lag<v.length;i++){ A.push(v[i]-m); B.push(v[i+lag]-m); } }
    out.push(`lag${lag} ${cor(A,B).toFixed(3)}`);
  }
  console.log(`   ${nome.padEnd(11)} ${out.join('   ')}`);
}

/* ══ 3. modello vero: attacco × difesa avversaria × fattore campo,
       stimato solo con le giornate precedenti, con e senza peso alla forma ══ */
function stima(fino, halfLife){
  const dati=M.filter(x=>x.g<fino);
  if(!dati.length) return null;
  const w=g=>halfLife?Math.pow(0.5,(fino-g)/halfLife):1;
  let sw=0, swg=0;
  for(const m of dati){ const ww=w(m.g); sw+=2*ww; swg+=ww*(m.gc+m.go); }
  const mu=swg/sw;                                   // gol medi per squadra
  const att={}, dif={};
  for(const t of teams){ att[t]=1; dif[t]=1; }
  let hf=1;
  for(let it=0;it<25;it++){                          // punto fisso alla Poisson
    for(const t of teams){
      let nf=0,df=0,ns=0,ds=0;
      for(const m of dati){ const ww=w(m.g);
        if(m.c===t){ nf+=ww*m.gc; df+=ww*mu*dif[m.o]*hf; ns+=ww*m.go; ds+=ww*mu*att[m.o]; }
        if(m.o===t){ nf+=ww*m.go; df+=ww*mu*dif[m.c];    ns+=ww*m.gc; ds+=ww*mu*att[m.c]*hf; }
      }
      if(df>0) att[t]=Math.max(0.2,Math.min(3,nf/df));
      if(ds>0) dif[t]=Math.max(0.2,Math.min(3,ns/ds));
    }
    let nh=0,dh=0;
    for(const m of dati){ const ww=w(m.g); nh+=ww*m.gc; dh+=ww*mu*att[m.c]*dif[m.o]; }
    if(dh>0) hf=Math.max(0.8,Math.min(1.5,nh/dh));
  }
  return {mu,att,dif,hf};
}
console.log('\n══ 3. previsione dei gol della giornata n, usando solo le giornate precedenti');
console.log('   (dalla 11ª in poi, 360 previsioni per modello)');
const modelli=[
  ['media di lega, sempre uguale', null, true],
  ['attacco×difesa, tutta la stagione', null, false],
  ['attacco×difesa, emivita 10 giornate', 10, false],
  ['attacco×difesa, emivita 6 giornate', 6, false],
  ['attacco×difesa, emivita 4 giornate', 4, false],
  ['attacco×difesa, emivita 2 giornate', 2, false],
];
const res=[];
for(const [nome,hl,soloMedia] of modelli){
  let se=0,ae=0,n=0,ll=0;
  for(let g=11;g<=28;g++){
    const st=stima(g,hl); if(!st) continue;
    for(const m of M.filter(x=>x.g===g)){
      const p=[[m.gc, soloMedia?st.mu:st.mu*st.att[m.c]*st.dif[m.o]*st.hf],
               [m.go, soloMedia?st.mu:st.mu*st.att[m.o]*st.dif[m.c]]];
      for(const [y,lam] of p){ const e=y-lam; se+=e*e; ae+=Math.abs(e); n++;
        ll+= -lam + y*Math.log(Math.max(lam,1e-9)) - Math.log([1,1,2,6,24,120,720,5040][Math.min(y,7)]); }
    }
  }
  res.push({nome,rmse:Math.sqrt(se/n),mae:ae/n,ll:ll/n,n});
}
const base=res[0].rmse;
for(const r of res)
  console.log(`   ${r.nome.padEnd(38)} RMSE ${r.rmse.toFixed(4)}  MAE ${r.mae.toFixed(4)}  logLik ${r.ll.toFixed(4)}   ${((r.rmse/base-1)*100).toFixed(2)}% contro la media di lega`);

/* ══ 4. quanto va "tirato verso la media" un attacco stimato su poche giornate ══ */
console.log('\n══ 4. la stima va smorzata? (k = quante partite fittizie di media aggiungo)');
function prova(k){
  let se=0,n=0;
  for(let g=6;g<=28;g++){
    const st=stima(g,null); if(!st) continue;
    const npart=g-1;                                  // partite giocate da ogni squadra
    const sh=v=>(npart*v+k*1)/(npart+k);
    for(const m of M.filter(x=>x.g===g)){
      const l1=st.mu*sh(st.att[m.c])*sh(st.dif[m.o])*st.hf;
      const l2=st.mu*sh(st.att[m.o])*sh(st.dif[m.c]);
      se+=(m.gc-l1)**2+(m.go-l2)**2; n+=2;
    }
  }
  return Math.sqrt(se/n);
}
const b0=prova(0);
for(const k of [0,2,4,6,8,12,20,40]){
  const r=prova(k);
  console.log(`   k=${String(k).padStart(2)}  RMSE ${r.toFixed(4)}   ${((r/b0-1)*100).toFixed(2)}% contro nessuno smorzamento`);
}
/* ══ 5. da quale giornata la stima sui risultati comincia a servire ══ */
console.log('\n══ 5. errore per fascia di giornate (modello attacco×difesa contro media di lega)');
for(const [da,a] of [[3,8],[9,14],[15,21],[22,28]]){
  let s1=0,s2=0,n=0;
  for(let g=da;g<=a;g++){
    const st=stima(g,null); if(!st) continue;
    for(const m of M.filter(x=>x.g===g)){
      s1+=(m.gc-st.mu*st.att[m.c]*st.dif[m.o]*st.hf)**2+(m.go-st.mu*st.att[m.o]*st.dif[m.c])**2;
      s2+=(m.gc-st.mu)**2+(m.go-st.mu)**2; n+=2;
    }
  }
  const r1=Math.sqrt(s1/n), r2=Math.sqrt(s2/n);
  console.log(`   giornate ${da}-${a}: modello ${r1.toFixed(3)}  media di lega ${r2.toFixed(3)}   ${((r1/r2-1)*100).toFixed(1)}%`);
}
