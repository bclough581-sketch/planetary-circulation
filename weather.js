/* Amalgam weather. NWS (api.weather.gov) alerts and forecast -> ledger rows. Context only, never a signal.
   Rules (weather addendum, approved 2026-11-23): NWS fields used as published; only Warning-level alerts rated
   Severe or Extreme in a tracked region; a flag shows only on a pick in a sensitive sector. No GO / NO-GO, no buy/sell words.
   Pure parsing functions plus one fetch loader that takes fetch as a parameter. The location is only used to build the NWS URL;
   coordinates are never put in a ledger row. */
(function(root){
'use strict';
var L=(typeof require!=='undefined'&&typeof module!=='undefined')?require('./ledger.js'):root.LEDGER;
var SRC='NWS api.weather.gov',LIC='US government work, public domain (NWS)',MAXAGE=1;

/* Tracked regions: NWS state codes. */
var REGIONS={
  gulf:{label:'Gulf coast',states:['TX','LA','MS','AL']},
  midwest:{label:'Midwest crop belt',states:['IA','IL','IN','MN','NE','KS','MO','SD','ND','OH']},
  northeast:{label:'Northeast',states:['NY','PA','NJ','MA','CT','ME','NH','VT','RI']}
};

/* Event names exactly as NWS publishes them. "Hard Freeze Warning" and "Excessive Heat Warning" no longer exist:
   NWS now issues Freeze Warning and Extreme Heat Warning. Storm Surge and Ice Storm added as hurricane / winter-storm companions. */
var EVENTS=['Hurricane Warning','Tropical Storm Warning','Storm Surge Warning','Freeze Warning','Extreme Heat Warning',
  'Winter Storm Warning','Ice Storm Warning','Blizzard Warning','Extreme Cold Warning','Red Flag Warning'];
var SEVERITIES=['Severe','Extreme'];

/* Approved sector map. tickers = example tickers; regions = where to look; events = which warnings count. */
var SECTORS={
  natgas:{label:'Natural gas',regions:['northeast','midwest'],events:['Extreme Cold Warning','Winter Storm Warning','Blizzard Warning','Ice Storm Warning'],tickers:['UNG','EQT','EXE']},
  power:{label:'Power utilities',regions:['local','northeast'],events:['Extreme Heat Warning','Extreme Cold Warning','Winter Storm Warning','Ice Storm Warning'],tickers:['XLU','VST','NRG']},
  grains:{label:'Grains',regions:['midwest'],events:['Freeze Warning','Extreme Heat Warning'],tickers:['CORN','WEAT','SOYB','DBA','MOO']},
  gulf:{label:'Gulf energy',regions:['gulf'],events:['Hurricane Warning','Tropical Storm Warning','Storm Surge Warning'],tickers:['XLE','XOP','VLO','MPC','PSX']}
};

function r4(x){return Math.round(+x*1e4)/1e4;}
function features(json){return json&&Array.isArray(json.features)?json.features:[];}

/* All fields kept as published. */
function parseAlerts(json){
  return features(json).map(function(f){
    var p=(f&&f.properties)||{};
    return {event:p.event||'',severity:p.severity||'',status:p.status||'',messageType:p.messageType||'',
      headline:p.headline||'',area:p.areaDesc||'',expires:p.expires||p.ends||''};
  });
}
/* Warning-level (event name ends in Warning), in scope, Severe or Extreme, an actual alert, not a cancellation. */
function keepWarnings(list){
  return (list||[]).filter(function(a){
    return EVENTS.indexOf(a.event)>=0&&SEVERITIES.indexOf(a.severity)>=0
      &&(!a.status||a.status==='Actual')&&a.messageType!=='Cancel';
  });
}
/* Watches and Advisories etc. stay out of the warnings list but are kept for the drill-down. */
function others(list){
  var keep=keepWarnings(list);
  return (list||[]).filter(function(a){return keep.indexOf(a)<0;});
}
function alertRow(regionId,list,asof){
  var w=keepWarnings(list),o=others(list);
  return {id:'WX.'+regionId+'.alerts',value:{count:w.length,
    warnings:w.map(function(a){return {event:a.event,severity:a.severity,area:a.area,expires:a.expires};}),
    other_count:o.length},as_of:asof,source:SRC,license:LIC,max_age_days:MAXAGE};
}
/* forecast json from the NWS forecast URL; place from the NWS /points response (city, state only). */
function parseForecast(json,place){
  var ps=json&&json.properties&&json.properties.periods;
  if(!Array.isArray(ps)||!ps.length)return null;
  var p=ps[0];
  return {place:place||'',name:p.name||'',temp:p.temperature,unit:p.temperatureUnit||'F',
    short:p.shortForecast||'',isDaytime:!!p.isDaytime};
}
function forecastRow(fc,asof){
  if(!fc)return null;
  return {id:'WX.local.forecast',value:fc,as_of:asof,source:SRC,license:LIC,max_age_days:MAXAGE};
}

function tickerSector(sym){
  var id,s=String(sym||'').toUpperCase();
  for(id in SECTORS)if(SECTORS[id].tickers.indexOf(s)>=0)return id;
  return null;
}
/* A flag exists only when the pick's sector has a matching in-scope warning in one of its regions.
   Wording states the condition and hands the call back. No direction, no buy/sell. */
function flagFor(sym,ledger,today){
  var sid=tickerSector(sym);if(!sid)return null;
  var sec=SECTORS[sid],hits=[],i,j,row,v;
  for(i=0;i<sec.regions.length;i++){
    row=ledger.get('WX.'+sec.regions[i]+'.alerts',today);
    if(!row)continue;
    v=row.value&&row.value.warnings||[];
    for(j=0;j<v.length;j++)if(sec.events.indexOf(v[j].event)>=0)
      hits.push({region:sec.regions[i],event:v[j].event,severity:v[j].severity,expires:v[j].expires,freshness:row.freshness});
  }
  if(!hits.length)return null;
  var h=hits[0],name=h.region==='local'?'your area':(REGIONS[h.region]||{label:h.region}).label;
  return {sector:sid,sector_label:sec.label,hits:hits,stale:hits.every(function(x){return x.freshness==='stale';}),
    say:'NWS has a '+h.event+' out for '+name+'. '+String(sym).toUpperCase()+' is in the '+sec.label.toLowerCase()+' group. Your call. Write where you would be wrong.'};
}

function alertsUrl(regionId,loc){
  if(regionId==='local')return 'https://api.weather.gov/alerts/active?point='+r4(loc.lat)+','+r4(loc.lon);
  return 'https://api.weather.gov/alerts/active?area='+REGIONS[regionId].states.join(',');
}
function getJson(fetchFn,url){
  return fetchFn(url,{headers:{'Accept':'application/geo+json'}}).then(function(r){
    if(!r||!r.ok)throw new Error('NWS '+(r&&r.status));
    return r.json();
  });
}
/* Pull everything. Each piece is separate: one failure leaves that row as it was (it will show stale), the rest still load.
   loc is optional {lat,lon}; without it only the three regions load. Returns {ok:[ids], failed:[ids]}. */
function load(fetchFn,ledger,today,loc){
  var ok=[],failed=[],jobs=[];
  Object.keys(REGIONS).forEach(function(rid){
    jobs.push(getJson(fetchFn,alertsUrl(rid)).then(function(j){ledger.put(alertRow(rid,parseAlerts(j),today));ok.push('WX.'+rid+'.alerts');})
      .catch(function(){failed.push('WX.'+rid+'.alerts');}));
  });
  if(loc&&isFinite(loc.lat)&&isFinite(loc.lon)){
    jobs.push(getJson(fetchFn,alertsUrl('local',loc)).then(function(j){ledger.put(alertRow('local',parseAlerts(j),today));ok.push('WX.local.alerts');})
      .catch(function(){failed.push('WX.local.alerts');}));
    jobs.push(getJson(fetchFn,'https://api.weather.gov/points/'+r4(loc.lat)+','+r4(loc.lon)).then(function(pt){
      var pr=pt&&pt.properties||{},rl=pr.relativeLocation&&pr.relativeLocation.properties||{};
      var place=rl.city?(rl.city+(rl.state?', '+rl.state:'')):'';
      if(!pr.forecast)throw new Error('no forecast url');
      return getJson(fetchFn,pr.forecast).then(function(fj){
        var row=forecastRow(parseForecast(fj,place),today);if(!row)throw new Error('empty forecast');
        ledger.put(row);ok.push('WX.local.forecast');
      });
    }).catch(function(){failed.push('WX.local.forecast');}));
  }
  return Promise.all(jobs).then(function(){return {ok:ok,failed:failed};});
}

var API={REGIONS:REGIONS,EVENTS:EVENTS,SEVERITIES:SEVERITIES,SECTORS:SECTORS,parseAlerts:parseAlerts,keepWarnings:keepWarnings,
  others:others,alertRow:alertRow,parseForecast:parseForecast,forecastRow:forecastRow,tickerSector:tickerSector,flagFor:flagFor,
  alertsUrl:alertsUrl,load:load};
if(typeof module!=='undefined'&&module.exports)module.exports=API;else root.WEATHER=API;
})(typeof window!=='undefined'?window:this);
