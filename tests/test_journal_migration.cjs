'use strict';
const assert=require('node:assert/strict');
const legacy=require('../journal-legacy.js'),core=require('../journal-core.js');
function entry(extra={}){return {id:'old_1',created:'2026-11-06T12:00:00.000Z',updated:'2026-11-07T13:00:00.000Z',ticker:'TEST',type:'plan',status:'closed',reason:'Original reason',evidence:'Original evidence',entryRule:'Limit only',size:'Unknown',exitRule:'Original exit',gates:{g1:'met',g2:'notmet',g3:'unchecked',g4:'met',g5:'unchecked'},entryPrice:10,exitPrice:9.2,whyExited:'Exit reason',followed:'unknown',lesson:'Original lesson',...extra};}
if(require.main===module)(async()=>{
 const raw=JSON.stringify([entry()]);const cards=await legacy.convert(raw),c=cards[0];
 assert.equal(c.recordType,'Retrospective');assert.equal(c.savedAt,entry().created);
 for(const [from,to] of [['reason','reason'],['entryRule','entryRule'],['size','size'],['exitRule','exitRule'],['whyExited','exitReason'],['lesson','lesson']])assert.equal(c[to],entry()[from]);
 assert.ok(c.evidence.includes(entry().evidence)&&c.evidence.includes(entry().updated)&&c.evidence.includes('Original type: plan'));
 assert.match(c.execution,/entry price: 10\nOlder self-reported exit price: 9.2/);
 assert.equal(c.adherence,'Unresolved');assert.match(c.checklist,/G2: notmet/);
 assert.equal(core.mergeCards(cards,await legacy.convert(raw)).added,0,'repeat copy is idempotent');
 const amended=structuredClone(cards);amended[0].amendments.push({savedAt:'2026-11-08T12:00:00.000Z',change:'Later review',reason:'My records',planned:'Unknown',adherence:'Unresolved'});
 assert.deepEqual(legacy.mergeCopies(amended,cards).cards,amended,'copy again never discards later amendments');
 assert.throws(()=>legacy.mergeCopies([{...cards[0],reason:'Changed original'}],cards),/conflicts/);
 const reordered=JSON.stringify([Object.fromEntries(Object.entries(entry()).reverse())]);
 assert.deepEqual(await legacy.convert(reordered),cards,'object key order does not create another card');
 const duplicate=await legacy.convert(JSON.stringify([entry(),entry(),entry({reason:'Changed'})]));
 assert.equal(new Set(duplicate.map(c=>c.id)).size,3,'duplicate legacy IDs never collapse cards');
 assert.equal(core.mergeCards(cards,await legacy.convert(JSON.stringify([entry({reason:'Later edit'})]))).cards.length,2,'later legacy edits are distinct retrospective copies');
 for(const data of [{app:'amalgam-journal',version:1,exported:'2026-11-08',entries:[entry()]},{app:'amalgam-journal',version:2,journalId:'local',revision:1,entries:[entry()]}])assert.deepEqual(await legacy.convert(JSON.stringify(data)),cards);
 const long=entry({reason:'r'.repeat(600),evidence:'e'.repeat(600),lesson:'l'.repeat(600)});
 assert.equal((await legacy.convert(JSON.stringify([long])))[0].reason.length,600);
 assert.equal((await legacy.convert(JSON.stringify([entry({reason:''})])))[0].reason,'No reason was recorded in the older journal.');
 for(const data of ['broken','{}','[null]',JSON.stringify([entry({mystery:'preserve me'})]),JSON.stringify([entry({entryPrice:'1,000'})]),JSON.stringify([entry({reason:'x'.repeat(601)})]),JSON.stringify([entry({created:'bad date'})]),JSON.stringify({app:'amalgam-journal',version:999,entries:[]}),JSON.stringify(Array.from({length:501},()=>entry()))])await assert.rejects(()=>legacy.convert(data));
 assert.equal(raw,JSON.stringify([entry()]),'input never mutated');
 console.log('PASS journal migration: explicit format mapping, deterministic copies, duplicate IDs preserved, limits fail closed, no clipping, no source mutation.');
})().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={entry};
