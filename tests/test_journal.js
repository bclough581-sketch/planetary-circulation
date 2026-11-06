const J=require('../journal.js');let bad=0;
function ok(c,m){if(!c){console.log('FAIL',m);bad++}else console.log('ok  ',m)}
function e(o){return J.normalize(Object.assign({ticker:'abc',status:'open'},o||{}))}

// normalize: sanitizes and defaults
const n=J.normalize({ticker:' <b>tls</b> ',type:'bogus',status:'weird',gates:{g1:'met',g2:'hack'},entryPrice:'-3',exitPrice:'5',followed:'yes',lesson:'x'});
ok(n.ticker==='BTLSB','ticker stripped of markup characters ('+n.ticker+')');
ok(n.type==='plan'&&n.status==='open','bad type/status fall back to plan/open');
ok(n.gates.g1==='met'&&n.gates.g2==='unchecked'&&n.gates.g5==='unchecked','gate answers validated, missing = unchecked');
ok(n.entryPrice===null,'negative price rejected');
ok(n.exitPrice===null&&n.followed===''&&n.lesson==='','closed-only fields dropped on open cards');
ok(J.normalize({ticker:'x'.repeat(50)}).ticker.length===10,'ticker capped at 10');
ok(J.normalize({reason:'a'.repeat(5000)}).reason.length===600,'long text capped');

// result %
const c=e({status:'closed',entryPrice:'10',exitPrice:'9.2',followed:'no'});
ok(Math.abs(J.resultPct(c)-(-8))<1e-9,'result % = -8.0');
ok(J.resultPct(e({status:'closed',entryPrice:'10'}))===null,'no exit price = no result');
ok(J.resultPct(e({entryPrice:'10',exitPrice:'12'}))===null,'open card has no result');

// gaps are advisory
ok(J.gaps(e()).join()==='why you entered,exit rule','open card gaps listed');
ok(J.gaps(e({status:'closed',reason:'r',exitRule:'x'})).join()==='whether you followed your rule,why you actually exited','closed card gaps listed');

// stats
const list=[
 e({status:'closed',entryPrice:'10',exitPrice:'11',followed:'yes',lesson:'one',gates:{g1:'met',g2:'met',g3:'met'},updated:'2026-01-02'}),
 e({status:'closed',entryPrice:'10',exitPrice:'9',followed:'no',lesson:'two',gates:{g1:'met',g2:'notmet',g3:'met'},updated:'2026-01-03'}),
 e({status:'closed',followed:'unknown'}),
 e({status:'open',gates:{g1:'met'}})
];
const s=J.stats(list);
ok(s.total===4&&s.open===1&&s.closed===3,'counts');
ok(Math.abs(s.followRate-0.5)<1e-9&&s.unknown===1,'follow rate ignores unknown (1 yes, 1 no = 50%)');
ok(s.g123Answered===2,'G1-G3 answered counts only fully answered cards');
ok(s.pricedN===2&&Math.abs(s.meanPricedPct-0)<1e-9,'priced mean over priced cards only');
ok(Math.abs(s.meanFollowedPct-10)<1e-9&&Math.abs(s.meanBrokePct+10)<1e-9,'followed / broke means');
ok(s.lessons[0].s==='two','lessons newest first');
ok(!s.goalMet&&s.goal===20,'goal not met with 4 cards');
ok(J.stats([]).followRate===null&&J.stats([]).meanPricedPct===null,'empty list is safe');

// csv: injection defused, quotes escaped
const evil=e({ticker:'EVIL',reason:'=HYPERLINK("http://x","y")',evidence:'a "quote", comma',size:'+1',entryRule:'-2+3',exitRule:'@SUM(A1)'});
const csv=J.toCsv([evil]);
ok(csv.indexOf("\"'=HYPERLINK")>=0,'leading = defused');
ok(csv.indexOf("\"'+1\"")>=0&&csv.indexOf("\"'-2+3\"")>=0&&csv.indexOf("\"'@SUM")>=0,'leading + - @ defused');
ok(csv.indexOf('"a ""quote"", comma"')>=0,'quotes doubled');
ok(csv.split('\r\n')[0].startsWith('"id","created"'),'header row');

// backup round trip + rejection of junk
const bk=J.toBackup(list),r=J.parseBackup(bk);
ok(r.ok&&r.entries.length===4,'backup round trip');
ok(!J.parseBackup('not json').ok&&!J.parseBackup('{"a":1}').ok&&!J.parseBackup('{"app":"amalgam-journal","entries":"x"}').ok,'junk backups rejected');
const evilBk=JSON.stringify({app:'amalgam-journal',version:1,entries:[{ticker:'<img src=x onerror=alert(1)>',reason:'<script>x</script>',type:'x',gates:{g1:'<b>'}}]});
const rr=J.parseBackup(evilBk);
ok(rr.ok&&/^[A-Z0-9.\-]{1,10}$/.test(rr.entries[0].ticker),'restored ticker has no markup characters and is capped ('+rr.entries[0].ticker+')');
ok(rr.entries[0].gates.g1==='unchecked','restored gate value validated');

// merge: newer wins, nothing lost
const a=[e({id:'1',updated:'2026-01-01',reason:'old'}),e({id:'2',updated:'2026-01-01'})];
const b=[e({id:'1',updated:'2026-02-01',reason:'new'}),e({id:'3',updated:'2026-01-01'})];
const m=J.merge(a,b);
ok(m.length===3,'merge keeps union');
ok(m.filter(x=>x.id==='1')[0].reason==='new','newer copy wins');
const m2=J.merge(b,a);ok(m2.filter(x=>x.id==='1')[0].reason==='new','older never overwrites newer');


// --- red-team fixes (ChatGPT review, Nov 6) ---
// CSV: leading whitespace / BOM before a formula marker is defused
const csv2=J.toCsv([e({ticker:'WS',reason:'  =1+1',evidence:'\uFEFF=2+2',size:'\t=3'})]);
ok(csv2.indexOf('"\'  =1+1"')>=0,'leading spaces before = defused');
ok(csv2.indexOf('"\'\uFEFF=2+2"')>=0,'BOM before = defused');
ok(csv2.indexOf('"\'\t=3"')>=0,'leading tab defused');
// ids: unsafe ids replaced, __proto__ entry survives a merge
const pe=J.normalize({id:'__proto__',ticker:'PROTO'});
ok(pe.id!=='__proto__'&&/^[A-Za-z0-9_\-]{1,40}$/.test(pe.id),'__proto__ id replaced with a safe id');
const mm=J.merge([],J.parseBackup(JSON.stringify({app:'amalgam-journal',version:1,entries:[{id:'__proto__',ticker:'PROTO'}]})).entries);
ok(mm.length===1&&mm[0].ticker==='PROTO','entry with __proto__ id is kept, not silently lost');
// backup version
ok(!J.parseBackup(JSON.stringify({app:'amalgam-journal',version:999,entries:[]})).ok,'unknown backup version rejected');
ok(!J.parseBackup(JSON.stringify({app:'amalgam-journal',entries:[]})).ok,'missing backup version rejected');
// lossy restore is disclosed
const lossy=J.parseBackup(JSON.stringify({app:'amalgam-journal',version:1,entries:[{id:'a1',ticker:'L',reason:'x'.repeat(700)},{ticker:'N'}]}));
ok(lossy.ok&&lossy.clipped===1&&lossy.renamed===1,'clipped and renamed counts reported ('+lossy.clipped+','+lossy.renamed+')');
// read failure never becomes an empty journal
ok(J.readStore(null).state==='empty'&&J.readStore('').state==='empty','nothing stored = empty');
const bad1=J.readStore('{not json');ok(bad1.state==='failed'&&bad1.raw==='{not json'&&bad1.list.length===0,'invalid JSON = failed, raw kept');
ok(J.readStore('{"a":1}').state==='failed','non-array JSON = failed');
ok(J.readStore('[]').state==='ok','empty array = ok');
// merge never loses either side's distinct cards
const ma=[e({id:'x1',updated:'2026-01-01'})],mb=[e({id:'x2',updated:'2026-01-01'})];
ok(J.merge(ma,mb).length===2,'merge of distinct ids keeps both');

console.log(bad?'FAILED':'ALL PASS');process.exit(bad?1:0)
