const C=require('../confluence.js');const fs=require('fs');
let bad=0;const ok=(c,m)=>{if(!c){bad++;console.log('FAIL',m);}else console.log('ok  ',m);};
const d=JSON.parse(fs.readFileSync(__dirname+'/../conflicts.json','utf8'));
const ev=id=>d.events.find(e=>e.id===id), cf=id=>d.conflicts.find(c=>c.id===id);
ok(C.classify(ev('hurricane-gulf'),cf('iran-hormuz')).type==='shared-node','Gulf hurricane x Hormuz = shared-node');
ok(C.classify(ev('hurricane-gulf'),cf('iran-hormuz')).via.includes('oil'),'shared via oil');
ok(C.classify(ev('hurricane-atlantic'),cf('russia-ukraine')).type==='degraded','Atlantic hurricane x Ukraine = degraded (relief drained)');
ok(C.classify(ev('hurricane-atlantic'),cf('china-taiwan')).type==='coincidence','Atlantic hurricane x Taiwan = coincidence');
ok(C.classify(ev('cargo-plane-down'),cf('iran-hormuz')).type==='coincidence','cargo plane x Hormuz = coincidence');
const quiet=[{id:'q',level:0,nodes:['oil'],drains:[]}];
ok(C.overlaps(ev('oil-find'),quiet).length===0,'level-0 conflict ignored');
const o=C.overlaps(ev('hurricane-gulf'),d.conflicts);
ok(o[0].type==='shared-node'&&o.length===3,'strongest link sorts first, all active conflicts shown');
ok(!C.almanac([],'a','b').ok&&/No history claim/.test(C.almanac([],'a','b').line),'empty history = no claim');
const h=n=>Array.from({length:n},(_,i)=>({event:'a',conflict:'b',outcome:i%2===0}));
ok(!C.almanac(h(7),'a','b').ok,'n=7 below min = no claim');
ok(C.almanac(h(8),'a','b').ok&&C.almanac(h(8),'a','b').k===4,'n=8 shows 4 of 8');
ok(C.almanac(h(20),'a','x').n===0,'other pairs not counted');
console.log(bad?'FAILED':'ALL PASS');process.exit(bad?1:0)
