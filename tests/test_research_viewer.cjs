const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('convergence-research.html','utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script, 'viewer script missing');
class Element {
  constructor(){this.textContent='';this.children=[];this.className='';this.handlers={};}
  addEventListener(type,fn){this.handlers[type]=fn;}
  replaceChildren(...children){this.children=children;this.textContent='';}
  append(...children){this.children.push(...children);}
  prepend(child){this.children.unshift(child);}
}
const elements = new Map();
const fixedNow=Date.parse('2026-11-04T20:00:00Z');
class FixedDate extends Date { static now(){return fixedNow;} }
const document = {
  getElementById(id){if(!elements.has(id))elements.set(id,new Element());return elements.get(id);},
  createElement(){return new Element();}
};
vm.runInNewContext(script,{document,Map,Set,Object,Error,Array,String,Date:FixedDate,Number,Math});
const load=async data=>{
  await document.getElementById('file').handlers.change({target:{files:[{text:async()=>JSON.stringify(data)}]}});
};
const names=['weather','geopolitics','maritime','aviation','energy','commodities','economics','markets','corporate'];
const empty=()=>Object.fromEntries(names.map(x=>[x,0]));
const event={id:'one',domain:'weather',title:'Test',observed_at:'2026-11-04T12:00:00Z',source:{name:'NOAA National Weather Service',url:'https://www.weather.gov/documentation/services-web-api'}};
const good={schema:'amalgam.research.v1',observations:[event],excluded:[],relationships:[],domains:{...empty(),weather:1},predictive_advantage:'not_established',generated_utc:'2026-11-04T19:00:00Z',licensing:{portwatch_commercial_reuse:'permission_not_verified'},feed_health:[{feed:'eia',condition:'eligible_source'}],relationship_readiness:{status:'not_ready',historical_relationships_validated:0,predictive_advantage:'not_established',distinct_observation_dates:{weather:1},blocking_reasons:['No historical panel']}};
const loadAudit=async data=>{
 await document.getElementById('audit-file').handlers.change({target:{files:[{text:async()=>JSON.stringify(data)}]}});
};
(async()=>{
 const audit={status:'blocked',decision_utc:'2026-11-04T00:00:00Z',usable_count:0,blocked_count:2,
   blocked:[{date:'2025-01-02',reason:'missing_independent_availability_evidence'},
            {date:'2025-01-03',reason:'missing_independent_availability_evidence'}],
   predictive_advantage:'not_established'};
 await loadAudit(audit);
 assert.match(document.getElementById('audit-status').textContent,/2 excluded/);
 assert.match(document.getElementById('audit-reasons').children[0].textContent,/2 blocked/);
 await loadAudit({...audit,usable_count:1,status:'eligible_for_asof_analysis'});
 assert.match(document.getElementById('audit-status').textContent,/Audit rejected/);
 await loadAudit({...audit,blocked_count:3});
 assert.match(document.getElementById('audit-status').textContent,/Audit rejected/);

 await load(good);
 assert.equal(document.getElementById('count').textContent,1);
 assert.equal(document.getElementById('link-count').textContent,'0 validated links');
 assert.match(document.getElementById('readiness').children[0].textContent,/NOT READY/);
 for(const [name,change] of [
  ['inflated count',x=>x.domains.weather=20],
  ['duplicate',x=>{x.observations.push({...event});x.domains.weather=2;}],
  ['unsupported claim',x=>x.predictive_advantage='established'],
  ['missing source',x=>x.observations[0].source.url=''],
  ['forged source URL',x=>x.observations[0].source.url='https://example.com/forged'],
  ['wrong source domain',x=>{x.observations[0].domain='markets';x.domains.weather=0;x.domains.markets=1;}],
  ['missing generation time',x=>delete x.generated_utc],
  ['missing readiness',x=>delete x.relationship_readiness],
  ['false historical validation',x=>x.relationship_readiness.historical_relationships_validated=1],
  ['future generation time',x=>x.generated_utc='2026-11-05T00:00:00Z'],
  ['future observation time',x=>x.observations[0].observed_at='2026-11-05T00:00:00Z'],
  ['invalid observation time',x=>x.observations[0].observed_at='not-a-date'],
  ['unvalidated relationship',x=>x.relationships.push({status:'proposed'})],
  ['false reuse permission',x=>x.licensing.portwatch_commercial_reuse='permitted'],
  ['missing feed health',x=>delete x.feed_health],
 ]) {
  const bad=JSON.parse(JSON.stringify(good));change(bad);
  await load(bad);
  assert.equal(document.getElementById('count').textContent,'—',name);
  assert.equal(document.getElementById('details').children.length,0,name);
  assert.match(document.getElementById('status').textContent,/Unable to load file/,name);
  await load(good);
 }
 const stale=JSON.parse(JSON.stringify(good));stale.generated_utc='2026-11-02T12:00:00Z';stale.observations[0].observed_at='2026-11-02T11:00:00Z';
 await load(stale);
 assert.match(document.getElementById('status').textContent,/STALE DATASET/);
 assert.match(document.getElementById('status').textContent,/observations exceed their domain freshness window/);
 console.log('Viewer JavaScript interaction checks passed: valid load + 15 rejected imports + stale warning');
})().catch(err=>{console.error(err);process.exitCode=1;});
