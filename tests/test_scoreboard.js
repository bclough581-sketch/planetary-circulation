const fs=require('fs');let bad=0;
function ok(c,m){if(!c){console.log('FAIL',m);bad++}else console.log('ok  ',m)}
const d=JSON.parse(fs.readFileSync(__dirname+'/../scoreboard.json','utf8'));
ok(/^\d{4}-\d{2}-\d{2}$/.test(d.asof),'asof is a date');
ok(d.counters.every(c=>c.length===2&&c[0]&&c[1]),'counters are label/value pairs');
ok(d.tracks.length>=2&&d.tracks.every(t=>t.rows.every(r=>r.length===t.cols.length)),'every track row matches its columns');
ok(d.tracks.every(t=>t.verdictDate&&t.verdictRule&&t.disclosure),'every track states verdict date, rule and disclosure');
const V=['FAIL','DEAD','CLOSED','ESTIMATE'];
ok(d.graveyard.every(g=>V.includes(g.verdict)&&g.id&&g.name&&g.numbers&&g.read&&g.kind&&g.source&&g.check),'every graveyard row has id, numbers, source and check status, verdict in allowed set');
ok(['BTC1','BTC2','ROTCHESS1','ODDLOT1'].every(id=>{const g=d.graveyard.find(x=>x.id===id);return g&&g.gap&&g.extract&&require('fs').existsSync(require('path').join(__dirname,'..',g.extract));}),'BTC1, BTC2, ROTCHESS1, ODDLOT1 carry a visible evidence gap and a linked source extract that exists');
ok(/Binance/.test(d.graveyard.find(x=>x.id==='BTC1').gap)&&/Twelve Data/.test(d.graveyard.find(x=>x.id==='BTC1').gap),'BTC1 discloses the unresolved Binance versus Twelve Data source description');
ok(new Set(d.graveyard.map(g=>g.id)).size===d.graveyard.length,'premise ids are unique');
ok(d.tracks.every(t=>t.source),'every track cites its lock');
ok(JSON.stringify(d).toLowerCase().indexOf('every idea')<0&&JSON.stringify(d).indexOf('No edge found')<0,'no overclaiming headline ("every idea", "No edge found")');
const all=JSON.stringify(d).toLowerCase();
['buy now','guaranteed','sure thing','recommend you','you should buy','pick '].forEach(w=>ok(all.indexOf(w)<0,'no promotional/advice phrase: '+w.trim()));
ok(all.indexOf('no edge validated')>=0,'page says no edge validated under our rules');
ok(d.graveyard.every(g=>!/NOT AN EDGE/.test(JSON.stringify(g))),'no row labels an untested estimate NOT AN EDGE');ok(d.graveyard.filter(g=>/range/.test(g.numbers)).every(g=>/\d\d% range/.test(g.numbers)),'every row that shows a range states its level');
console.log(bad?'FAILED':'ALL PASS');process.exit(bad?1:0)
