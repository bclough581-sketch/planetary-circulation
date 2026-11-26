'use strict';
// The heat map: a squarified treemap of the tracked universe, sized by dollar volume and
// coloured by return. These checks are about geometry and honesty, not about looks.
const fs=require('fs');const path=require('path');const assert=require('node:assert/strict');
const SRC=fs.readFileSync(path.join(__dirname,'..','amalgam-daily.html'),'utf8');

function extract(name){
  const start=SRC.indexOf('function '+name+'(');
  assert.ok(start>=0,name+' is missing');
  let depth=0;
  for(let j=SRC.indexOf('{',start);j<SRC.length;j++){
    if(SRC[j]==='{')depth++; else if(SRC[j]==='}'){depth--;if(!depth)return SRC.slice(start,j+1);}
  }
  throw new Error('unbalanced braces in '+name);
}
const CONSTS=SRC.match(/var HEAT_WINS = \[[^\]]*\];/)[0]+'\n'+SRC.match(/var HEAT_CAP  = \{[^}]*\};/)[0];
const BODY=CONSTS+'\n'+['esc','heatSquarify','heatStat','heatColor','heatPct','heatInline']
  .map(extract).join('\n');
const api=new Function(BODY+'\nreturn {heatSquarify,heatStat,heatColor,heatPct,heatInline};')();

// ---- geometry -------------------------------------------------------------------------
{
  const vals=[500,220,180,95,60,44,30,21,13,8,5,3,2,1];
  const items=vals.map((v,i)=>({sym:'S'+i,v:v,r:0}));
  const W=1000,H=520,r=api.heatSquarify(items,0,0,W,H);
  assert.equal(r.length,items.length,'every item gets a tile');
  const area=r.reduce((s,q)=>s+q.w*q.h,0);
  assert.ok(Math.abs(area-W*H)<1,'tiles fill the box exactly, got '+area);
  assert.ok(r.every(q=>q.w>0&&q.h>0),'no zero-size tile');
  assert.ok(r.every(q=>q.x>=-1e-6&&q.y>=-1e-6&&q.x+q.w<=W+1e-6&&q.y+q.h<=H+1e-6),'inside the box');
  for(let i=0;i<r.length;i++)for(let j=i+1;j<r.length;j++){
    const a=r[i],b=r[j];
    const over=Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>1e-6
            && Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>1e-6;
    assert.ok(!over,'tiles '+i+' and '+j+' overlap');
  }
  // area is proportional to value, which is the only reason a treemap is readable
  const big=r.find(q=>q.it.sym==='S0'), small=r.find(q=>q.it.sym==='S13');
  assert.ok(Math.abs((big.w*big.h)/(small.w*small.h)-500)<5,'area tracks value');
}
assert.deepEqual(api.heatSquarify([],0,0,100,100),[],'empty input is safe');
assert.deepEqual(api.heatSquarify([{v:0}],0,0,100,100),[],'zero total is safe');

// ---- colour carries direction, never identity -------------------------------------------
{
  const g=api.heatColor(0.05,0.12).match(/\d+/g).map(Number);
  const rd=api.heatColor(-0.05,0.12).match(/\d+/g).map(Number);
  const flat=api.heatColor(0,0.12).match(/\d+/g).map(Number);
  assert.ok(g[1]>g[0]&&g[1]>g[2],'a gain is green');
  assert.ok(rd[0]>rd[1]&&rd[0]>rd[2],'a loss is red');
  assert.deepEqual(flat,[26,26,26],'flat is the neutral, not a colour');
  const strong=api.heatColor(0.30,0.12).match(/\d+/g).map(Number);
  assert.ok(strong[1]>=g[1],'bigger gain is not less green');
  assert.equal(api.heatColor(99,0.12),api.heatColor(0.12,0.12),'the scale saturates at the cap');
}
// under 10% a decimal is worth the room; past that it is noise
assert.equal(api.heatPct(0.0512),'+5.1%');
assert.equal(api.heatPct(-0.0512),'−5.1%','a loss uses a true minus, not a hyphen');
assert.equal(api.heatPct(-0.012),'−1.2%');
assert.equal(api.heatPct(0.237),'+24%','big moves drop the decimal');
assert.equal(api.heatPct(0),'+0.0%');

// ---- the panel ---------------------------------------------------------------------------
function bars(n,start,step,vol){
  const out=[];let c=start;
  for(let i=0;i<n;i++){out.push(['2026-01-'+(i%28+1),c,c,c,c,vol||1e6]);c*=step;}
  return out;
}
const M={asof:'2026-11-25',universe:['AAA','BBB','CCC'],
  bars:{AAA:bars(80,100,1.001,5e6),BBB:bars(80,50,0.999,2e6),CCC:bars(80,10,1.0,1e6),SPY:bars(80,400,1.0005,9e7)},
  picks:{date:'2026-11-25',status:'OK',syms:['BBB']}};
{
  const h=api.heatInline(M,20);
  assert.ok(/<svg /.test(h),'draws an svg');
  assert.equal((h.match(/<rect /g)||[]).length,3,'one tile per tracked name');
  assert.ok(h.includes('AAA')&&h.includes('BBB')&&h.includes('CCC'),'every name is labelled');
  assert.ok(/stroke="#e6edf5"/.test(h),'the pick is outlined');
  assert.equal((h.match(/stroke="#e6edf5"/g)||[]).length,1,'only the pick is outlined');
  assert.ok(h.includes('SPY is'),'the benchmark is stated, so a tile is read against something');
  assert.ok(/Nothing on it is a signal/.test(h),'the panel says it is not advice');
  assert.ok(/Tile size is how many dollars a day actually trade/.test(h),'it says what size means');
  HEAT_CHECK: {
    const btns=h.match(/data-act="hwin" data-h="(\d+)"/g)||[];
    assert.equal(btns.length,4,'four windows offered');
    assert.equal((h.match(/mini2 on/g)||[]).length,1,'exactly one window is marked current');
  }
}
// a pick outside the tracked universe must be explained rather than silently absent
{
  const M2=JSON.parse(JSON.stringify(M)); M2.picks.syms=['ZZZ'];
  const h=api.heatInline(M2,20);
  assert.ok(/none of them is in this map/.test(h),'says why the pick is not shown');
  assert.equal((h.match(/stroke="#e6edf5"/g)||[]).length,0,'nothing is falsely outlined');
}
// short history must not throw and must be counted out loud
{
  const M3=JSON.parse(JSON.stringify(M)); M3.bars.CCC=bars(5,10,1.0,1e6);
  const h=api.heatInline(M3,20);
  assert.equal((h.match(/<rect /g)||[]).length,2,'the short name is dropped');
  assert.ok(/too little history/.test(h),'and the drop is reported');
}
assert.ok(/No price data loaded yet/.test(api.heatInline({universe:[],bars:{}},20)),'empty data is safe');
assert.ok(/No price data loaded yet/.test(api.heatInline(null,20)),'null market is safe');

// ---- wiring in the built page --------------------------------------------------------------
assert.ok(SRC.includes('function heatSection()'),'the wide band has a heat section');
assert.ok(SRC.includes('function heatHtml()'),'the phone has a heat sheet');
assert.ok(SRC.includes('data-act="heat"'),'there is a button to open it');
assert.ok(SRC.includes("S.panel==='heat'"),'the button is wired to the panel');
assert.ok(SRC.includes('grid-area:heat'),'it has a place in the wide grid');
assert.ok(/\.z-heat\{display:none\}/.test(SRC.replace(/\s+/g,'')) ||
          SRC.includes('.z-heat{display:none}'),'it is hidden where there is no room');
console.log('test_daily_heat.cjs PASS');
