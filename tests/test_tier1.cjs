'use strict';
var assert=require('assert'),L=require('../ledger.js'),T=require('../tier1.js');
function mem(){var m={};return{getItem:function(k){return k in m?m[k]:null},setItem:function(k,v){m[k]=String(v)}}}
function bars(n,f,vf){var out=[],d=new Date('2025-01-02T00:00:00Z'),i;for(i=0;i<n;i++){var c=f(i);out.push({d:d.toISOString().slice(0,10),o:c,h:c,l:c,c:c,v:vf?vf(i):1000});d=new Date(d.getTime()+864e5)}return out}
var ok=0;function t(n,fn){fn();ok++;console.log('ok',n)}

t('ledger rejects incomplete or bad-date rows',function(){
  assert.throws(function(){L.makeRow({id:'x',value:1,as_of:'2026-11-20',source:'s',license:'',max_age_days:5})});
  assert.throws(function(){L.makeRow({id:'x',value:1,as_of:'2026-13-40',source:'s',license:'l',max_age_days:5})});
});
t('freshness: fresh on the edge, stale one day later',function(){
  var r=L.makeRow({id:'x',value:1,as_of:'2026-11-15',source:'s',license:'l',max_age_days:5});
  assert.strictEqual(L.freshness(r,'2026-11-20').state,'fresh');
  assert.strictEqual(L.freshness(r,'2026-11-21').state,'stale');
});
t('ledger persists and reports freshness on read',function(){
  var s=mem();L.Ledger(s).put({id:'A.trend',value:{n:1},as_of:'2026-11-10',source:'s',license:'l',max_age_days:5});
  var b=L.Ledger(s).get('A.trend','2026-11-22');
  assert.strictEqual(b.freshness,'stale');assert.strictEqual(b.age_days,12);
  assert.strictEqual(L.Ledger(s).get('nope','2026-11-22'),null);
});
t('trend: rising line is UPTREND with exact averages',function(){
  var r=T.trend(bars(260,function(i){return 100+i}));
  assert.strictEqual(r.state,'UPTREND');assert.strictEqual(r.arrow,'▲');
  assert.strictEqual(r.n,359);assert.strictEqual(r.fast,334.5);assert.strictEqual(r.slow,259.5);
});
t('trend: falling line is DOWNTREND, a rising line that suddenly drops below its 50-day is MIXED',function(){
  var d=T.trend(bars(260,function(i){return 400-i}));
  assert.strictEqual(d.state,'DOWNTREND');assert.strictEqual(d.arrow,'▼');
  var m=T.trend(bars(260,function(i){return i<250?100+i:100}));
  assert.strictEqual(m.state,'MIXED');
});
t('trend: fewer than 200 bars gives nothing, never a guess',function(){
  assert.strictEqual(T.trend(bars(150,function(i){return 100+i})),null);
});
t('volume: 3x the 20-day average on an up day is HEAVY and up',function(){
  var b=bars(30,function(i){return 100+i},function(i){return i===29?3000:1000});
  var r=T.volume(b);assert.strictEqual(r.state,'HEAVY');assert.strictEqual(r.n,3);assert.strictEqual(r.up,true);
});
t('volume: 1.4x is NORMAL (threshold is 1.5x); down day shows down arrow',function(){
  var b=bars(30,function(i){return i===29?50:100},function(i){return i===29?1400:1000});
  var r=T.volume(b);assert.strictEqual(r.state,'NORMAL');assert.strictEqual(r.arrow,'▼');
});
t('volume: zero-volume history returns null, not NaN',function(){
  assert.strictEqual(T.volume(bars(30,function(){return 1},function(){return 0})),null);
});
t('vix bands and direction',function(){
  assert.strictEqual(T.vixRead(14.9).state,'CALM');assert.strictEqual(T.vixRead(15).state,'NORMAL');
  assert.strictEqual(T.vixRead(25).state,'NORMAL');assert.strictEqual(T.vixRead(25.1).state,'STRESSED');
  assert.strictEqual(T.vixRead(20,18).arrow,'▲');assert.strictEqual(T.vixRead(20,22).arrow,'▼');
  assert.strictEqual(T.vixRead(20).arrow,'–');assert.strictEqual(T.vixRead(0),null);assert.strictEqual(T.vixRead(NaN),null);
});
t('earnings: window edges at 42 days, passed date, bad input',function(){
  assert.strictEqual(T.earningsRead('2026-12-04','2026-11-22').n,12);
  assert.strictEqual(T.earningsRead('2027-01-03','2026-11-22').state,'INSIDE YOUR WINDOW');
  assert.strictEqual(T.earningsRead('2027-01-04','2026-11-22').state,'CLEAR');
  assert.strictEqual(T.earningsRead('2026-11-01','2026-11-22').state,'PASSED');
  assert.strictEqual(T.earningsRead('12/05/2026','2026-11-22'),null);
});
t('ingest writes rows with source, license and as-of from the last bar',function(){
  var l=L.Ledger(mem()),b=bars(260,function(i){return 100+i}),rows=T.ingestBars(l,'AAA',b,'SRC','LIC');
  assert.strictEqual(rows.length,2);
  var g=l.get('AAA.trend','2025-09-20');assert.strictEqual(g.as_of,b[259].d);
  assert.strictEqual(g.source,'SRC');assert.strictEqual(g.license,'LIC');
  assert.strictEqual(l.get('AAA.trend','2099-01-01').freshness,'stale');
});
t('manual entries carry a you-typed source and license',function(){
  var l=L.Ledger(mem());T.ingestVix(l,18.4,0,'2026-11-22');T.ingestEarnings(l,'AAA','2026-12-05','2026-11-22','2026-11-22');
  assert.ok(/Typed by you/.test(l.get('VIX.level','2026-11-22').source));
  assert.strictEqual(l.get('AAA.earnings','2026-11-22').value.date,'2026-12-05');
  assert.throws(function(){T.ingestVix(l,-1,0,'2026-11-22')});assert.throws(function(){T.ingestEarnings(l,'AAA','soon','2026-11-22','2026-11-22')});
});
console.log(ok+' passed');
