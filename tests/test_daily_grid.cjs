'use strict';
// The Grid. The hue follows the state. It never touches a data encoding.
// Brent's rule, 2026-11-26: pretty never replaces function.
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
const CONSTS=['HELD_SLOTS','HELD_CAP_PCT','VS_CAP']
  .map(n=>{const m=SRC.match(new RegExp('var '+n+' = [^;]+;'));assert.ok(m,n);return m[0];}).join('\n');
const build=S=>new Function('S',CONSTS+'\n'+
  ['heldR','heldAlert','gridState','heldColor','heatColor','vsColor'].map(extract).join('\n')+
  '\nreturn {gridState,heldColor,heatColor,vsColor,heldAlert,heldR};')(S);
const P=(sym,qty,price,stop,cost)=>({sym,qty,price,stop,cost});
const rgb=s=>s.match(/\d+/g).map(Number);

// ---- the hue is state, and the state is the same thing the book already flags ----------------
assert.equal(build({held:[],acct:null}).gridState(),'clear','nothing open is clear');
assert.equal(build({held:[P('A',10,11,9,10)],acct:null}).gridState(),'clear',
  'a healthy position is clear');
assert.equal(build({held:[P('A',10,11,null,10)],acct:null}).gridState(),'attention',
  'a position with no stop turns the screen, which is the one he breaks most');
assert.equal(build({held:[P('A',10,9.1,9,10)],acct:null}).gridState(),'attention',
  'price sitting on the stop turns the screen');
// open risk past the budget, with no per-tile alert to carry it
{
  const held=[P('A',100,10,9,10)];                 // $100 of risk
  assert.equal(build({held,acct:{netLiq:10000,sample:false}}).gridState(),'clear',
    '$100 against a $500 budget is clear');
  assert.equal(build({held,acct:{netLiq:1000,sample:false}}).gridState(),'attention',
    '$100 against a $50 budget turns the screen even with no tile flagged');
  assert.equal(build({held,acct:{netLiq:1000,sample:true}}).gridState(),'clear',
    'the sample account never turns the screen, the same rule the book uses');
}

// ---- pretty never replaces function: no data encoding may follow the hue ----------------------
{
  const a=build({held:[],acct:null});
  // the market map means down and up, and stays red and green
  assert.ok(rgb(a.heatColor(-0.05, 0.12))[0]>rgb(a.heatColor(-0.05, 0.12))[1],'a falling stock is red');
  assert.ok(rgb(a.heatColor(0.05, 0.12))[1]>rgb(a.heatColor(0.05, 0.12))[0],'a rising stock is green');
  // the book means R, and stays red to tron blue
  assert.ok(rgb(a.heldColor(-1))[0]>rgb(a.heldColor(-1))[2],'at the stop is red');
  assert.ok(rgb(a.heldColor(2))[2]>rgb(a.heldColor(2))[0],'a winner is blue');
  // the scoreboard means ahead or behind
  assert.ok(rgb(a.vsColor(-5))[0]>rgb(a.vsColor(-5))[2],'behind SPY is red');
  assert.ok(rgb(a.vsColor(5))[2]>rgb(a.vsColor(5))[0],'ahead of SPY is blue');
  for(const fn of ['heatColor','heldColor','vsColor'])
    assert.ok(!extract(fn).includes('--'),fn+' must not read a CSS variable, or the screen hue could move it');
}
// an alert keeps its own channel and is never carried by colour alone
assert.ok(SRC.includes('hd-al'),'the alert border class survives');
assert.ok(/NO STOP ORDER/.test(SRC),'the alert still says why in words');

// ---- wiring ------------------------------------------------------------------------------------
assert.ok(SRC.includes('html.tron[data-state="attention"]'),'the attention hue exists');
assert.ok(/setAttribute\('data-state', gridState\(\)\)/.test(SRC),'render sets it every paint');
assert.ok(/--h:203/.test(SRC)&&/--h:356/.test(SRC),'two hues, one per state');
assert.ok(/prefers-reduced-motion/.test(SRC),'the transition respects reduced motion');
// the glow must not eat the contrast fix from earlier today
assert.ok(SRC.includes('--dim:#9eacbe'),'the readable grey survives the restyle');
console.log('test_daily_grid.cjs PASS');
