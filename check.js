/* Amalgam CHECK view. Runs entirely in the browser with the user's own Twelve Data key.
   Nothing is sent to us. Describes rule measurements; it is not advice. */
(function(){
'use strict';
var G=window.GATES,$=function(i){return document.getElementById(i)};
var LS={get:function(k,d){try{var v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}},
        set:function(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function today(){var d=new Date();return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2)}
function sleep(ms){return new Promise(function(r){setTimeout(r,ms)})}
function tk(s){return String(s||'').toUpperCase().replace(/[^A-Z0-9.\-]/g,'').slice(0,10)}

/* ---------- data ---------- */
var last=0;
async function throttle(){var t=Math.max(Date.now(),last+7600);last=t;var w=t-Date.now();if(w>0)await sleep(w)}
async function getBars(t,force){
  var ck='am_s_'+t,c=LS.get(ck,null);
  if(!force&&c&&c.day===today()&&c.bars&&c.bars.length)return c.bars;
  var key=LS.get('am_key','');if(!key)throw new Error('Add your Twelve Data key first.');
  await throttle();
  var r=await fetch('https://api.twelvedata.com/time_series?symbol='+encodeURIComponent(t)+'&interval=1day&outputsize=200&order=ASC&apikey='+encodeURIComponent(key));
  var j=await r.json();
  if(j.status==='error'||!j.values)throw new Error(j.message||('No data for '+t));
  var bars=j.values.map(function(x){return{d:x.datetime.slice(0,10),o:+x.open,h:+x.high,l:+x.low,c:+x.close,v:+x.volume||0}});
  bars.sort(function(a,b){return a.d<b.d?-1:1});
  LS.set(ck,{day:today(),bars:bars});
  return bars;
}
async function getBook(){
  var held=LS.get('am_book',[]),book={},i;
  for(i=0;i<held.length;i++){try{book[held[i]]=await getBars(held[i])}catch(e){}}
  return book;
}

/* ---------- gate text ---------- */
var STAT={pass:'MEETS RULE',flag:'FLAG',fail:'FAILS RULE',na:'MANUAL'};
function pct(x){return(x*100).toFixed(0)+'%'}
function gateInfo(ev,cat){
  var T=G.T,g1=ev.g1,g2=ev.g2,g3=ev.g3,g5=ev.g5,c=cat||null;
  return [
   {id:'G1',name:'RANGE POSITION',st:g1?g1.status:'na',
    val:g1?'at '+pct(g1.pos)+' of 6-mo range':'not enough data',
    what:'Where today\'s close sits between the lowest low and highest high of the last ~6 months (126 trading days). 0% is the bottom, 100% is the top.',
    nums:g1?['Close '+g1.close.toFixed(2),'6-mo high '+g1.hi.toFixed(2),'6-mo low '+g1.lo.toFixed(2),'Position = (close - low) / (high - low) = '+pct(g1.pos)]:[],
    rule:'Fails in the top '+pct(1-T.rangeFail)+' of the range (position '+pct(T.rangeFail)+' or higher). Flag from '+pct(T.rangeWarn)+'. Your written framework also fails a name that has already run more than 2 legs; this view does not count legs yet.',
    ho:'Tested only as part of the G1+G2+G3 stack on 2018-2021 hold-out data. The stack FAILED (see SCOREBOARD).'},
   {id:'G2',name:'RSI 14',st:g2?g2.status:'na',
    val:g2?'RSI '+g2.value.toFixed(0):'not enough data',
    what:'Wilder\'s 14-day Relative Strength Index. It compares the average size of up days to down days over the last 14 sessions, smoothed. Above 70 is the usual "stretched" reading.',
    nums:g2?['RSI(14) = '+g2.value.toFixed(1),'Formula: 100 - 100 / (1 + avg gain / avg loss), Wilder smoothing']:[],
    rule:'Meets the rule from '+T.rsiPassLo+' to '+T.rsiPassHi+'. Flag between '+T.rsiPassHi+' and '+T.rsiFail+', and below '+T.rsiPassLo+'. Fails above '+T.rsiFail+'.',
    ho:'Tested only as part of the G1+G2+G3 stack. The stack FAILED.'},
   {id:'G3',name:'VOLUME ON AN UP DAY',st:g3?g3.status:'na',
    val:g3?(g3.hitDay?(g3.hitDay.daysAgo===0?'today ':g3.hitDay.daysAgo+'d ago ')+g3.hitDay.ratio.toFixed(1)+'x volume':'no spike in last '+T.volLook+'d'):'not enough data',
    what:'Whether the stock closed up on volume at least '+T.volMult+' times its average of the prior '+T.volLen+' sessions. It looks at the last '+T.volLook+' sessions; today counts as MEETS, earlier days count as FLAG.',
    nums:g3?['Latest session '+g3.latest.d+': '+(g3.latest.up?'up':'down')+', volume '+g3.latest.ratio.toFixed(2)+'x the '+T.volLen+'-day average']:[],
    rule:'Meets the rule when the latest session closed up with volume >= '+T.volMult+'x the '+T.volLen+'-day average.',
    ho:'On its own, G3 showed a small lift in how often trades hit (1.033, range 1.005 to 1.067) but no money edge after costs (-0.015, range -0.034 to +0.003). Treat it as a lead, not a result.'},
   {id:'NOTE',note:true,lab:{pass:'YES',fail:'NO',na:'YOUR CALL'},name:'CATALYST',st:c==='yes'?'pass':c==='no'?'fail':'na',
    val:c==='yes'?'you marked: yes':c==='no'?'you marked: no':'you decide',
    what:'Whether there is a dated, checkable reason for attention: earnings, an FDA date, a contract, an index change. This one is a human judgment, so the app does not score it.',
    nums:['Check filings: sec.gov EDGAR company search'],
    rule:'A note, not part of the verdict. Mark it yourself below.',
    ho:'Not part of the tested stack.'},
   {id:'NOTE',note:true,lab:{pass:'LOW',flag:'MODERATE',fail:'HIGH',na:'ADD HOLDINGS'},name:'OVERLAP WITH YOUR BOOK',st:g5?g5.status:'na',
    val:g5?'highest '+g5.top.r.toFixed(2)+' vs '+g5.top.t:'add holdings to compute',
    what:'How closely this stock\'s daily moves have tracked each stock you already hold, over the last '+T.corrDays+' sessions (Pearson correlation). High means you would mostly be doubling an existing bet.',
    nums:g5?g5.rows.slice(0,6).map(function(x){return x.t+': '+x.r.toFixed(2)+' ('+x.n+' shared days)'}):[],
    rule:'High at '+T.corrFail.toFixed(2)+' or higher against any holding, moderate from '+T.corrFlag.toFixed(2)+'. This is a portfolio note, not a measure of the stock, so it never changes the verdict above.',
    ho:'Not part of the tested stack, and not counted in any list or in the scoreboard.'}
  ];
}
function headline(ev){
  if(ev.meets)return{cls:'pass',t:'Meets all stated rules today (G1, G2, G3). That describes the rules, not the stock\'s future.'};
  if(ev.near)return{cls:'flag',t:'One rule away: '+ev.failed[0]+' is outside its range.'};
  return{cls:'fail',t:ev.failed.length+' rules outside range: '+ev.failed.join(', ')+'.'};
}

/* ---------- render a single check ---------- */
var open=null;
function renderCheck(t,bars,ev){
  var cat=LS.get('am_cat',{})[t]||null,gs=gateInfo(ev,cat),h=headline(ev);
  var html='<div class="ck-head"><b>'+esc(t)+'</b><span>'+ev.close.toFixed(2)+' · close '+ev.asof+'</span></div>'+
   '<div class="ck-line '+h.cls+'">'+esc(h.t)+'</div><div class="ck-gates">';
  gs.forEach(function(g,i){
    if(i===3)html+='<div class="ck-sep">NOTES · not part of the verdict</div>';
    html+='<button type="button" class="ck-g '+g.st+'" data-i="'+i+'" aria-expanded="false"><i>'+g.id+'</i><u>'+g.name+'</u><em>'+esc(g.val)+'</em><s>'+STAT[g.st]+'</s></button>'+
      '<div class="ck-d" id="ckd'+i+'" hidden></div>';
  });
  html+='</div><div class="ck-cat">G4 catalyst (your call): <button data-c="yes" class="'+(cat==='yes'?'on':'')+'">YES</button><button data-c="no" class="'+(cat==='no'?'on':'')+'">NO</button><button data-c="">CLEAR</button> <a target="_blank" rel="noopener" href="https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK='+encodeURIComponent(t)+'&type=8-K">SEC filings</a></div>'+
   '<div class="ck-act"><button id="ckadd" type="button">'+(LS.get('am_watch',[]).indexOf(t)>=0?'ON WATCHLIST':'+ WATCHLIST')+'</button></div>';
  var box=$('ckres');box.innerHTML=html;box.hidden=false;
  box.querySelectorAll('.ck-g').forEach(function(b){b.onclick=function(){
    var i=+b.dataset.i,d=$('ckd'+i),o=!d.hidden;
    box.querySelectorAll('.ck-d').forEach(function(x){x.hidden=true});box.querySelectorAll('.ck-g').forEach(function(x){x.setAttribute('aria-expanded','false')});
    if(!o){var g=gs[i];d.innerHTML='<p><b>What it measures.</b> '+esc(g.what)+'</p>'+(g.nums.length?'<p><b>Your numbers.</b><br>'+g.nums.map(esc).join('<br>')+'</p>':'')+'<p><b>The rule.</b> '+esc(g.rule)+'</p><p><b>How the rule tested.</b> '+esc(g.ho)+'</p>';d.hidden=false;b.setAttribute('aria-expanded','true')}
  }});
  box.querySelectorAll('.ck-cat button').forEach(function(b){b.onclick=function(){var m=LS.get('am_cat',{});if(b.dataset.c)m[t]=b.dataset.c;else delete m[t];LS.set('am_cat',m);renderCheck(t,bars,ev)}});
  $('ckadd').onclick=function(){var w=LS.get('am_watch',[]);if(w.indexOf(t)<0){w.push(t);LS.set('am_watch',w);renderLists()}renderCheck(t,bars,ev)};
}
async function runCheck(t){
  t=tk(t);if(!t)return;
  var st=$('ckst');st.textContent='Checking '+t+'…';
  try{
    var bars=await getBars(t),book=await getBook();delete book[t];
    var ev=G.evaluate(bars,book);
    st.textContent='';renderCheck(t,bars,ev);
  }catch(e){st.textContent=e.message;$('ckres').hidden=true}
}

/* ---------- watchlist, book, daily list ---------- */
function chips(id,arr,key){
  var el=$(id);el.innerHTML=arr.map(function(x){return'<span class="ck-chip"><a href="#" data-t="'+esc(x)+'">'+esc(x)+'</a><b data-x="'+esc(x)+'" aria-label="Remove '+esc(x)+'">×</b></span>'}).join('')||'<span class="ck-none">none yet</span>';
  el.querySelectorAll('b').forEach(function(b){b.onclick=function(){var a=LS.get(key,[]).filter(function(y){return y!==b.dataset.x});LS.set(key,a);renderLists()}});
  if(key==='am_watch')el.querySelectorAll('a').forEach(function(a){a.onclick=function(e){e.preventDefault();$('ckq').value=a.dataset.t;runCheck(a.dataset.t)}});
}
function renderLists(){
  chips('ckwl',LS.get('am_watch',[]),'am_watch');chips('ckbk',LS.get('am_book',[]),'am_book');
  var d=LS.get('am_daily',null),el=$('ckdaily');
  if(!d||d.day!==today()){el.innerHTML='<p class="ck-none">Run the scan to build today\'s list.</p>';return}
  function sec(title,arr,sub){return'<h4>'+title+' <small>'+arr.length+'</small></h4>'+(arr.length?arr.map(function(r){return'<div class="ck-row"><a href="#" data-t="'+esc(r.t)+'">'+esc(r.t)+'</a><span>'+r.close.toFixed(2)+'</span><em>'+esc(r.note)+'</em></div>'}).join(''):'<p class="ck-none">'+sub+'</p>')}
  var m=d.rows.filter(function(r){return r.k==='meets'}),n=d.rows.filter(function(r){return r.k==='near'}),o=d.rows.filter(function(r){return r.k==='other'});
  el.innerHTML='<p class="ck-asof">Scanned '+d.day+' · '+d.rows.length+' names'+(d.errs&&d.errs.length?' · could not load: '+esc(d.errs.join(', ')):'')+'</p>'+
    sec('MEET ALL RULES',m,'None of your watchlist meets every rule today.')+sec('ONE RULE AWAY',n,'None.')+
    (o.length?'<details><summary>OTHERS ('+o.length+')</summary>'+o.map(function(r){return'<div class="ck-row"><a href="#" data-t="'+esc(r.t)+'">'+esc(r.t)+'</a><span>'+r.close.toFixed(2)+'</span><em>'+esc(r.note)+'</em></div>'}).join('')+'</details>':'');
  el.querySelectorAll('a').forEach(function(a){a.onclick=function(e){e.preventDefault();$('ckq').value=a.dataset.t;runCheck(a.dataset.t);window.scrollTo({top:0,behavior:'smooth'})}});
}
var scanning=false;
async function scan(){
  if(scanning)return;var w=LS.get('am_watch',[]);
  if(!w.length){$('ckscanst').textContent='Add tickers to the watchlist first.';return}
  scanning=true;var rows=[],errs=[],book,i;
  try{
    $('ckscanst').textContent='Loading your book…';book=await getBook();
    for(i=0;i<w.length;i++){
      $('ckscanst').textContent='Scanning '+(i+1)+' of '+w.length+' ('+w[i]+')… free keys allow 8 calls a minute, so this takes a bit.';
      try{
        var bars=await getBars(w[i]),b2=Object.assign({},book);delete b2[w[i]];
        var ev=G.evaluate(bars,b2);
        rows.push({t:w[i],close:ev.close,asof:ev.asof,k:ev.meets?'meets':ev.near?'near':'other',note:ev.meets?'G1 G2 G3 all met':ev.failed.join(', ')+' outside range'});
      }catch(e){errs.push(w[i])}
    }
    LS.set('am_daily',{day:today(),rows:rows,errs:errs});
    // forward log: every scanned name, with its group, so the scoreboard has controls
    var log=LS.get('am_log',[]);
    rows.forEach(function(r){if(!log.some(function(x){return x.t===r.t&&x.d===r.asof}))log.push({t:r.t,d:r.asof,p:r.close,k:r.k})});
    LS.set('am_log',log.slice(-600));
    $('ckscanst').textContent='Done.';renderLists();renderScore();
  }finally{scanning=false}
}

/* ---------- scoreboard ---------- */
function retFrom(bars,date,n){ // return from the close on `date` to n sessions later (or latest)
  var i=-1,j;for(j=0;j<bars.length;j++)if(bars[j].d>=date){i=j;break}
  if(i<0||bars[i].d!==date)return null;
  var e=Math.min(i+n,bars.length-1);if(e<=i)return null;
  return{r:bars[e].c/bars[i].c-1,days:e-i,full:i+n<=bars.length-1};
}
function renderScore(){
  var log=LS.get('am_log',[]),sc=LS.get('am_score',null),el=$('ckscore');
  var g={meets:[],near:[],other:[]};
  if(sc)sc.rows.forEach(function(r){g[r.k].push(r)});
  function avg(a){return a.length?a.reduce(function(s,x){return s+x.ex},0)/a.length:null}
  function beat(a){return a.length?a.filter(function(x){return x.ex>0}).length/a.length:null}
  function line(name,a){return'<tr><td>'+name+'</td><td>'+a.length+'</td><td>'+(a.length?(avg(a)*100).toFixed(2)+'%':'-')+'</td><td>'+(a.length?pct(beat(a)):'-')+'</td></tr>'}
  el.innerHTML='<p>Every scan is logged on this device: the ticker, the close that day, and whether it met all rules, was one away, or neither. After at least 5 sessions the logged names are compared with SPY over the same window.</p>'+
   '<p class="ck-asof">'+log.length+' names logged'+(sc?' · scored '+sc.day:'')+'</p>'+
   '<button id="ckscorebtn" type="button">SCORE THE LOG</button> <span id="ckscst" class="ck-st"></span>'+
   '<div class="tablewrap"><table class="ck-t"><thead><tr><th>GROUP</th><th>NAMES</th><th>AVG VS SPY</th><th>BEAT SPY</th></tr></thead><tbody>'+
    line('Meets all rules',g.meets)+line('One rule away',g.near)+line('Neither',g.other)+'</tbody></table></div>'+
   '<p class="ck-warn">'+(sc&&sc.rows.length<100?'Under 100 scored names is too few to conclude anything. ':'')+'If "Meets all rules" does not beat "Neither" over time, the rules add nothing, and this page will show that.</p>'+
   '<details class="ck-ho"><summary>THE ORIGINAL HOLD-OUT TEST</summary><p>The G1+G2+G3 stack was tested once on 2018-2021 data that had not been used to build it, with the pass bar written down in advance. <b>Result: FAIL.</b> Hit-rate ratio 1.036 (range 0.979 to 1.085), money difference -0.028 (range -0.056 to +0.001). The rules did slightly worse than matched random stock-days after costs. Past tests do not predict future results, and nothing here says these rules find winners.</p></details>';
  $('ckscorebtn').onclick=scoreLog;
}
async function scoreLog(){
  var st=$('ckscst'),log=LS.get('am_log',[]),old=log.filter(function(x){return x.d<today()});
  if(!old.length){st.textContent='Nothing old enough yet. Scan a few days in a row.';return}
  try{
    var spy=await getBars('SPY'),by={},rows=[],ts=[],i;
    old.forEach(function(x){if(ts.indexOf(x.t)<0)ts.push(x.t)});
    for(i=0;i<ts.length;i++){st.textContent='Scoring '+(i+1)+' of '+ts.length+'…';try{by[ts[i]]=await getBars(ts[i])}catch(e){}}
    old.forEach(function(x){
      var b=by[x.t];if(!b)return;var a=retFrom(b,x.d,5),s=retFrom(spy,x.d,5);
      if(a&&s&&a.full&&s.full)rows.push({t:x.t,d:x.d,k:x.k,ex:a.r-s.r});
    });
    LS.set('am_score',{day:today(),rows:rows});st.textContent='';renderScore();
  }catch(e){st.textContent=e.message}
}

/* ---------- setup + boot ---------- */
function renderKey(){
  var k=LS.get('am_key',''),el=$('ckkey');
  el.innerHTML=k?'<span class="ck-st">Data key saved on this device.</span> <button id="ckkeyx" type="button">REMOVE</button>':
   '<p>To keep this free, the app reads prices with your own free Twelve Data key. It stays in this browser and is sent only to Twelve Data.</p><form id="ckkf"><input id="ckki" placeholder="Paste your Twelve Data API key" autocomplete="off" spellcheck="false"><button type="submit">SAVE</button></form><p class="ck-small"><a href="https://twelvedata.com/pricing" target="_blank" rel="noopener">Get a free key</a>. The free plan allows 8 calls a minute and 800 a day. Twelve Data\'s free terms may limit commercial use; this is for your own checking.</p>';
  if(k)$('ckkeyx').onclick=function(){LS.set('am_key','');renderKey()};
  else $('ckkf').onsubmit=function(e){e.preventDefault();var v=$('ckki').value.trim();if(v){LS.set('am_key',v);renderKey()}};
}
function addTo(key,inp){var v=tk($(inp).value);if(!v)return;var a=LS.get(key,[]);if(a.indexOf(v)<0&&a.length<(key==='am_book'?6:15))a.push(v);LS.set(key,a);$(inp).value='';renderLists()}
function boot(){
  if(!$('checkview'))return;
  $('ckf').onsubmit=function(e){e.preventDefault();runCheck($('ckq').value)};
  $('ckwf').onsubmit=function(e){e.preventDefault();addTo('am_watch','ckwi')};
  $('ckbf').onsubmit=function(e){e.preventDefault();addTo('am_book','ckbi')};
  $('ckscan').onclick=scan;
  renderKey();renderLists();renderScore();
  // tabs
  var tabs=document.querySelectorAll('#tabs button');
  function show(v){
    document.body.classList.toggle('tab-map',v==='map');
    tabs.forEach(function(b){b.setAttribute('aria-selected',b.dataset.v===v?'true':'false')});
    $('checkview').hidden=v!=='check';
    var m=$('mapview');if(m)m.hidden=v!=='map';
    LS.set('am_tab',v);
    if(v==='map')window.dispatchEvent(new Event('resize'));
  }
  tabs.forEach(function(b){b.onclick=function(){show(b.dataset.v)}});
  show(LS.get('am_tab','check'));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
