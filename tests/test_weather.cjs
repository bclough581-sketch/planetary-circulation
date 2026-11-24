'use strict';
var assert=require('assert'),L=require('../ledger.js'),W=require('../weather.js');
function mem(){var m={};return{getItem:function(k){return k in m?m[k]:null},setItem:function(k,v){m[k]=String(v)}}}
var ok=0;function t(n,fn){var r=fn();if(r&&r.then)return r.then(function(){ok++;console.log('ok',n)});ok++;console.log('ok',n)}
function alert(event,severity,extra){return {properties:Object.assign({event:event,severity:severity,status:'Actual',messageType:'Alert',areaDesc:'Test County',expires:'2026-11-25T18:00:00-06:00'},extra||{})}}
var TODAY='2026-11-23';

(async function(){
await t('only Warning-level, in-scope, Severe/Extreme, actual alerts are kept',function(){
  var list=W.parseAlerts({features:[
    alert('Hurricane Warning','Extreme'),alert('Freeze Warning','Severe'),
    alert('Freeze Watch','Moderate'),alert('Wind Advisory','Minor'),alert('Heat Advisory','Moderate'),
    alert('Tropical Storm Warning','Moderate'),                 /* in scope but not Severe/Extreme */
    alert('Extreme Cold Warning','Severe',{messageType:'Cancel'}),
    alert('Winter Storm Warning','Severe',{status:'Test'}),
    alert('Flood Warning','Severe')                              /* Warning, Severe, but not in the approved list */
  ]});
  var k=W.keepWarnings(list).map(function(a){return a.event});
  assert.deepStrictEqual(k,['Hurricane Warning','Freeze Warning']);
  assert.strictEqual(W.others(list).length,7);
});
await t('retired event names are not in scope, current ones are',function(){
  assert.strictEqual(W.EVENTS.indexOf('Hard Freeze Warning'),-1);
  assert.strictEqual(W.EVENTS.indexOf('Excessive Heat Warning'),-1);
  assert.ok(W.EVENTS.indexOf('Extreme Heat Warning')>=0&&W.EVENTS.indexOf('Freeze Warning')>=0);
});
await t('alert row holds counts and warnings only, has source, license and freshness window',function(){
  var r=W.alertRow('gulf',W.parseAlerts({features:[alert('Hurricane Warning','Extreme'),alert('Wind Advisory','Minor')]}),TODAY);
  assert.strictEqual(r.id,'WX.gulf.alerts');assert.strictEqual(r.value.count,1);assert.strictEqual(r.value.other_count,1);
  assert.strictEqual(r.source,'NWS api.weather.gov');assert.ok(/public domain/.test(r.license));assert.strictEqual(r.max_age_days,1);
  L.makeRow(r);                                               /* must be a valid ledger row */
});
await t('forecast parses the first period; empty or missing returns null',function(){
  var f=W.parseForecast({properties:{periods:[{name:'Tonight',temperature:28,temperatureUnit:'F',shortForecast:'Clear',isDaytime:false}]}},'Independence, IA');
  assert.deepStrictEqual(f,{place:'Independence, IA',name:'Tonight',temp:28,unit:'F',short:'Clear',isDaytime:false});
  assert.strictEqual(W.parseForecast({properties:{periods:[]}}),null);assert.strictEqual(W.parseForecast(null),null);
  assert.strictEqual(W.forecastRow(null,TODAY),null);
});
await t('ticker to sector follows the approved map',function(){
  assert.strictEqual(W.tickerSector('ung'),'natgas');assert.strictEqual(W.tickerSector('VLO'),'gulf');
  assert.strictEqual(W.tickerSector('CORN'),'grains');assert.strictEqual(W.tickerSector('XLU'),'power');
  assert.strictEqual(W.tickerSector('AAPL'),null);assert.strictEqual(W.tickerSector(''),null);
});
await t('flag: only when the pick sector and region match an in-scope warning; invisible otherwise',function(){
  var led=L.Ledger(mem());
  led.put(W.alertRow('northeast',W.parseAlerts({features:[alert('Extreme Cold Warning','Severe')]}),TODAY));
  led.put(W.alertRow('gulf',W.parseAlerts({features:[]}),TODAY));
  led.put(W.alertRow('midwest',W.parseAlerts({features:[alert('Extreme Cold Warning','Severe')]}),TODAY));
  var f=W.flagFor('UNG',led,TODAY);
  assert.ok(f);assert.strictEqual(f.sector,'natgas');assert.strictEqual(f.stale,false);
  assert.ok(/Extreme Cold Warning/.test(f.say)&&/Your call/.test(f.say));
  assert.strictEqual(W.flagFor('VLO',led,TODAY),null);       /* gulf has no warning */
  assert.strictEqual(W.flagFor('CORN',led,TODAY),null);      /* grains care about freeze/heat, not cold warning */
  assert.strictEqual(W.flagFor('AAPL',led,TODAY),null);      /* not a weather-sensitive name */
});
await t('flag wording never uses buy/sell/go language',function(){
  var led=L.Ledger(mem());
  led.put(W.alertRow('gulf',W.parseAlerts({features:[alert('Hurricane Warning','Extreme')]}),TODAY));
  var s=W.flagFor('XOP',led,TODAY).say;
  assert.ok(!/\b(buy|sell|go|no-go|cleared|bullish|bearish|will rise|will fall)\b/i.test(s),s);
});
await t('stale rows are marked stale on the flag, not hidden',function(){
  var led=L.Ledger(mem());
  led.put(W.alertRow('gulf',W.parseAlerts({features:[alert('Hurricane Warning','Extreme')]}),'2026-11-20'));
  assert.strictEqual(W.flagFor('VLO',led,TODAY).stale,true);
});
await t('local region needs a location; no row appears without one',async function(){
  var led=L.Ledger(mem()),calls=[];
  var f=function(u){calls.push(u);return Promise.resolve({ok:true,json:function(){return Promise.resolve({features:[]})}})};
  var res=await W.load(f,led,TODAY,null);
  assert.strictEqual(res.failed.length,0);assert.ok(!led.has('WX.local.alerts')&&!led.has('WX.local.forecast'));
  assert.strictEqual(calls.length,3);
});
await t('load with a location builds NWS urls with 4-decimal coords and keeps coordinates out of every row',async function(){
  var led=L.Ledger(mem()),calls=[];
  var f=function(u){calls.push(u);return Promise.resolve({ok:true,json:function(){
    if(/\/points\//.test(u))return Promise.resolve({properties:{forecast:'https://api.weather.gov/gridpoints/DMX/1,2/forecast',relativeLocation:{properties:{city:'Independence',state:'IA'}}}});
    if(/forecast$/.test(u))return Promise.resolve({properties:{periods:[{name:'Today',temperature:41,temperatureUnit:'F',shortForecast:'Sunny',isDaytime:true}]}});
    return Promise.resolve({features:[alert('Freeze Warning','Severe')]});}})};
  var res=await W.load(f,led,TODAY,{lat:42.46789123,lon:-91.88912345});
  assert.deepStrictEqual(res.failed,[]);assert.strictEqual(res.ok.length,5);
  assert.ok(calls.indexOf('https://api.weather.gov/points/42.4679,-91.8891')>=0);
  assert.ok(calls.indexOf('https://api.weather.gov/alerts/active?point=42.4679,-91.8891')>=0);
  assert.strictEqual(led.get('WX.local.forecast',TODAY).value.place,'Independence, IA');
  led.ids().forEach(function(id){var s=JSON.stringify(led.get(id,TODAY));assert.ok(!/42\.46|91\.88/.test(s),id)});
});
await t('one failure leaves that row as it was (shows stale), the rest still load',async function(){
  var led=L.Ledger(mem());
  led.put(W.alertRow('gulf',W.parseAlerts({features:[alert('Hurricane Warning','Extreme')]}),'2026-11-20'));
  var f=function(u){return /TX,LA/.test(u)?Promise.resolve({ok:false,status:503}):Promise.resolve({ok:true,json:function(){return Promise.resolve({features:[]})}})};
  var res=await W.load(f,led,TODAY,null);
  assert.deepStrictEqual(res.failed,['WX.gulf.alerts']);assert.strictEqual(res.ok.length,2);
  var g=led.get('WX.gulf.alerts',TODAY);assert.strictEqual(g.freshness,'stale');assert.strictEqual(g.value.count,1);
});
await t('a thrown fetch (offline) is handled, not raised',async function(){
  var led=L.Ledger(mem());
  var res=await W.load(function(){return Promise.reject(new Error('offline'))},led,TODAY,{lat:41,lon:-90});
  assert.strictEqual(res.ok.length,0);assert.strictEqual(res.failed.length,5);
});
console.log(ok+' passed');
})().catch(function(e){console.error(e);process.exit(1)});
