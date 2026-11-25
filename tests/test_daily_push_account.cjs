'use strict';
// F5: the real account size rides in the ntfy push link, never in the public market file.
// Runs the shipped pushParse from amalgam-daily.html.
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
const parse=hash=>new Function('location',extract('pushParse')+'\nreturn pushParse();')({hash:'#'+hash,search:''});

const PICKS='20261125-CARS-61-1241-1125-BRK9B-1-50000-45000';

// 1. no account tail: unchanged behaviour, picks intact, acct null
const plain=parse(PICKS);
assert.equal(plain.date,'2026-11-25');
assert.equal(plain.picks.length,2);
assert.equal(plain.picks[0].sym,'CARS');
assert.equal(plain.picks[1].sym,'BRK.B');          // 9 decodes back to a dot
assert.equal(plain.acct,null);
assert.equal(plain.focus,null);

// 2. the account tail is read and never eats a pick
const withAcct=parse(PICKS+'-a-812345-800100');
assert.deepEqual(withAcct.picks.map(p=>p.sym),['CARS','BRK.B']);
assert.deepEqual(withAcct.acct,{netLiq:8123.45,cash:8001.00});

// 3. both tails, in either order, with the focus still read
for(const h of [PICKS+'-a-812345-800100-f-CARS', PICKS+'-f-CARS-a-812345-800100']){
  const g=parse(h);
  assert.deepEqual(g.acct,{netLiq:8123.45,cash:8001.00},h);
  assert.equal(g.focus,'CARS',h);
  assert.deepEqual(g.picks.map(p=>p.sym),['CARS','BRK.B'],h);
}

// 4. cash is never allowed above net liq, and nonsense is dropped rather than shown
assert.deepEqual(parse(PICKS+'-a-100000-999999').acct,{netLiq:1000,cash:1000});
assert.equal(parse(PICKS+'-a-0-0').acct,null);
assert.equal(parse(PICKS+'-a-abc-100').acct,null);          // unreadable figures are ignored
assert.deepEqual(parse(PICKS+'-a-abc-100').picks.map(p=>p.sym),['CARS','BRK.B']);  // picks survive
assert.equal(parse(PICKS+'-a--500-100'),null);              // a malformed tail rejects the whole hash

// 5. the page applies it before sizing and persists it, so later opens without the push use it
assert.ok(/if\(hp&&hp\.acct\) await applyAcct\(hp\.acct\);/.test(SRC),'applied at the top of initExt');
assert.ok(/S\.acct=\{netLiq:a\.netLiq,cash:Math\.min\(a\.cash,a\.netLiq\),sample:false\};/.test(SRC),
  'sample flag must be cleared');
assert.ok(/async function applyAcct\(a\)\{[\s\S]*?await saveAcct\(\);/.test(SRC),'must be saved');

console.log('PASS push account: real figures ride the private link, both tails parse, 5 checks.');
