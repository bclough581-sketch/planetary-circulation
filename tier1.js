/* Amalgam Tier 1 (Armor). Turns price bars and typed entries into ledger rows.
   Bars: [{d:'YYYY-MM-DD',o,h,l,c,v}] oldest -> newest. Pure functions; no network, no DOM.
   These describe what already happened. They are not signals and not advice. */
(function(root){
'use strict';
var L=(typeof require!=='undefined'&&typeof module!=='undefined')?require('./ledger.js'):root.LEDGER;
var T={fast:50,slow:200,volLen:20,volHeavy:1.5,windowDays:42,barMaxAge:5,manualMaxAge:5,earnMaxAge:120};

function sma(bars,n){
  if(bars.length<n)return null;
  var s=0,i;for(i=bars.length-n;i<bars.length;i++)s+=bars[i].c;
  return s/n;
}
function f2(x){return x.toFixed(2);}

function trend(bars){
  if(!bars||bars.length<T.slow)return null;
  var c=bars[bars.length-1].c,a=sma(bars,T.fast),b=sma(bars,T.slow);
  var state=(c>a&&a>b)?'UPTREND':(c<a&&a<b)?'DOWNTREND':'MIXED';
  return {n:c,fast:a,slow:b,state:state,arrow:c>a?'▲':'▼',
    say:'Close '+f2(c)+' is '+(c>a?'above':'below')+' its 50-day average ('+f2(a)+') and '+(c>b?'above':'below')+' its 200-day ('+f2(b)+').'};
}
function volume(bars){
  if(!bars||bars.length<T.volLen+2)return null;
  var last=bars[bars.length-1],prev=bars[bars.length-2],s=0,i;
  for(i=bars.length-1-T.volLen;i<bars.length-1;i++)s+=bars[i].v;
  var avg=s/T.volLen;if(!(avg>0))return null;
  var r=last.v/avg,up=last.c>prev.c;
  return {n:r,avg:avg,up:up,state:r>=T.volHeavy?'HEAVY':'NORMAL',arrow:up?'▲':'▼',
    say:'Latest day closed '+(up?'up':'down')+' on '+r.toFixed(1)+'x its 20-day average volume.'};
}
function vixRead(level,prev){
  if(!(level>0))return null;
  var state=level<15?'CALM':level<=25?'NORMAL':'STRESSED';
  var arrow=(prev>0)?(level>prev?'▲':level<prev?'▼':'–'):'–';
  return {n:level,prev:prev>0?prev:null,state:state,arrow:arrow,
    say:'VIX '+level.toFixed(1)+(prev>0?' (was '+prev.toFixed(1)+')':'')+'. Common reading: under 15 calm, 15 to 25 normal, over 25 stressed. That is a market habit, not your rule.'};
}
function earningsRead(dateStr,today){
  if(!L.validDate(dateStr))return null;
  var days=L.dayDiff(today,dateStr);
  if(days<0)return {n:days,state:'PASSED',arrow:'–',say:'That date is behind us. Enter the next report date.'};
  var inside=days<=T.windowDays;
  return {n:days,state:inside?'INSIDE YOUR WINDOW':'CLEAR',arrow:'–',
    say:'Reports in '+days+' day'+(days===1?'':'s')+' ('+dateStr+'). Your swing window is 2 to 6 weeks, up to '+T.windowDays+' days.'};
}

function ingestBars(ledger,sym,bars,source,license){
  var out=[],a=trend(bars),v=volume(bars);
  if(!bars||!bars.length)return out;
  var asof=bars[bars.length-1].d;
  if(a)out.push(ledger.put({id:sym+'.trend',value:a,as_of:asof,source:source,license:license,max_age_days:T.barMaxAge}));
  if(v)out.push(ledger.put({id:sym+'.volume',value:v,as_of:asof,source:source,license:license,max_age_days:T.barMaxAge}));
  return out;
}
var YOU='Entered by you. Shown to you only.';
function ingestVix(ledger,level,prev,asof){
  var r=vixRead(level,prev);if(!r)throw new Error('VIX must be a number above 0');
  return ledger.put({id:'VIX.level',value:r,as_of:asof,source:'Typed by you (Cboe VIX)',license:YOU,max_age_days:T.manualMaxAge});
}
function ingestEarnings(ledger,sym,dateStr,today,asof){
  var r=earningsRead(dateStr,today);if(!r)throw new Error('Earnings date must look like 2026-12-05');
  return ledger.put({id:sym+'.earnings',value:{date:dateStr},as_of:asof,source:'Typed by you (company report date)',license:YOU,max_age_days:T.earnMaxAge});
}

var API={T:T,sma:sma,trend:trend,volume:volume,vixRead:vixRead,earningsRead:earningsRead,
  ingestBars:ingestBars,ingestVix:ingestVix,ingestEarnings:ingestEarnings};
if(typeof module!=='undefined'&&module.exports)module.exports=API;else root.TIER1=API;
})(typeof window!=='undefined'?window:this);
