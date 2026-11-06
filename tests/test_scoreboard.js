const fs=require('fs');let bad=0;
function ok(c,m){if(!c){console.log('FAIL',m);bad++}else console.log('ok  ',m)}
const d=JSON.parse(fs.readFileSync(__dirname+'/../scoreboard.json','utf8'));
ok(/^\d{4}-\d{2}-\d{2}$/.test(d.asof),'asof is a date');
ok(d.counters.every(c=>c.length===2&&c[0]&&c[1]),'counters are label/value pairs');
ok(d.tracks.length>=2&&d.tracks.every(t=>t.rows.every(r=>r.length===t.cols.length)),'every track row matches its columns');
ok(d.tracks.every(t=>t.verdictDate&&t.verdictRule&&t.disclosure),'every track states verdict date, rule and disclosure');
const V=['FAIL','DEAD','CLOSED','NOT AN EDGE'];
ok(d.graveyard.every(g=>V.includes(g.verdict)&&g.name&&g.numbers&&g.read&&g.kind),'every graveyard row complete, verdict in allowed set');
const all=JSON.stringify(d).toLowerCase();
['buy now','guaranteed','sure thing','recommend you','you should buy','pick '].forEach(w=>ok(all.indexOf(w)<0,'no promotional/advice phrase: '+w.trim()));
ok(all.indexOf('no edge')>=0,'page says no edge was found');
console.log(bad?'FAILED':'ALL PASS');process.exit(bad?1:0)
