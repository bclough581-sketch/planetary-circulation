/* Amalgam evidence graph v1. Deterministic, inspectable relationships; no forecast. */
(function(root){
'use strict';
const RULES=[
 {id:'maritime-energy',name:'Maritime / energy stress',a:{domain:'Shipping',direction:'below'},b:{domain:'Energy',direction:'up'},windowDays:10,geography:'Global',hypothesis:'Lower chokepoint traffic and higher oil prices occur in the same observation window.',alternatives:['Seasonal shipping patterns','Weather or canal restrictions','Oil supply and demand changes unrelated to shipping'],verify:'Check vessel classes, alternate routes, oil inventories and dated news before attributing cause.'},
 {id:'rates-fx',name:'Rates / currency repricing',a:{domain:'Rates'},b:{domain:'FX'},windowDays:5,geography:'Global',hypothesis:'A large U.S. yield change and a large ECB currency-rate change are observed near each other.',alternatives:['Independent central-bank announcements','Local currency-specific developments','Data reporting calendars'],verify:'Check central-bank announcements and aligned market-session timestamps.'}
];
function matches(e,q){return e.domain===q.domain&&(!q.direction||e.direction===q.direction);}
function dayDiff(a,b){const x=Date.parse(a+'T00:00:00Z'),y=Date.parse(b+'T00:00:00Z');return Number.isFinite(x)&&Number.isFinite(y)?Math.abs(Math.round((x-y)/86400000)):Infinity;}
function build(result,options){
 options=options||{};const rules=options.rules||RULES;
 const nodes=(result.events||[]).filter(e=>e.usable===true&&e.asof&&e.source).map(e=>({
  id:e.id,type:'observation',domain:e.domain,label:e.title,asof:e.asof,source:e.source,region:e.region||'Global',direction:e.direction,detail:e.detail,
  license:e.commercial===false?'restricted':'review',strength:e.strength
 }));
 const links=[],cases=[];
 for(const rule of rules){
  const aa=nodes.filter(e=>matches(e,rule.a)),bb=nodes.filter(e=>matches(e,rule.b));
  const pairs=[];
  for(const a of aa)for(const b of bb){
   if(a.id===b.id||a.source===b.source)continue;
   const gap=dayDiff(a.asof,b.asof);
   if(gap>rule.windowDays)continue;
   pairs.push({a,b,gap});
  }
  pairs.sort((x,y)=>x.gap-y.gap||(y.a.strength+y.b.strength)-(x.a.strength+x.b.strength));
  if(!pairs.length)continue;
  const chosen=pairs[0],evidence=[chosen.a,chosen.b];
  const id='case-'+rule.id;
  links.push(...evidence.map(e=>({from:e.id,to:id,kind:'supports-cooccurrence'})));
  cases.push({id,title:rule.name,kind:'co-occurrence',status:'observed-not-explained',asof:evidence.map(e=>e.asof).sort().at(-1),
   gapDays:chosen.gap,evidenceIds:evidence.map(e=>e.id),hypothesis:rule.hypothesis,
   alternatives:rule.alternatives,verify:rule.verify,licenseBlocked:evidence.some(e=>e.license==='restricted'),
   confidence:'Not estimated',forecast:false});
 }
 return {schema:'amalgam-evidence-v1',generated:result.generated||null,nodes,links,cases,
  excluded:(result.excluded||[]).map(e=>({id:e.id,reason:e.reason,asof:e.asof})),
  limitations:['Correlation does not establish causation','Rules are exploratory and not backtested','Source permissions must be reviewed before commercial distribution']};
}
const API={build,dayDiff,RULES};if(typeof module!=='undefined'&&module.exports)module.exports=API;else root.AMALGAM_EVIDENCE=API;
})(typeof window!=='undefined'?window:this);
