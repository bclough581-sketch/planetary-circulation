'use strict';
// Your book: five slots, colour is the R-multiple, and an alert is never a colour.
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
const CONSTS=SRC.match(/var HELD_SLOTS = \d+;/)[0]+'\n'+SRC.match(/var HELD_CAP_PCT = [\d.]+;/)[0];
const api=new Function(CONSTS+'\n'+['esc','heldR','heldColor','heldAlert','heldInline'].map(extract).join('\n')+
  '\nreturn {heldR,heldColor,heldAlert,heldInline,HELD_SLOTS,HELD_CAP_PCT};')();
const rgb=s=>s.match(/\d+/g).map(Number);
const P=(sym,qty,price,stop,cost)=>({sym,qty,price,stop,cost});

// ---- the R-multiple is the whole point: the same number on a $3 stock and a $300 one ----------
assert.equal(api.heldR(P('A',10,11,9,10)),1,'entry 10, stop 9, now 11 is +1R');
assert.equal(api.heldR(P('A',10,9,9,10)),-1,'at the stop is -1R');
assert.equal(api.heldR(P('A',10,10,9,10)),0,'at the entry is flat');
assert.equal(api.heldR(P('A',10,310,290,300)),api.heldR(P('A',10,3.1,2.9,3.0)),
  'a $300 stock and a $3 one at the same R read the same, which is why R is the scale');
assert.equal(api.heldR(P('A',10,11,null,10)),null,'no stop means no R');
assert.equal(api.heldR(P('A',10,11,12,10)),null,'a stop above the entry is not a risk measure');

// ---- colour carries R and only R, on the same red-to-blue scale as the market map -------------
{
  const stop=rgb(api.heldColor(-1)), flat=rgb(api.heldColor(0)), good=rgb(api.heldColor(2));
  assert.ok(stop[0]>stop[2],'at the stop is red');
  assert.ok(good[2]>good[0],'a winner is blue');
  assert.deepEqual(flat,[26,26,26],'flat is the neutral, not a colour');
  assert.deepEqual(rgb(api.heldColor(9)),good,'the scale saturates at +2R');
  assert.deepEqual(rgb(api.heldColor(-9)),stop,'and at -1R, which is as bad as a stopped trade gets');
  assert.deepEqual(rgb(api.heldColor(null)),[26,26,26],'no stop is not coloured, it is flagged');
  // green belongs to the market map; this one must never use it
  assert.ok(good[1]<good[2],'a winner is blue, not green');
}

// ---- an alert is a reason, not a shade --------------------------------------------------------
assert.equal(api.heldAlert(P('A',10,11,null,10),null),'NO STOP ORDER');
assert.equal(api.heldAlert(P('A',10,9.2,9,10),-0.8),'NEAR THE STOP');
assert.equal(api.heldAlert(P('A',10,11,9,10),1),null,'a winner with a stop is not an alert');
assert.equal(api.heldAlert(P('A',10,9.7,9,10),-0.3),null,'being down is not an alert');

// ---- the panel --------------------------------------------------------------------------------
const ACCT={netLiq:10000};
{
  const h=api.heldInline([],ACCT);
  assert.equal((h.match(/hd-e/g)||[]).length,api.HELD_SLOTS,'an empty book is five open slots');
  assert.match(h,/Nothing open/);
  assert.match(h,/whole risk budget is free/);
}
{
  const book=[P('AAA',100,11,9,10),P('BBB',50,10,null,11),P('CCC',20,9.1,9,10)];
  const h=api.heldInline(book,ACCT);
  assert.equal((h.match(/class="hd-t/g)||[]).length,api.HELD_SLOTS,'always five tiles');
  assert.equal((h.match(/hd-e/g)||[]).length,2,'two of them empty');
  assert.equal((h.match(/hd-al/g)||[]).length,2,'the unstopped one and the one at the stop');
  assert.match(h,/NO STOP ORDER/); assert.match(h,/NEAR THE STOP/);
  assert.match(h,/2 of 3 positions need a look/,'the header counts them');
  assert.match(h,/\+1\.0R/,'the winner reads as +1.0R');
  assert.match(h,/−0\.9R|−1\.0R/,'the one at the stop reads negative, with a true minus');
  // risk: AAA 100 x 2 = 200 stopped. BBB has no stop so its whole 500 is exposed, and must not be
  // quietly folded into the budget bar.
  assert.match(h,/\$202 of the \$500 risk budget used/,'only stopped risk counts: AAA 100x$2 plus CCC 20x$0.10, not BBB');
  assert.match(h,/1 position sits outside it entirely, with no stop order/);
  assert.match(h,/\$500[^<]*exposed/,'the unstopped tile shows the whole position, not a stop distance');
}
{
  const many=[1,2,3,4,5,6,7].map(i=>P('S'+i,10,11,9,10));
  const h=api.heldInline(many,ACCT);
  assert.equal((h.match(/class="hd-t/g)||[]).length,api.HELD_SLOTS,'never more tiles than slots');
}
{
  const h=api.heldInline([P('AAA',100,11,9,10)],null);
  assert.match(h,/No account size yet/,'without the account size it says so instead of inventing a budget');
  assert.ok(!/risk budget used/.test(h),'and draws no budget bar');
}
// the budget bar fills, and cannot overfill
{
  const over=[P('A',1000,11,9,10)];            // $2,000 of risk against a $500 budget
  const h=api.heldInline(over,ACCT);
  const w=+h.match(/hd-bar"><i style="width:([\d.]+)%/)[1];
  assert.equal(w,100,'an over-budget book fills the bar, it does not run past it');
}
assert.equal(api.HELD_CAP_PCT,5.0,'the cap matches sizing.MAX_OPEN_RISK_PCT on Petunia');

// ---- wiring ------------------------------------------------------------------------------------
assert.ok(SRC.includes('function heldSection()'),'the book has a section');
assert.ok(SRC.includes('heldSection()+'),'and it is in the layout');
assert.ok(SRC.includes('grid-area:book'),'and has a place in the wide grid');
assert.ok(!/\.z-book\{display:none\}/.test(SRC.replace(/\s+/g,'')),
  'the book is never hidden: it is the only panel about his own money');
assert.ok(SRC.includes("S.acct && !S.acct.sample"),'the sample account never draws a risk budget');
console.log('test_daily_book.cjs PASS');
