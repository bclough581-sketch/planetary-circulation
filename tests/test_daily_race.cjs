'use strict';
// The shadow race panel: four lanes, the random lane called out, and an honest sample-size line.
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
const CONSTS=SRC.match(/var LANE_NAME = \{[\s\S]*?\};/)[0]+'\n'+SRC.match(/var LANE_WHY = \{[\s\S]*?\};/)[0];
const BODY=CONSTS+'\n'+extract('esc')+'\n'+extract('noEdgeNote')+'\n'+extract('raceHtml');
const run=(MARKET,S)=>new Function('MARKET','S',BODY+'\nreturn raceHtml();')(MARKET,S);

const LANES=['gates','mom12_1','pct52w','random'];
const sum=(n,a,b,c)=>({n:n,picks:3,x5:a,n5:n,x10:b,n10:n,x20:c,n20:n});
const RACE={asof:'2026-11-24',lanes:LANES,sessions:1,
  slate:{gates:['MNKD','SEZL','SI'],mom12_1:['NLST','IOVA','OPTX'],pct52w:['PLX','TASK','CBLL'],random:['BCAX','EGO','SD']},
  summary:{gates:sum(0,null,null,null),mom12_1:sum(0,null,null,null),pct52w:sum(0,null,null,null),random:sum(0,null,null,null)}};
const MKT=r=>({asof:'2026-11-24',race:r});
const ST={mdate:'2026-11-24'};

// 1. every lane and every pick is shown
const h=run(MKT(RACE),ST);
for(const l of LANES) assert.ok(h.includes({gates:'YOUR GATES',mom12_1:'12-MONTH MOMENTUM',pct52w:'NEAR 52-WEEK HIGH',random:'RANDOM'}[l]),l);
for(const s of ['MNKD','SEZL','SI','NLST','IOVA','OPTX','PLX','TASK','CBLL','BCAX','EGO','SD']) assert.ok(h.includes(s),s);

// 2. the random lane is named as the benchmark, not buried as a curiosity
assert.match(h.replace(/<[^>]*>/g,' '),/The one to watch is RANDOM/);
assert.match(h.replace(/<[^>]*>/g,' '),/Anything that cannot beat it is not picking, it is guessing/);

// 3. with nothing closed, it says so plainly and gives the count
const text=h.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ');
assert.match(text,/Far too early\. 0 picks have finished 20 days/);
assert.match(text,/1 session recorded/);
assert.match(text,/Any lead you see now is noise/);

// 4. missing numbers render as a dash, never as zero
assert.ok(h.includes('&ndash;'),'unscored horizons must not show as 0.00');

// 5. once enough is closed the guidance changes to the comparison that matters
const closed={...RACE,sessions:90,summary:{gates:sum(60,1.2,2.0,3.0),mom12_1:sum(60,0.5,0.6,0.7),
  pct52w:sum(60,0.1,0.2,0.3),random:sum(60,0.4,0.5,0.6)}};
const h2=run(MKT(closed),ST).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ');
assert.match(h2,/Compare every lane with RANDOM, not with each other/);
assert.ok(h2.includes('+1.20')&&h2.includes('+3.00'),'scores render signed to two places');

// 6. a race from another session is never shown beside this session's prices
assert.match(run(MKT({...RACE,asof:'2026-11-23'}),ST),/No race recorded for this session yet/);
assert.match(run({asof:'2026-11-24'},ST),/No race recorded for this session yet/);

// 7. the honest limit rides along
assert.match(h.replace(/<[^>]*>/g,' '),/NO EDGE PROVEN/);

// 8. the panel is reachable and closable
assert.ok(/data-act="race"/.test(SRC),'a RACE button exists');
assert.ok(/if\(S\.panel==='race'\)\{ h\+=raceHtml\(\); \}/.test(SRC),'the panel renders');
assert.ok(h.includes('data-act="pclose"'),'the panel can be closed');

console.log('PASS race panel: four lanes, random called out as the benchmark, sample size honest, 8 checks.');
