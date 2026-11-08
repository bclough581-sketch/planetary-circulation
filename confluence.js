/* Amalgam confluence typing. Pure functions, no network, no DOM.
   Overlap in time is NOT a link. Each pair is typed by tags only:
   shared-node  : both touch the same chokepoint/commodity tag (real compounding candidate)
   degraded     : one side drains a capacity the other needs (response weakened)
   coincidence  : neither (overlap in time only; no causal claim)
   The tag rules are fixed here, before any outcome is looked at. */
(function(root){
'use strict';
var MIN_N=8; // below this, no almanac claim is made

function inter(a,b){a=a||[];b=b||[];return a.filter(function(x){return b.indexOf(x)>=0;});}

function classify(ev,cf){
  var shared=inter(ev.nodes,cf.nodes);
  if(shared.length)return {type:'shared-node',via:shared};
  var hit=inter(cf.drains,ev.needs);
  if(hit.length)return {type:'degraded',via:hit};
  return {type:'coincidence',via:[]};
}

// every active conflict (level>=1) against one event, strongest link first
function overlaps(ev,conflicts){
  var rank={'shared-node':0,'degraded':1,'coincidence':2};
  return (conflicts||[]).filter(function(c){return c.level>=1;}).map(function(c){
    var r=classify(ev,c);return {conflict:c,type:r.type,via:r.via};
  }).sort(function(a,b){return rank[a.type]-rank[b.type]||b.conflict.level-a.conflict.level;});
}

// history: [{event:'id', conflict:'id', outcome:true|false}]. Counts only same-pair cases.
function almanac(history,evId,cfId){
  var h=(history||[]).filter(function(x){return x.event===evId&&x.conflict===cfId;});
  var n=h.length,k=h.filter(function(x){return x.outcome;}).length;
  if(n<MIN_N)return {n:n,k:k,ok:false,line:'Only '+n+' past case'+(n===1?'':'s')+' on record (need '+MIN_N+'). No history claim made.'};
  return {n:n,k:k,ok:true,line:'When these converged before, the outcome followed '+k+' of '+n+' times. Small samples mislead; this is not a forecast.'};
}

var api={MIN_N:MIN_N,classify:classify,overlaps:overlaps,almanac:almanac};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Confluence=api;
})(typeof self!=='undefined'?self:this);
