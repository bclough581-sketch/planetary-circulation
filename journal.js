/* Amalgam journal logic. Pure functions, no network, no DOM.
   An entry is a record of what the user decided and why, in their own words.
   Nothing here scores a stock or predicts anything. It describes the user's own habits. */
(function(root){
'use strict';

var KEY='amalgam.journal.v1';
var GOAL=20; // entries the review asks for before it says anything about a pattern
var GATES=[['g1','G1 Range position'],['g2','G2 RSI 14'],['g3','G3 Volume on an up day'],['g4','G4 Catalyst'],['g5','G5 Overlap']];
var ANS={met:'Met',notmet:'Not met',unchecked:'Not checked'};
var TYPES={plan:'Plan',live:'Live',retro:'Retrospective'};

function clip(s,max){return String(s==null?'':s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').slice(0,max);}
function normTicker(t){return String(t==null?'':t).toUpperCase().replace(/[^A-Z0-9.\-]/g,'').slice(0,10);}
function num(x){if(x===''||x==null)return null;var n=parseFloat(x);return isFinite(n)&&n>0?n:null;}
function pick(v,allowed,dflt){return Object.prototype.hasOwnProperty.call(allowed,v)?v:dflt;}
function newId(){return Date.now().toString(36)+Math.floor(Math.random()*1679616).toString(36);}
function safeId(x){var t=String(x==null?'':x);return /^[A-Za-z0-9_\-]{1,40}$/.test(t)&&t!=='__proto__'&&t!=='constructor'&&t!=='prototype'?t:'';}

// Sanitize anything that comes from a form or from a pasted backup.
function normalize(e){
  e=e||{};
  var g={},i,k;
  for(i=0;i<GATES.length;i++){k=GATES[i][0];g[k]=pick(e.gates&&e.gates[k],ANS,'unchecked');}
  var status=e.status==='closed'?'closed':'open';
  var fl=e.followed==='yes'||e.followed==='no'||e.followed==='unknown'?e.followed:'';
  return {
    id:safeId(e.id)||newId(),
    created:clip(e.created,40)||new Date().toISOString(),
    updated:clip(e.updated,40)||new Date().toISOString(),
    ticker:normTicker(e.ticker),
    type:pick(e.type,TYPES,'plan'),
    status:status,
    reason:clip(e.reason,600),
    evidence:clip(e.evidence,600),
    entryRule:clip(e.entryRule,600),
    size:clip(e.size,120),
    exitRule:clip(e.exitRule,600),
    gates:g,
    entryPrice:num(e.entryPrice),
    exitPrice:status==='closed'?num(e.exitPrice):null,
    whyExited:status==='closed'?clip(e.whyExited,600):'',
    followed:status==='closed'?fl:'',
    lesson:status==='closed'?clip(e.lesson,600):''
  };
}

function resultPct(e){
  if(!e||e.status!=='closed'||!e.entryPrice||!e.exitPrice)return null;
  return (e.exitPrice/e.entryPrice-1)*100;
}

// Missing pieces that would make the record less useful later. Advisory only; never blocks a save.
function gaps(e){
  var out=[];
  if(!e.ticker)out.push('ticker');
  if(!e.reason)out.push('why you entered');
  if(!e.exitRule)out.push('exit rule');
  if(e.status==='closed'){
    if(!e.followed)out.push('whether you followed your rule');
    if(!e.whyExited)out.push('why you actually exited');
  }
  return out;
}

function stats(list){
  var total=list.length,open=0,closed=0,yes=0,no=0,unk=0,g123=0,anyUnchecked=0,
      priced=[],byYes=[],byNo=[],lessons=[],i,e,r;
  for(i=0;i<list.length;i++){
    e=list[i];
    if(e.status==='closed')closed++;else open++;
    if(e.gates.g1!=='unchecked'&&e.gates.g2!=='unchecked'&&e.gates.g3!=='unchecked')g123++;
    var un=0,k;for(k in e.gates)if(e.gates[k]==='unchecked')un++;
    if(un>0)anyUnchecked++;
    if(e.status==='closed'){
      if(e.followed==='yes')yes++;else if(e.followed==='no')no++;else if(e.followed==='unknown')unk++;
      r=resultPct(e);
      if(r!==null){priced.push(r);if(e.followed==='yes')byYes.push(r);else if(e.followed==='no')byNo.push(r);}
      if(e.lesson)lessons.push({t:e.ticker,s:e.lesson,u:e.updated});
    }
  }
  function mean(a){if(!a.length)return null;var s=0,j;for(j=0;j<a.length;j++)s+=a[j];return s/a.length;}
  lessons.sort(function(a,b){return a.u<b.u?1:-1;});
  var answered=yes+no;
  return {
    total:total,open:open,closed:closed,
    followed:yes,notFollowed:no,unknown:unk,
    followRate:answered?yes/answered:null,
    g123Answered:g123,
    entriesWithUnchecked:anyUnchecked,
    pricedN:priced.length,meanPricedPct:mean(priced),
    followedPricedN:byYes.length,meanFollowedPct:mean(byYes),
    brokePricedN:byNo.length,meanBrokePct:mean(byNo),
    goal:GOAL,goalMet:total>=GOAL,missingPrices:closed-priced.length,missingFollowed:closed-yes-no-unk,
    lessons:lessons.slice(0,8)
  };
}

// CSV safe for spreadsheets: quote everything, and defuse leading = + - @ so a cell cannot run as a formula.
function cell(v){
  var s=v==null?'':String(v);
  if(/^[\s\uFEFF]*[=+\-@]/.test(s)||/^[\t\r]/.test(s))s="'"+s;
  return '"'+s.replace(/"/g,'""')+'"';
}
var COLS=['id','created','updated','ticker','type','status','reason','evidence','entryRule','size','entryPrice','exitRule',
          'g1','g2','g3','g4','g5','exitPrice','resultPct','whyExited','followed','lesson'];
function toCsv(list){
  var rows=[COLS.map(cell).join(',')],i,e,r;
  for(i=0;i<list.length;i++){
    e=list[i];r=resultPct(e);
    rows.push([e.id,e.created,e.updated,e.ticker,TYPES[e.type],e.status,e.reason,e.evidence,e.entryRule,e.size,
      e.entryPrice==null?'':e.entryPrice,e.exitRule,e.gates.g1,e.gates.g2,e.gates.g3,e.gates.g4,e.gates.g5,
      e.exitPrice==null?'':e.exitPrice,r==null?'':r.toFixed(2),e.whyExited,e.followed,e.lesson].map(cell).join(','));
  }
  return rows.join('\r\n')+'\r\n';
}

function toBackup(list){return JSON.stringify({app:'amalgam-journal',version:1,exported:new Date().toISOString(),entries:list},null,1);}

var TEXT_FIELDS=['reason','evidence','entryRule','exitRule','whyExited','lesson'];
function parseBackup(text){
  var o;
  try{o=JSON.parse(text);}catch(err){return {ok:false,error:'That is not valid backup text.'};}
  if(!o||o.app!=='amalgam-journal'||!Array.isArray(o.entries))return {ok:false,error:'That is not an Amalgam journal backup.'};
  if(o.version!==1)return {ok:false,error:'This backup is from a different version ('+String(o.version).slice(0,12)+'). Nothing was restored.'};
  if(o.entries.length>2000)return {ok:false,error:'Backup is too large.'};
  var out=[],i,j,clipped=0,renamed=0,raw;
  for(i=0;i<o.entries.length;i++){
    raw=o.entries[i]||{};
    for(j=0;j<TEXT_FIELDS.length;j++)if(String(raw[TEXT_FIELDS[j]]==null?'':raw[TEXT_FIELDS[j]]).length>600){clipped++;break;}
    if(!safeId(raw.id))renamed++;
    out.push(normalize(raw));
  }
  return {ok:true,entries:out,clipped:clipped,renamed:renamed};
}

// Merge by id; the more recently updated copy replaces the other. Uses a Map so odd ids cannot collide with object internals.
function merge(base,incoming){
  var m=new Map(),i,e;
  for(i=0;i<base.length;i++)m.set(base[i].id,base[i]);
  for(i=0;i<incoming.length;i++){
    e=incoming[i];
    if(!m.has(e.id)||m.get(e.id).updated<e.updated)m.set(e.id,e);
  }
  var out=Array.from(m.values());
  out.sort(function(a,b){return a.created<b.created?1:-1;});
  return out;
}

// Read the stored text without ever turning a read failure into an empty journal.
// state: 'empty' (nothing stored), 'ok', or 'failed' (present but unreadable; raw is kept for recovery).
function readStore(text){
  if(text==null||text==='')return {state:'empty',list:[],raw:''};
  var o;
  try{o=JSON.parse(text);}catch(err){return {state:'failed',list:[],raw:String(text)};}
  if(!Array.isArray(o))return {state:'failed',list:[],raw:String(text)};
  return {state:'ok',list:o.map(normalize),raw:''};
}

var API={KEY:KEY,GOAL:GOAL,GATES:GATES,ANS:ANS,TYPES:TYPES,normalize:normalize,resultPct:resultPct,gaps:gaps,stats:stats,
         toCsv:toCsv,toBackup:toBackup,parseBackup:parseBackup,merge:merge,newId:newId,safeId:safeId,readStore:readStore};
if(typeof module!=='undefined'&&module.exports)module.exports=API;else root.JOURNAL=API;
})(typeof window!=='undefined'?window:this);
