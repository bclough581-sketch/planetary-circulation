/* Amalgam Convergence v1 — descriptive co-occurrence, NOT predictive scoring. */
(function(root){
'use strict';
const MAX={fx:5,treasury:5,oil:12,shipping:21};
const days=(s,now)=>{const t=Date.parse(String(s||'').slice(0,10)+'T00:00:00Z');return Number.isFinite(t)?Math.floor((Date.parse(now.slice(0,10)+'T00:00:00Z')-t)/86400000):Infinity;};
function analyze(data,now){
 now=now||new Date().toISOString();const events=[],h=data.hubs||{},status=data.status||{};
 function push(e){events.push(e)}
 const ch=(data.chokepoints||[]).filter(x=>x&&Number.isFinite(+x.ratio)&&+x.ratio>=0);
 ch.forEach(x=>{
   const age=days(x.asof,now),ok=age>=0&&age<=MAX.shipping&&status.portwatch?.ok!==false;
   const ratio=+x.ratio;
   if(ratio<=.7||ratio>=1.3)push({id:'ship-'+x.id,domain:'Shipping',title:x.name,detail:(ratio*100).toFixed(0)+'% of baseline transit volume',direction:ratio<1?'below':'above',strength:Math.abs(Math.log(Math.max(ratio,.01))),asof:x.asof,age,usable:ok,reason:ok?'Measured vs source baseline':status.portwatch?.ok===false?'PortWatch refresh failed':'Outside 21-day freshness window',source:'IMF PortWatch',commercial:false,region:x.id==='HRM'?'Gulf':x.id==='BAB'||x.id==='SUZ'?'Red Sea':x.id==='CAP'?'Africa':'Global',value:ratio});
 });
 [['HOU','WTI oil'],['DXB','Brent oil']].forEach(([key,label])=>{
  const x=h[key];if(!x||!Number.isFinite(+x.chg))return;
  const age=days(x.asof,now),ok=age>=0&&age<=MAX.oil&&status.eia?.ok!==false;
  if(Math.abs(+x.chg)>=2)push({id:'oil-'+key,domain:'Energy',title:label,detail:(+x.chg>0?'+':'')+(+x.chg).toFixed(2)+'% latest reported change',direction:+x.chg>0?'up':'down',strength:Math.abs(+x.chg)/3,asof:x.asof,age,usable:ok,reason:ok?'Daily spot change':status.eia?.ok===false?'EIA refresh failed':'Outside 12-day freshness window',source:'U.S. EIA',commercial:true,region:'Global',value:+x.chg});
 });
 // ECB reference rates: quoted as local currency per euro, NOT a USD index.
 // Large moves are observations only; do not infer capital flight or causation.
 const fxLabels={GRU:'Brazilian real / EUR',LON:'Pound / EUR',FRA:'U.S. dollar / EUR',ZRH:'Swiss franc / EUR',JNB:'South African rand / EUR',BOM:'Indian rupee / EUR',SHA:'Chinese yuan / EUR',TYO:'Japanese yen / EUR',SYD:'Australian dollar / EUR'};
 Object.entries(fxLabels).forEach(([key,label])=>{
  const x=h[key];if(!x||!Number.isFinite(+x.chg)||Math.abs(+x.chg)<.75)return;
  const age=days(x.asof,now),ok=age>=0&&age<=MAX.fx&&status.ecb?.ok!==false;
  push({id:'fx-'+key,domain:'FX',title:label,detail:(+x.chg>0?'+':'')+(+x.chg).toFixed(2)+'% change in local currency per EUR',direction:+x.chg>0?'higher quote':'lower quote',strength:Math.abs(+x.chg),asof:x.asof,age,usable:ok,reason:ok?'ECB daily reference rate':status.ecb?.ok===false?'ECB refresh failed':'Outside 5-day freshness window',source:'European Central Bank',commercial:true,region:key==='GRU'?'South America':key==='JNB'?'Africa':key==='BOM'||key==='SHA'||key==='TYO'?'Asia':'Global',value:+x.chg});
 });
 const y=h.NYC;if(y&&Number.isFinite(+y.chg)&&Math.abs(+y.chg)>=5){
  const age=days(y.asof,now),ok=age>=0&&age<=MAX.treasury&&status.ust?.ok!==false;
  push({id:'rates-nyc',domain:'Rates',title:'U.S. 10-year yield',detail:(+y.chg>0?'+':'')+(+y.chg).toFixed(1)+' bp latest reported change',direction:+y.chg>0?'up':'down',strength:Math.abs(+y.chg)/10,asof:y.asof,age,usable:ok,reason:ok?'Daily yield change':status.ust?.ok===false?'Treasury refresh failed':'Outside 5-day freshness window',source:'U.S. Treasury',commercial:true,region:'Global',value:+y.chg});
 }
 const fresh=events.filter(e=>e.usable),stale=events.filter(e=>!e.usable);
 // Convergence requires independently sourced domains. No causal assertion.
 const shipping=fresh.filter(e=>e.domain==='Shipping'&&e.direction==='below');
 const energy=fresh.filter(e=>e.domain==='Energy'&&e.direction==='up');
 const convergence=[];
 if(shipping.length&&energy.length){
  const shippingBest=shipping.slice().sort((a,b)=>b.strength-a.strength)[0];
  const energyBest=energy.slice().sort((a,b)=>b.strength-a.strength)[0];
  convergence.push({id:'shipping-energy',title:'Shipping pressure + rising oil',evidence:[shippingBest,energyBest],interpretation:'Two independent measurements are moving in directions consistent with transport stress and higher oil prices. This does not establish causation or predict price.',check:'Verify vessel mix, weather, rerouting and whether the oil move persists.',licenseBlocked:true});
 }
 return {generated:data.generated_utc,events:fresh.sort((a,b)=>b.strength-a.strength),excluded:stale,convergence,commercialReady:!convergence.some(c=>c.licenseBlocked),sourceHealth:Object.entries(status).map(([name,v])=>({name,ok:v.ok!==false,error:v.error||''}))};
}
const API={analyze,days,MAX};if(typeof module!=='undefined'&&module.exports)module.exports=API;else root.AMALGAM_CONVERGENCE=API;
})(typeof window!=='undefined'?window:this);
