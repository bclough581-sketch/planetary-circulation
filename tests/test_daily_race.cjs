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
const CONSTS=SRC.match(/var LANE_NAME = \{[\s\S]*?\};/)[0]+'\n'+SRC.match(/var LANE_WHY = \{[\s\S]*?\};/)[0]
  +'\n'+SRC.match(/var RACE_LANES = \{[\s\S]*?\n\};/)[0]+'\n'+SRC.match(/var RACE_HZ = \[[^\]]*\];/)[0];
// raceHtml now delegates to the one shared renderer, so the harness has to pull it in too.
const BODY=CONSTS+'\n'+extract('esc')+'\n'+extract('noEdgeNote')+'\n'+extract('raceNum')+'\n'
  +extract('raceInline')+'\n'+extract('raceForToday')+'\n'+extract('raceHtml');
const run=(MARKET,S)=>new Function('MARKET','S',BODY+'\nreturn raceHtml();')(MARKET,S);

const LANES=['gates','mom12_1','pct52w','random'];
const sum=(n,a,b,c)=>({n:n,picks:n,x5:a,n5:n,x10:b,n10:n,x20:c,n20:n});
const RACE={asof:'2026-11-24',lanes:LANES,sessions:1,closed_sessions:0,target_sessions:91,basket_n:20,
  cards:{gates:['MNKD','SEZL','SI'],mom12_1:['NLST','IOVA','OPTX'],pct52w:['PLX','TASK','CBLL'],random:['BCAX','EGO','SD']},
  summary:{gates:sum(0,null,null,null),mom12_1:sum(0,null,null,null),pct52w:sum(0,null,null,null),random:sum(0,null,null,null)}};
const MKT=r=>({asof:'2026-11-24',race:r});
const ST={mdate:'2026-11-24'};

// 1. every lane and every card is shown
const h=run(MKT(RACE),ST);
for(const l of LANES) assert.ok(h.includes({gates:'YOUR GATES',mom12_1:'12-MONTH MOMENTUM',pct52w:'NEAR 52-WEEK HIGH',random:'RANDOM'}[l]),l);
for(const s of ['MNKD','SEZL','SI','NLST','IOVA','OPTX','PLX','TASK','CBLL','BCAX','EGO','SD']) assert.ok(h.includes(s),s);

// 2. the random lane is named as the benchmark, not buried as a curiosity
const flat=h.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ');
assert.match(flat,/The lane to watch is RANDOM/);
assert.match(flat,/Anything that cannot beat a coin flip from the same pool is not picking/);

// 3. the measured basket is 20 and the page says the symbols are only the head of it
assert.match(flat,/Each lane is scored on 20 names/);
assert.match(flat,/the symbols listed are just the top three/);

// 4. progress is counted in SESSIONS, not picks. one session closes 20 picks at once and they
//    are not 20 independent facts, so counting picks would flatter the evidence.
assert.match(flat,/0 of about 91 scored sessions/);
assert.match(flat,/Sessions are the unit here, not picks/);
assert.match(flat,/Not enough yet to mean anything/);

// 5. missing numbers render as a dash, never as zero
assert.ok(!/[+\u2212]\d+\.\d\d/.test(h),'an unscored lane must not print any number at all');
assert.ok(h.includes('>START<')&&h.includes('>FINISH<'),'an unscored race shows the starting grid, gate to finish');

// 6. once the sessions are in, the guidance changes to the comparison that matters
const closed={...RACE,closed_sessions:95,summary:{gates:sum(1900,1.2,2.0,3.0),mom12_1:sum(1900,0.5,0.6,0.7),
  pct52w:sum(1900,0.1,0.2,0.3),random:sum(1900,0.4,0.5,0.6)}};
const h2=run(MKT(closed),ST).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ');
assert.match(h2,/Enough sessions to look/);
assert.match(h2,/Compare every lane with RANDOM, not with each other/);
assert.ok(h2.includes('+1.20')&&h2.includes('+3.00'),'scores render signed to two places');

// 7. a race from another session is never shown beside this session's prices
assert.match(run(MKT({...RACE,asof:'2026-11-23'}),ST),/No race recorded for this session yet/);
assert.match(run({asof:'2026-11-24'},ST),/No race recorded for this session yet/);

// 8. the honest limit rides along, and the panel is reachable and closable
assert.match(flat,/NO EDGE PROVEN/);
assert.ok(/data-act="race"/.test(SRC),'a RACE button exists');
assert.ok(/if\(S\.panel==='race'\)\{ h\+=raceHtml\(\); \}/.test(SRC),'the panel renders');
assert.ok(h.includes('data-act="pclose"'),'the panel can be closed');

console.log('PASS race panel: four lanes, random called out as the benchmark, sample size honest, 8 checks, basket of 20.');
