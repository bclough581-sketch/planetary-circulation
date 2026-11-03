const G=require('../gates.js');let bad=0;
function ok(c,m){if(!c){console.log('FAIL',m);bad++}else console.log('ok  ',m)}
function mk(cs,vs){return cs.map((c,i)=>({d:new Date(2026,0,1+i).toISOString().slice(0,10),o:c,h:c*1.01,l:c*0.99,c:c,v:vs?vs[i]:1000}))}
// deterministic pseudo-random walk
let seed=7;function rnd(){seed=(seed*1664525+1013904223)%4294967296;return seed/4294967296}
let c=100,cs=[];for(let i=0;i<200;i++){c*=1+(rnd()-0.5)*0.04;cs.push(c)}
const vs=cs.map(()=>1000+rnd()*200);
const bars=mk(cs,vs);
// reference RSI (Wilder) from python written below
const ref=JSON.parse(require('fs').readFileSync('/tmp/ref.json'));
ok(Math.abs(G.rsi(bars).value-ref.rsi)<1e-6,'RSI matches independent calc '+G.rsi(bars).value.toFixed(4)+' vs '+ref.rsi.toFixed(4));
ok(Math.abs(G.rangePos(bars).pos-ref.pos)<1e-9,'range pos matches '+G.rangePos(bars).pos.toFixed(4));
ok(Math.abs(G.pearson(G.returns(bars,60),G.returns(bars,60)).r-1)<1e-9,'self correlation = 1');
ok(G.rsi(mk(Array.from({length:30},(_,i)=>100+i))).value===100,'all-up RSI = 100');
ok(G.rsi(mk(Array.from({length:30},(_,i)=>100-i))).value===0,'all-down RSI = 0');
// volume spike on last bar, up day
const c2=cs.slice(),v2=vs.slice();c2[199]=c2[198]*1.02;v2[199]=3000;
const sp=G.volSpike(mk(c2,v2));ok(sp.status==='pass'&&sp.hitDay.daysAgo===0,'vol spike today = pass');
v2[199]=1000;v2[197]=3000;c2[197]=c2[196]*1.02;
const sp2=G.volSpike(mk(c2,v2));ok(sp2.status==='flag'&&sp2.hitDay.daysAgo===2,'spike 2 days ago = flag');
ok(G.volSpike(bars).status==='fail'||G.volSpike(bars).status!=='pass','no spike not pass');
// top of range fails
const up=mk(Array.from({length:150},(_,i)=>100+i));ok(G.rangePos(up).status==='fail','at 6-mo high = fail');
const ev=G.evaluate(bars,{AAA:bars});ok(ev.g5.status==='fail','identical held name = corr fail');
console.log(bad?'FAILED':'ALL PASS');process.exit(bad?1:0)
