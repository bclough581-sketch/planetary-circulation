/* Amalgam gate measurements. Pure functions, no network, no DOM.
   Bars: array of {d:'YYYY-MM-DD', o,h,l,c,v} oldest -> newest.
   These describe what already happened. They are not signals. */
(function(root){
'use strict';
var T={ // thresholds, kept in one place so the drill-downs can print them
  rangeDays:126, rangeFail:0.85, rangeWarn:0.70,
  rsiLen:14, rsiPassLo:40, rsiPassHi:65, rsiFail:70,
  volLen:20, volMult:1.5, volLook:5,
  corrDays:60, corrFail:0.70, corrFlag:0.50
};

function rangePos(bars){
  if(bars.length<20)return null;
  var w=bars.slice(-T.rangeDays),hi=-Infinity,lo=Infinity,i;
  for(i=0;i<w.length;i++){if(w[i].h>hi)hi=w[i].h;if(w[i].l<lo)lo=w[i].l;}
  var c=w[w.length-1].c,pos=hi>lo?(c-lo)/(hi-lo):0.5;
  var st=pos>=T.rangeFail?'fail':pos>=T.rangeWarn?'flag':'pass';
  return {pos:pos,hi:hi,lo:lo,close:c,days:w.length,status:st};
}

function rsi(bars,n){
  n=n||T.rsiLen;
  if(bars.length<n+1)return null;
  var g=0,l=0,i,d;
  for(i=1;i<=n;i++){d=bars[i].c-bars[i-1].c;if(d>=0)g+=d;else l-=d;}
  g/=n;l/=n;
  for(i=n+1;i<bars.length;i++){
    d=bars[i].c-bars[i-1].c;
    g=(g*(n-1)+(d>0?d:0))/n;
    l=(l*(n-1)+(d<0?-d:0))/n;
  }
  var v=l===0?(g===0?50:100):100-100/(1+g/l);
  var st=v>T.rsiFail?'fail':v>T.rsiPassHi?'flag':v<T.rsiPassLo?'flag':'pass';
  return {value:v,status:st};
}

function volSpike(bars){
  var n=T.volLen;
  if(bars.length<n+2)return null;
  var out=null,k,i;
  for(k=0;k<T.volLook&&k<bars.length-n-1;k++){
    var idx=bars.length-1-k,s=0;
    for(i=idx-n;i<idx;i++)s+=bars[i].v;
    var avg=s/n,b=bars[idx],up=b.c>bars[idx-1].c,ratio=avg>0?b.v/avg:0;
    var hit=up&&ratio>=T.volMult;
    if(k===0)out={latest:{d:b.d,up:up,ratio:ratio,avg:avg,v:b.v},hitDay:null};
    if(hit&&!out.hitDay){out.hitDay={d:b.d,ratio:ratio,daysAgo:k};}
  }
  out.status=out.hitDay?(out.hitDay.daysAgo===0?'pass':'flag'):'fail';
  return out;
}

function returns(bars,n){
  var r=[],w=bars.slice(-(n+1)),i;
  for(i=1;i<w.length;i++)r.push({d:w[i].d,r:w[i].c/w[i-1].c-1});
  return r;
}
function pearson(a,b){
  var m=new Map(),i,x=[],y=[];
  for(i=0;i<b.length;i++)m.set(b[i].d,b[i].r);
  for(i=0;i<a.length;i++)if(m.has(a[i].d)){x.push(a[i].r);y.push(m.get(a[i].d));}
  var n=x.length;if(n<30)return null;
  var mx=0,my=0;for(i=0;i<n;i++){mx+=x[i];my+=y[i];}mx/=n;my/=n;
  var sxy=0,sxx=0,syy=0;
  for(i=0;i<n;i++){sxy+=(x[i]-mx)*(y[i]-my);sxx+=(x[i]-mx)*(x[i]-mx);syy+=(y[i]-my)*(y[i]-my);}
  if(!sxx||!syy)return null;
  return {r:sxy/Math.sqrt(sxx*syy),n:n};
}
// book: {TICKER:bars}. Returns the held name most correlated with the candidate.
function bookCorr(bars,book){
  var mine=returns(bars,T.corrDays),rows=[],t;
  for(t in book){
    var p=pearson(mine,returns(book[t],T.corrDays));
    if(p)rows.push({t:t,r:p.r,n:p.n});
  }
  if(!rows.length)return null;
  rows.sort(function(a,b){return b.r-a.r;});
  var top=rows[0];
  return {top:top,rows:rows,status:top.r>=T.corrFail?'fail':top.r>=T.corrFlag?'flag':'pass'};
}

function evaluate(bars,book,catalyst){
  var g1=rangePos(bars),g2=rsi(bars),g3=volSpike(bars),
      g5=book&&Object.keys(book).length?bookCorr(bars,book):null;
  var g4=catalyst||null; // 'yes' | 'no' | null (manual)
  var core=[g1,g2,g3],pass=0,fail=0,failed=[];
  var names=['G1 range','G2 RSI','G3 volume'];
  core.forEach(function(g,i){if(!g)return;if(g.status==='pass')pass++;else{fail++;failed.push(names[i]);}});
  var all=core.every(function(g){return g&&g.status==='pass';});
  var near=!all&&fail===1&&core.every(function(g){return g;});
  return {g1:g1,g2:g2,g3:g3,g4:g4,g5:g5,meets:all,near:near,failed:failed,
          asof:bars.length?bars[bars.length-1].d:null,
          close:bars.length?bars[bars.length-1].c:null};
}

var API={T:T,rangePos:rangePos,rsi:rsi,volSpike:volSpike,returns:returns,pearson:pearson,bookCorr:bookCorr,evaluate:evaluate};
if(typeof module!=='undefined'&&module.exports)module.exports=API;else root.GATES=API;
})(typeof window!=='undefined'?window:this);
