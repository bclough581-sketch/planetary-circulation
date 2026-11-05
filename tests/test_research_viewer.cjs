const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {webcrypto,createHash} = require('node:crypto');
const html = fs.readFileSync('convergence-research.html','utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script, 'viewer script missing');
class Element {
  constructor(){this.textContent='';this.children=[];this.className='';this.handlers={};this.style={};this.attributes={};}
  setAttribute(name,value){this.attributes[name]=value;}
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
vm.runInNewContext(script,{document,Map,Set,Object,Error,Array,String,Date:FixedDate,Number,Math,crypto:webcrypto,TextEncoder,Uint8Array});
const load=async data=>{
  await document.getElementById('file').handlers.change({target:{files:[{text:async()=>JSON.stringify(data)}]}});
};
const names=['weather','geopolitics','maritime','aviation','energy','commodities','economics','markets','corporate'];
const empty=()=>Object.fromEntries(names.map(x=>[x,0]));
const event={id:'one',domain:'weather',title:'Test',status:'observed',observed_at:'2026-11-04T12:00:00Z',metadata:{expires:'2026-11-05T12:00:00Z'},missing:['Verified market impact','Independent cross-domain explanation'],source:{name:'NOAA National Weather Service',url:'https://www.weather.gov/documentation/services-web-api'}};
const good={schema:'amalgam.research.v1',observations:[event],excluded:[],relationships:[],domains:{...empty(),weather:1},predictive_advantage:'not_established',generated_utc:'2026-11-04T19:00:00Z',licensing:{portwatch_commercial_reuse:'permission_not_verified'},feed_health:[{feed:'eia',condition:'eligible_source'}],relationship_readiness:{status:'not_ready',historical_relationships_validated:0,predictive_advantage:'not_established',distinct_observation_dates:{weather:1},blocking_reasons:['No historical panel']}};
const loadAudit=async data=>{
 await document.getElementById('audit-file').handlers.change({target:{files:[{text:async()=>JSON.stringify(data)}]}});
};
(async()=>{
 const panel={schema:'amalgam.cross-domain-observation-panel.v1',publication_time_verified:false,observations:[{date:'2025-01-02',wti_usd_per_barrel:70,brent_usd_per_barrel:75,treasury_10y_percent:4.4},{date:'2025-01-03',wti_usd_per_barrel:71,brent_usd_per_barrel:76,treasury_10y_percent:4.5}]};
 const fingerprint=createHash('sha256').update(JSON.stringify([{brent_usd_per_barrel:75,date:'2025-01-02',treasury_10y_percent:4.4,wti_usd_per_barrel:70},{brent_usd_per_barrel:76,date:'2025-01-03',treasury_10y_percent:4.5,wti_usd_per_barrel:71}])).digest('hex');
 const audit={source_panel_schema:panel.schema,source_observation_count:2,source_observations_sha256:fingerprint,status:'blocked',decision_utc:'2026-11-04T00:00:00Z',usable_count:0,blocked_count:2,
   blocked:[{date:'2025-01-02',reason:'missing_independent_availability_evidence'},
            {date:'2025-01-03',reason:'missing_independent_availability_evidence'}],
   predictive_advantage:'not_established'};
 await document.getElementById('historical-file').handlers.change({target:{files:[{text:async()=>JSON.stringify(panel)}]}});
 await loadAudit(audit);
 const loadDescriptive=async data=>document.getElementById('descriptive-file').handlers.change({target:{files:[{text:async()=>JSON.stringify(data)}]}});
 const descriptive={schema:'amalgam.descriptive-historical-research.v1',status:'descriptive_only',matched_dates:2,source_observations_sha256:fingerprint,first_date:'2025-01-02',last_date:'2025-01-03',
  brent_minus_wti_usd_per_barrel:{minimum:5,maximum:5,mean:5,median:5,standard_deviation:0,positive_dates:2,zero_dates:0,negative_dates:0},
  treasury_10y_percent:{minimum:4.4,maximum:4.5,mean:4.45,median:4.45,standard_deviation:0.0707},
  asof_eligible_dates:0,relationships:[],predictive_advantage:'not_established',warning:'Descriptive only; no predictive lift is inferred.'};
 await loadDescriptive(descriptive);
 assert.match(document.getElementById('descriptive-status').textContent,/MATCH/);
 assert.match(document.getElementById('descriptive-values').children[1].textContent,/median 5/);
 assert.match(document.getElementById('descriptive-values').children[3].textContent,/2 positive \\| 0 zero \\| 0 negative/);
 assert.match(document.getElementById('descriptive-values').children[4].textContent,/0 calendar gaps longer than 3 days \\| longest 1 days/);
 assert.match(document.getElementById('descriptive-values').children[5].textContent,/2025-01-02 spread 5/);
 assert.match(document.getElementById('descriptive-values').children[5].textContent,/2025-01-03 spread 5/);
 let resolveOldReport;
 const delayedReport=new Promise(resolve=>{resolveOldReport=resolve;});
 const oldReportImport=document.getElementById('descriptive-file').handlers.change({target:{files:[{text:()=>delayedReport}]}});
 await loadDescriptive(descriptive);
 resolveOldReport('{stale malformed report');
 await oldReportImport;
 assert.match(document.getElementById('descriptive-status').textContent,/MATCH/);
 let resolveOldPanel;
 const delayedPanel=new Promise(resolve=>{resolveOldPanel=resolve;});
 const oldPanelImport=document.getElementById('historical-file').handlers.change({target:{files:[{text:()=>delayedPanel}]}});
 await document.getElementById('historical-file').handlers.change({target:{files:[{text:async()=>JSON.stringify(panel)}]}});
 resolveOldPanel('{stale malformed panel');
 await oldPanelImport;
 assert.match(document.getElementById('descriptive-status').textContent,/MATCH/);
 assert.match(document.getElementById('historical-status').textContent,/Load both historical panel and audit/);
 await document.getElementById('descriptive-file').handlers.change({target:{files:[{text:async()=>'{broken report'}]}});
 assert.equal(document.getElementById('descriptive-values').children.length,0);
 assert.match(document.getElementById('descriptive-status').textContent,/Descriptive report rejected/);
 await loadDescriptive(descriptive);
 assert.match(document.getElementById('descriptive-status').textContent,/MATCH/);
 const impossiblePanel={...panel,observations:panel.observations.map((x,i)=>i===0?{...x,date:'2025-02-30'}:x)};
 await document.getElementById('historical-file').handlers.change({target:{files:[{text:async()=>JSON.stringify(impossiblePanel)}]}});
 await loadDescriptive({...descriptive,first_date:'2025-02-30'});
 assert.match(document.getElementById('descriptive-status').textContent,/REJECTED: Invalid or mismatched dates/);
 await document.getElementById('historical-file').handlers.change({target:{files:[{text:async()=>JSON.stringify(panel)}]}});
 await loadDescriptive(descriptive);
 assert.match(document.getElementById('descriptive-status').textContent,/MATCH/);
 await loadDescriptive({...descriptive,brent_minus_wti_usd_per_barrel:{...descriptive.brent_minus_wti_usd_per_barrel,mean:99}});
 assert.match(document.getElementById('descriptive-status').textContent,/REJECTED/);
 await loadDescriptive({...descriptive,brent_minus_wti_usd_per_barrel:{...descriptive.brent_minus_wti_usd_per_barrel,forecast_probability:0.95}});
 assert.match(document.getElementById('descriptive-status').textContent,/REJECTED/);
 await loadDescriptive({...descriptive,warning:'Predictive performance is proven.'});
 assert.match(document.getElementById('descriptive-status').textContent,/REJECTED/);
 await loadDescriptive({...descriptive,stock_pick_confidence:0.99});
 assert.match(document.getElementById('descriptive-status').textContent,/REJECTED/);
 await loadDescriptive({...descriptive,source_observations_sha256:'0'.repeat(64)});
 assert.match(document.getElementById('descriptive-status').textContent,/fingerprint mismatch/);
 assert.match(document.getElementById('descriptive-status').textContent,/REJECTED/);
 assert.equal(document.getElementById('descriptive-values').children.length,0);
 await loadDescriptive(descriptive);
 assert.match(document.getElementById('descriptive-status').textContent,/MATCH/);
 await document.getElementById('historical-file').handlers.change({target:{files:[{text:async()=>'{broken json'}]}});
 assert.equal(document.getElementById('descriptive-values').children.length,0);
 assert.equal(document.getElementById('audit-reasons').children.length,0);
 assert.equal(document.getElementById('audit-dates').children.length,0);
 assert.match(document.getElementById('audit-status').textContent,/prior audit summary cleared/);
 assert.match(document.getElementById('descriptive-status').textContent,/must be reverified/);
 assert.match(document.getElementById('historical-status').textContent,/Historical panel rejected/);
 await document.getElementById('historical-file').handlers.change({target:{files:[{text:async()=>JSON.stringify(panel)}]}});
 assert.match(document.getElementById('descriptive-status').textContent,/MATCH/);
 assert.match(document.getElementById('historical-status').textContent,/Load both historical panel and audit/);
 await loadAudit(audit);
 assert.match(document.getElementById('historical-status').textContent,/fingerprint MATCH/);
 assert.match(document.getElementById('audit-status').textContent,/2 excluded/);
 assert.match(document.getElementById('audit-status').textContent,/Imported audit claims/);
 await loadAudit({...audit,blocked:[{date:'2025-01-02',reason:'missing_independent_availability_evidence'},{date:'2025-01-03',reason:'publication_record_not_independently_authenticated'}]});
 assert.match(document.getElementById('historical-status').textContent,/cannot be independently reproduced/);
 await loadAudit(audit);
 assert.match(document.getElementById('audit-reasons').children[0].textContent,/2 blocked/);
 let resolveOldAudit;
 const delayedAudit=new Promise(resolve=>{resolveOldAudit=resolve;});
 const oldAuditImport=document.getElementById('audit-file').handlers.change({target:{files:[{text:()=>delayedAudit}]}});
 await loadAudit(audit);
 resolveOldAudit('{stale malformed audit');
 await oldAuditImport;
 assert.match(document.getElementById('historical-status').textContent,/fingerprint MATCH/);
 assert.match(document.getElementById('audit-status').textContent,/2 excluded/);
 let resolvePanelBoundAudit;
 const delayedBoundAudit=new Promise(resolve=>{resolvePanelBoundAudit=resolve;});
 const pendingBoundAudit=document.getElementById('audit-file').handlers.change({target:{files:[{text:()=>delayedBoundAudit}]}});
 await document.getElementById('historical-file').handlers.change({target:{files:[{text:async()=>JSON.stringify(panel)}]}});
 resolvePanelBoundAudit(JSON.stringify(audit));
 await pendingBoundAudit;
 assert.match(document.getElementById('audit-status').textContent,/prior audit summary cleared/);
 assert.match(document.getElementById('historical-status').textContent,/Load both historical panel and audit/);
 await loadAudit(audit);
 await loadAudit({...audit,source_observations_sha256:'0'.repeat(64)});
 assert.match(document.getElementById('historical-status').textContent,/fingerprint mismatch/);
 await loadAudit({...audit,usable_count:1,status:'eligible_for_asof_analysis'});
 assert.match(document.getElementById('audit-status').textContent,/Audit rejected/);
 await loadAudit({...audit,blocked_count:3});
 assert.match(document.getElementById('audit-status').textContent,/Audit rejected/);

 await load(good);
 assert.equal(document.getElementById('ring-domains').children.length,9);
 const weatherNode=document.getElementById('ring-domains').children[0];
 assert.match(weatherNode.className,/covered/);
 assert.match(weatherNode.attributes['aria-label'],/weather: 1 imported \/ 1 within/);
 document.getElementById('ledger-search').value='unmatched';
 document.getElementById('ledger-freshness').value='outside';
 weatherNode.handlers.click();
 assert.equal(document.getElementById('ring-domains').children[0],weatherNode,'Keep keyboard focus target stable when filtering');
 assert.equal(document.getElementById('ledger-domain').value,'weather');
 assert.equal(document.getElementById('ledger-search').value,'');
 assert.equal(document.getElementById('ledger-freshness').value,'all');
 assert.equal(document.getElementById('ring-domains').children[0].attributes['aria-pressed'],'true');
 assert.match(document.getElementById('details').children[1].textContent,/weather/);
 document.getElementById('ring-domains').children[1].handlers.click();
 assert.match(document.getElementById('details').children[0].textContent,/0 matching imported/);
 assert.match(document.getElementById('ring-selection').textContent,/geopolitics/);
 assert.equal(document.getElementById('ring-domains').children[0].attributes['aria-pressed'],'false');
 document.getElementById('ring-all').handlers.click();
 assert.equal(document.getElementById('ledger-domain').value,'all');
 assert.match(document.getElementById('details').children[1].textContent,/weather/);
 document.getElementById('ledger-freshness').value='within';
 document.getElementById('ledger-freshness').handlers.change();
 assert.equal(document.getElementById('details').children.length,2);
 document.getElementById('ledger-freshness').value='outside';
 document.getElementById('ledger-freshness').handlers.change();
 assert.equal(document.getElementById('details').children.length,1);
 document.getElementById('ledger-freshness').value='all';
 document.getElementById('ledger-freshness').handlers.change();
 assert.equal(document.getElementById('count').textContent,1);
 assert.match(document.getElementById('decision-boundary').children[0].textContent,/1\/9 domains have imported observations; 1\/9 have observations/);
 assert.match(document.getElementById('decision-boundary').children[0].textContent,/NO VALIDATED STOCK-SELECTION SIGNAL/);
 assert.match(document.getElementById('domains').children[0].children[2].textContent,/1 within freshness window \/ 0 outside \/ 1 attributed sources/);
 assert.match(document.getElementById('domains').children[1].children[2].textContent,/NO IMPORTED EVIDENCE/);
 assert.equal(document.getElementById('link-count').textContent,'0 validated links');
 assert.match(document.getElementById('details').children[1].textContent,/within domain freshness window/);
 assert.match(document.getElementById('details').children[1].textContent,/imported snapshot age 1h/);
 assert.match(document.getElementById('details').children[1].textContent,/source https:\/\/www.weather.gov\/documentation\/services-web-api/);
 assert.match(document.getElementById('details').children[1].textContent,/evidence gaps: Verified market impact; Independent cross-domain explanation/);
 assert.match(document.getElementById('details').children[1].textContent,/no numeric or text measurement supplied/);
 const measured={...good,observations:[{...event,value:1.23,unit:'baseline ratio',metadata:{...event.metadata,asof:'2026-11-04'}}]};
 await load(measured);
 assert.match(document.getElementById('details').children[1].textContent,/reported value 1.23 baseline ratio/);
 assert.match(document.getElementById('details').children[1].textContent,/source as-of 2026-11-04/);
 await load(good);
 document.getElementById('ledger-domain').value='energy';
 document.getElementById('ledger-domain').handlers.change();
 assert.equal(document.getElementById('details').children.length,1);
 assert.match(document.getElementById('details').children[0].textContent,/0 matching imported observations/);
 document.getElementById('ledger-domain').value='all';
 document.getElementById('ledger-domain').handlers.change();
 assert.match(document.getElementById('details').children[1].textContent,/weather/);
 document.getElementById('ledger-search').value='unmatched evidence';
 document.getElementById('ledger-search').handlers.input();
 assert.equal(document.getElementById('details').children.length,1);
 document.getElementById('ledger-search').value='NOAA';
 document.getElementById('ledger-search').handlers.input();
 assert.match(document.getElementById('details').children[1].textContent,/weather/);
 document.getElementById('ledger-search').value='';
 document.getElementById('ledger-search').handlers.input();
 const ordered={...good,observations:[event,{...event,id:'two',title:'Earlier',observed_at:'2026-11-03T12:00:00Z'}],domains:{...empty(),weather:2}};
 await load(ordered);
 assert.match(document.getElementById('details').children[1].textContent,/Test/);
 document.getElementById('ledger-order').value='oldest';
 document.getElementById('ledger-order').handlers.change();
 assert.match(document.getElementById('details').children[1].textContent,/Earlier/);
 document.getElementById('ledger-order').value='newest';
 document.getElementById('ledger-order').handlers.change();
 assert.match(document.getElementById('details').children[1].textContent,/Test/);
 await load(good);
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
  ['timezone-free observation',x=>x.observations[0].observed_at='2026-11-04T12:00:00'],
  ['observation after generation',x=>x.observations[0].observed_at='2026-11-04T19:00:01Z'],
  ['unvalidated relationship',x=>x.relationships.push({status:'proposed'})],
  ['false reuse permission',x=>x.licensing.portwatch_commercial_reuse='permitted'],
  ['missing feed health',x=>delete x.feed_health],
  ['accepted and excluded simultaneously',x=>x.excluded.push({id:'one',reason:'stale'})],
  ['excluded evidence missing reason',x=>x.excluded.push({id:'rejected',reason:''})],
  ['duplicate excluded evidence ID',x=>x.excluded.push({id:'rejected',reason:'stale'},{id:'rejected',reason:'failed'})],
  ['event validated without evidence',x=>x.observations[0].status='validated'],
  ['embedded forecast probability',x=>x.observations[0].probability=0.9],
 ]) {
  const bad=JSON.parse(JSON.stringify(good));change(bad);
  await load(bad);
  assert.equal(document.getElementById('count').textContent,'—',name);
  assert.equal(document.getElementById('details').children.length,0,name);
  assert.ok(document.getElementById('ring-domains').children.every(node=>node.disabled),name);
  assert.ok(document.getElementById('ring-all').disabled,name);
  assert.match(document.getElementById('status').textContent,/Unable to load file/,name);
  await load(good);
 }
 let resolveOld;
 const oldFile={text:()=>new Promise(resolve=>{resolveOld=resolve;})};
 const pending=document.getElementById('file').handlers.change({target:{files:[oldFile]}});
 assert.equal(document.getElementById('details').children.length,0);
 assert.equal(document.getElementById('count').textContent,'—');
 assert.ok(document.getElementById('ring-domains').children.every(node=>node.disabled));
 assert.match(document.getElementById('domains').textContent,/Previous coverage cleared/);
 assert.match(document.getElementById('source-health').textContent,/Awaiting replacement/);
 assert.match(document.getElementById('readiness').textContent,/Awaiting replacement/);
 assert.match(document.getElementById('exclusion-reasons').textContent,/Awaiting replacement/);
 assert.match(document.getElementById('status').textContent,/Import in progress/);
 await load(good);
 resolveOld(JSON.stringify({...good,observations:[],domains:empty()}));
 await pending;
 assert.equal(document.getElementById('count').textContent,1);
 assert.match(document.getElementById('details').children[1].textContent,/weather/);
 const withExclusions={...good,excluded:[{id:'rejected-1',reason:'outside freshness window'},{id:'rejected-2',reason:'source collector failed'}]};
 await load(withExclusions);
 assert.match(document.getElementById('excluded-ledger').children[0].textContent,/2 of 2 pipeline-excluded/);
 assert.match(document.getElementById('excluded-ledger').children[1].textContent,/rejected-1|rejected-2/);
 await load(good);
 assert.match(document.getElementById('excluded-ledger').children[0].textContent,/0 of 0 pipeline-excluded/);
 const expired=JSON.parse(JSON.stringify(good));expired.observations[0].metadata.expires='2026-11-04T18:00:00Z';
 await load(expired);
 assert.match(document.getElementById('ring-domains').children[0].className,/outside/);
 assert.doesNotMatch(document.getElementById('ring-domains').children[0].className,/covered/);
 assert.match(document.getElementById('details').children[1].textContent,/WEATHER ALERT EXPIRED/);
 assert.match(document.getElementById('domains').children[0].children[2].textContent,/0 within freshness window \/ 1 outside/);
 assert.match(document.getElementById('status').textContent,/1 imported observations are outside viewer-time freshness or have expired/);
 document.getElementById('ledger-freshness').value='within';
 document.getElementById('ledger-freshness').handlers.change();
 assert.equal(document.getElementById('details').children.length,1);
 document.getElementById('ledger-freshness').value='all';
 await load(good);
 const stale=JSON.parse(JSON.stringify(good));stale.generated_utc='2026-11-02T12:00:00Z';stale.observations[0].observed_at='2026-11-02T11:00:00Z';
 await load(stale);
 assert.match(document.getElementById('status').textContent,/STALE DATASET/);
 assert.match(document.getElementById('status').textContent,/imported observations are outside viewer-time freshness/);
 console.log('Viewer JavaScript interaction checks passed: valid load + 15 rejected imports + stale warning');
})().catch(err=>{console.error(err);process.exitCode=1;});
