/* Amalgam ledger. The single source of truth: every number the app shows is one row here.
   Row: id, value, as_of (YYYY-MM-DD), source, license, max_age_days. Freshness is worked out when read.
   Pure functions plus a tiny store. No network, no DOM. */
(function(root){
'use strict';
var KEY='am_ledger_v1';

function dayDiff(a,b){
  return Math.round((Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/864e5);
}
function validDate(s){
  return typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(Date.parse(s+'T00:00:00Z'))
    &&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
}
function makeRow(o){
  var need=['id','value','as_of','source','license','max_age_days'],i;
  for(i=0;i<need.length;i++){
    if(o[need[i]]===undefined||o[need[i]]===null||o[need[i]]==='')throw new Error('ledger row missing '+need[i]);
  }
  if(!validDate(o.as_of))throw new Error('ledger row bad as_of: '+o.as_of);
  return {id:String(o.id),value:o.value,as_of:o.as_of,source:String(o.source),
          license:String(o.license),max_age_days:+o.max_age_days};
}
/* fresh = as-of is within max_age_days of today. A future as-of counts as fresh but is never "newer than today". */
function freshness(row,today){
  var age=dayDiff(row.as_of,today);
  return {state:age<=row.max_age_days?'fresh':'stale',age_days:Math.max(age,0)};
}

function Ledger(storage){
  var rows={};
  function load(){
    try{var raw=storage&&storage.getItem(KEY);rows=raw?JSON.parse(raw):{};}catch(e){rows={};}
    if(!rows||typeof rows!=='object')rows={};
  }
  function save(){try{if(storage)storage.setItem(KEY,JSON.stringify(rows));}catch(e){}}
  load();
  return {
    put:function(row){var r=makeRow(row);rows[r.id]=r;save();return r;},
    get:function(id,today){
      var r=rows[id];if(!r)return null;
      var f=freshness(r,today);
      return {id:r.id,value:r.value,as_of:r.as_of,source:r.source,license:r.license,
              max_age_days:r.max_age_days,freshness:f.state,age_days:f.age_days};
    },
    has:function(id){return !!rows[id];},
    remove:function(id){delete rows[id];save();},
    ids:function(){return Object.keys(rows);}
  };
}

var API={KEY:KEY,dayDiff:dayDiff,validDate:validDate,makeRow:makeRow,freshness:freshness,Ledger:Ledger};
if(typeof module!=='undefined'&&module.exports)module.exports=API;else root.LEDGER=API;
})(typeof window!=='undefined'?window:this);
