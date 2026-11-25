'use strict';
// F3: amalgam-daily.html takes tonight's pick symbols from the published market file, so the app
// shows them without the push link being tapped. The file is public, so it carries symbols only
// and the page does its own sizing. Runs the shipped source, no browser needed.
const fs=require('fs');const path=require('path');const assert=require('node:assert/strict');

const SRC=fs.readFileSync(path.join(__dirname,'..','amalgam-daily.html'),'utf8');

function extract(name){                       // the function's own text, by brace count
  const start=SRC.indexOf('function '+name+'(');
  assert.ok(start>=0,name+' is missing from amalgam-daily.html');
  let depth=0;
  for(let j=SRC.indexOf('{',start);j<SRC.length;j++){
    if(SRC[j]==='{')depth++;
    else if(SRC[j]==='}'){depth--;if(!depth)return SRC.slice(start,j+1);}
  }
  throw new Error('unbalanced braces in '+name);
}
const BODY=extract('parseSyms')+'\n'+extract('publishedSyms');
const run=(MARKET,S)=>new Function('MARKET','S',BODY+'\nreturn publishedSyms();')(MARKET,S);

const MKT=p=>({asof:'2026-11-24',picks:p});
const PICKS={date:'2026-11-24',status:'OK',syms:['CARS','CR','MAGN']};
const ST={mdate:'2026-11-24'};

// 1. the happy path hands the symbols to the page's own sizing path
assert.deepEqual(run(MKT(PICKS),ST),['CARS','CR','MAGN']);

// 2. symbols from another session are never shown beside today's prices
assert.deepEqual(run(MKT({...PICKS,date:'2026-11-23'}),ST),[]);
assert.deepEqual(run(MKT(PICKS),{mdate:'2026-11-25'}),[]);

// 3. with no page date yet, the market file's own asof is the authority
assert.deepEqual(run(MKT(PICKS),{}),['CARS','CR','MAGN']);
assert.deepEqual(run({asof:'2026-11-23',picks:PICKS},{}),[]);

// 4. nothing to show is an empty list, never a half-built card
assert.deepEqual(run({asof:'2026-11-24'},ST),[]);
assert.deepEqual(run(MKT({date:'2026-11-24',syms:[]}),ST),[]);
assert.deepEqual(run(null,ST),[]);

// 5. junk is filtered and never more than three come back
assert.deepEqual(run(MKT({date:'2026-11-24',syms:['GOOD','toolongsymbol','','GOOD']}),ST),['GOOD']);
assert.equal(run(MKT({date:'2026-11-24',syms:['AAA','BBB','CCC','DDD','EEE']}),ST).length,3);

// 6. the account never rides in the published file; the page sizes the picks itself
assert.doesNotMatch(extract('publishedSyms'),/shares|risk|cash|netLiq/,'published picks carry symbols only');
assert.ok(/if\(!syms\.length\) syms=publishedSyms\(\);/.test(SRC),'initExt must fall back to the file');
assert.ok(/if\(syms\.length\) await loadExt\(syms\);/.test(SRC),'the page must size them through loadExt');

// 7. a tapped link still wins, and a saved push from another session is dropped
assert.ok(/var hp=pushParse\(\);/.test(SRC),'the link is tried first');
assert.ok(/hp=await savedPush\(\); if\(hp&&hp\.date!==\(S\.mdate\|\|MARKET\.asof\)\) hp=null;/.test(SRC),
  'a saved push from another session must not be applied');

console.log('PASS published picks: symbols only, session-matched, sized by the page, 7 checks.');
