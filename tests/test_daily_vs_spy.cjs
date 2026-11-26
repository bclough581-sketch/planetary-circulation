'use strict';
// You against SPY. The link carries the numbers, the panel draws them, and blue
// means ahead of SPY rather than up.
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
const CONSTS=['VS_CAP','VS_ORDER','VS_LABEL','VS_EXPECT','VS_STALE_DAYS']
  .map(n=>{const m=SRC.match(new RegExp('var '+n+' = [^;]+;'));assert.ok(m,n+' is missing');return m[0];})
  .join('\n');
const api=new Function('location',CONSTS+'\n'+
  ['esc','vsColor','vsSign','vsBar','vsAge','vsInline','pushParse'].map(extract).join('\n')+
  '\nreturn {vsColor,vsSign,vsBar,vsAge,vsInline,pushParse,VS_CAP,VS_STALE_DAYS};');
const F=h=>api({hash:'#'+h,search:''});
const rgb=s=>s.match(/\d+/g).map(Number);
const A=F('');   // any instance is fine for the pure functions

// ---- the link: a loss must survive a hash whose separator is a minus sign ---------------------
// Returns ride as basis points plus 50000, so -10.76% is written 48924 and never "-1076".
{
  const hash='20261126-AAPL-10-15000-14000-a-239402-239256'
            +'-h-AAPL-10-15000-14000-14500'
            +'-s-wk-49998-49501-8-s-mo-49630-49312-21-s-al-48924-49334-45';
  assert.ok(!/-\d*-s--/.test(hash),'no bare minus sign is written into the link');
  const p=F(hash).pushParse();
  assert.ok(p,'the link parses');
  assert.equal(p.vs.length,3,'three windows arrive');
  assert.deepEqual(p.vs.map(v=>v.code),['wk','mo','al'],'in the order they were written');
  assert.ok(Math.abs(p.vs[2].you+10.76)<1e-9,'a loss decodes as a loss: '+p.vs[2].you);
  assert.ok(Math.abs(p.vs[2].bench+6.66)<1e-9,'and so does SPY');
  assert.equal(p.vs[0].days,8,'the real trading-day span rides along');
  // the other tails must survive sitting in front of the new ones
  assert.equal(p.picks.length,1,'the pick still parses');
  assert.equal(p.picks[0].sym,'AAPL','with its ticker');
  assert.ok(p.acct&&Math.abs(p.acct.netLiq-2394.02)<1e-9,'the account tail still parses');
  assert.equal(p.held.length,1,'and the held book still parses');
}
// a scoreboard tail on its own, with no account and no book
{
  const p=F('20261126-AAPL-10-15000-14000-s-al-48924-49334-45').pushParse();
  assert.equal(p.vs.length,1,'the scoreboard needs no other tail');
  assert.equal(p.acct,null,'and invents no account');
}
// junk is dropped without taking the rest of the link down
for(const bad of ['-s-zz-49998-49501-8','-s-wk-99999999-49501-8','-s-wk-49998-49501-99999'])
  { const p=F('20261126-AAPL-10-15000-14000'+bad).pushParse();
    assert.ok(p,'a malformed window does not break the link: '+bad);
    assert.equal(p.vs.length,0,'and is not shown: '+bad);
    assert.equal(p.picks.length,1,'while the pick survives: '+bad); }
// no tail at all
assert.deepEqual(F('20261126-AAPL-10-15000-14000').pushParse().vs,[],'no tail, no scoreboard');

// ---- colour says ahead or behind, not up or down ----------------------------------------------
{
  const ahead=rgb(A.vsColor(5)), behind=rgb(A.vsColor(-5)), level=rgb(A.vsColor(0));
  assert.ok(ahead[2]>ahead[0],'ahead of SPY is blue');
  assert.ok(behind[0]>behind[2],'behind SPY is red');
  assert.deepEqual(level,[26,26,26],'level with SPY is the neutral, not a colour');
  assert.deepEqual(rgb(A.vsColor(99)),rgb(A.vsColor(A.VS_CAP)),'past the cap the colour stops moving');
  assert.equal(A.vsColor(null),'rgb(26,26,26)','a missing spread is neutral');
}
// ---- the bar is centred on zero and never leaves the box --------------------------------------
{
  assert.deepEqual(A.vsBar(0),{left:50,width:0},'level with SPY draws nothing');
  const up=A.vsBar(5), dn=A.vsBar(-5);
  assert.equal(up.left,50,'ahead grows rightward from the centre');
  assert.equal(dn.left+dn.width,50,'behind grows leftward to the centre');
  assert.equal(up.width,dn.width,'the same distance either way');
  for(const sp of [0,1,-1,9.9,-9.9,10,-10,40,-40,1e6,-1e6]){
    const g=A.vsBar(sp);
    assert.ok(g.left>=0&&g.width>=0&&g.left+g.width<=100.0001,'the bar stays inside the box at '+sp);
    assert.ok(g.width<=50.0001,'and never crosses the centre line at '+sp); }
}
// ---- the panel -------------------------------------------------------------------------------
{
  const h=A.vsInline([{code:'wk',you:-0.02,bench:-4.99,days:8},
                      {code:'mo',you:-3.70,bench:-6.88,days:21},
                      {code:'al',you:-10.76,bench:-6.66,days:45}]);
  assert.ok(/−4\.1 points behind SPY/.test(h),'the headline is the spread since the start');
  assert.ok(/#ff3b3b/.test(h),'and it is red, because he is behind');
  assert.ok(/\+5\.0/.test(h),'this week he is ahead by 5 points');
  assert.ok(/you −0\.0% · SPY −5\.0%/.test(h),'with both legs shown, so blue while down is plain');
  assert.ok(/8 trading days, not 5/.test(h),'an eight-day week is called an eight-day week');
  assert.ok(!/21 trading days, not 21/.test(h),'a month that is a month says nothing');
  assert.ok(/THREE MONTHS<\/div>[\s\S]{0,120}short/.test(h),'a window with no history reads short');
  assert.ok(/time-weighted/.test(h),'the footer says why a deposit cannot move the number');
}
{
  const h=A.vsInline([{code:'al',you:12.0,bench:4.0,days:200}]);
  assert.ok(/\+8\.0 points ahead of SPY/.test(h),'ahead reads ahead');
  assert.ok(/#5b8cff/.test(h),'in tron blue');
}
assert.ok(/No scoreboard yet/.test(A.vsInline([])),'with no data it says so and shows no number');
assert.ok(!/NaN|undefined/.test(A.vsInline([{code:'al',you:1,bench:2,days:3}])),
  'no NaN or undefined reaches the screen');

// ---- an old scoreboard must say it is old ------------------------------------------------------
{
  const iso=d=>new Date(Date.now()-d*86400000).toISOString().slice(0,10);
  const one=[{code:'al',you:-10.76,bench:-6.66,days:45}];
  assert.equal(A.vsAge(null),null,'no date, no age');
  assert.equal(A.vsAge('not a date'),null,'junk is not an age');
  assert.equal(A.vsAge(iso(0)),0,'today is nought days old');
  assert.equal(A.vsAge(iso(9)),9,'nine days ago is nine days old');
  assert.ok(!/vs-stale/.test(A.vsInline(one,iso(0))),'a fresh scoreboard says nothing about its age');
  assert.ok(!/vs-stale/.test(A.vsInline(one,iso(A.VS_STALE_DAYS))),'and nor does one at the limit');
  const old=A.vsInline(one,iso(9));
  assert.ok(/vs-stale/.test(old),'past the limit it says how old it is');
  assert.ok(/9 days ago/.test(old),'with the day count');
  assert.ok(/Nothing since then is in it/.test(old),'and what that means');
  assert.ok(/−4\.1 points behind SPY/.test(old),'the number is still shown, not hidden');
  assert.ok(!/vs-stale/.test(A.vsInline(one)),'with no date at all it makes no claim about age');
}
// ---- the icon alone is enough: the book and the scoreboard outlive the link -------------------
assert.ok(SRC.includes("db.doc('settings/book')"),'the book and scoreboard are saved');
assert.ok(SRC.includes('async function loadBook()'),'and read back');
assert.ok(/await loadAcct\(\); await loadBook\(\)/.test(SRC),'at boot, beside the account');
assert.ok(SRC.includes('S.bookDate=hp.date'),'a link stamps its own date over the saved one');
assert.ok(SRC.includes('S.bookDate || null'),'and the panel is told that date');

// ---- wiring -----------------------------------------------------------------------------------
assert.ok(SRC.includes('function vsSection()'),'the scoreboard has a section');
assert.ok(SRC.includes('vsSection()+'),'and it is in the layout');
assert.ok(SRC.includes('grid-area:vs'),'and a place in the wide grid');
assert.ok(SRC.includes('S.vs=hp.vs'),'and the link feeds it');
assert.ok(!/\.z-vs\{display:none\}/.test(SRC.replace(/\s+/g,'')),
  'the scoreboard is never hidden: it is about his own money');
console.log('test_daily_vs_spy.cjs PASS');
