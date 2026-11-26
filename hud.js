/* Amalgam race chart.
   The race is the only part of this system that can ever prove the method works, and until
   now it was twelve numbers in a grid behind a button. This draws it.

   One rule governs the colours. Hue never encodes WHICH lane, because a reader will always
   read hue as good or bad. Identity is carried by the label at the end of each line. Hue
   carries the only thing that is actually a judgement: whether a lane is beating RANDOM.
     white  your gates, the lane you care about
     amber  RANDOM, the benchmark every lane has to clear, drawn dashed
     slate  the other two reference lanes
   and the endpoint dot takes green when that lane is ahead of RANDOM at 20 days, slate when
   it is behind. Red appears nowhere in here: red is the frame of this app, and a red loss
   figure would read as decoration. */

var RACE_LANES = {
  gates:   {name:'YOUR GATES', full:'YOUR GATES',        stroke:'#e6edf5', w:2.3, dash:''},
  mom12_1: {name:'MOMENTUM',   full:'12-MONTH MOMENTUM', stroke:'#8da2bb', w:1.6, dash:''},
  pct52w:  {name:'52W HIGH',   full:'NEAR 52-WEEK HIGH', stroke:'#8da2bb', w:1.6, dash:''},
  random:  {name:'RANDOM',     full:'RANDOM',            stroke:'#f2b441', w:1.9, dash:'5 4'}
};
var RACE_HZ = [5,10,20];

/* U+2212 MINUS, not a hyphen: it is the same width as the plus, so a column of results
   lines up instead of shuffling left by a pixel on every negative. */
function raceNum(v){ return v<0 ? '\u2212'+Math.abs(v).toFixed(2) : '+'+v.toFixed(2); }

/* Returns {html} for the whole panel. Safe on a missing, empty or partial race block. */
function raceInline(R, opts){
  opts = opts || {};
  var lanes = (R && R.lanes && R.lanes.length) ? R.lanes : ['gates','mom12_1','pct52w','random'];
  var sum   = (R && R.summary) || {};
  var done  = (R && R.closed_sessions) || 0;
  var target= (R && R.target_sessions) || 91;
  var bn    = (R && R.basket_n) || 20;

  /* a value counts only if the lane has actually closed sessions behind it */
  function val(l,k){ var s=sum[l]||{}; var v=s[k]; return (typeof v==='number' && (s.n||0)>0) ? v : null; }
  var any=false;
  lanes.forEach(function(l){ RACE_HZ.forEach(function(h){ if(val(l,'x'+h)!==null) any=true; }); });

  var W=460,H=212,L=14,Rm=150,T=16,B=30;
  var x0=L, x1=W-Rm, y0=T, y1=H-B;
  function px(d){ return x0 + (d/20)*(x1-x0); }

  var ymax=1.0;
  if(any) lanes.forEach(function(l){ RACE_HZ.forEach(function(h){
    var v=val(l,'x'+h); if(v!==null) ymax=Math.max(ymax,Math.abs(v)*1.18);
  }); });
  function py(v){ return y0 + (1 - (v+ymax)/(2*ymax))*(y1-y0); }

  var s='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Average points ahead of SPY by holding period">';

  /* grid: the zero line is the market. everything is measured against it. */
  RACE_HZ.forEach(function(h){
    s+='<line x1="'+px(h)+'" y1="'+y0+'" x2="'+px(h)+'" y2="'+y1+'" stroke="#18212e" stroke-width="1"/>';
    s+='<text x="'+px(h)+'" y="'+(y1+17)+'" fill="#55637a" font-size="10" font-weight="800" letter-spacing="1.6" text-anchor="middle">'+h+'D</text>';
  });
  if(any){
    s+='<line x1="'+x0+'" y1="'+py(0)+'" x2="'+x1+'" y2="'+py(0)+'" stroke="#f2b44159" stroke-width="1" stroke-dasharray="2 3"/>';
    s+='<text x="'+x0+'" y="'+(py(0)-10)+'" fill="#7a6a42" font-size="9" font-weight="800" letter-spacing="1.8">SPY</text>';
  }

  if(!any){
    /* Nothing has been scored. Rather than an empty box, this is the grid before the start:
       every runner on the line, every lane stretching away to the 20-day finish. It is the
       same geometry the scored chart uses, so when the first result lands the lines simply
       begin to move instead of the panel changing shape. */
    s+='<line x1="'+x0+'" y1="'+(y0+6)+'" x2="'+x0+'" y2="'+(y1-6)+'" stroke="#ff3b3b" stroke-width="1.5" opacity=".55"/>';
    s+='<text x="'+x0+'" y="'+(y0+2)+'" fill="#8a4a4a" font-size="9" font-weight="800" letter-spacing="1.8">START</text>';
    lanes.forEach(function(l,i){
      var m=RACE_LANES[l]||{name:l,stroke:'#8da2bb',dash:''};
      var y=py(0)+(i-(lanes.length-1)/2)*15;
      s+='<line x1="'+x0+'" y1="'+y.toFixed(1)+'" x2="'+x1+'" y2="'+y.toFixed(1)+'" stroke="'+m.stroke+'" stroke-width="1" stroke-dasharray="2 5" opacity=".30"/>';
      s+='<circle cx="'+(x0+1)+'" cy="'+y.toFixed(1)+'" r="3.2" fill="'+m.stroke+'" opacity=".85"/>';
      s+='<text x="'+(x1+12)+'" y="'+(y+3).toFixed(1)+'" fill="#5b6a7e" font-size="10" font-weight="800" letter-spacing="1">'+m.name+'</text>';
    });
    s+='<line x1="'+x1+'" y1="'+(y0+6)+'" x2="'+x1+'" y2="'+(y1-6)+'" stroke="#2a3647" stroke-width="1.5"/>';
    s+='<text x="'+x1+'" y="'+(y0+2)+'" fill="#4a5768" font-size="9" font-weight="800" letter-spacing="1.8" text-anchor="end">FINISH</text>';
    s+='</svg>';
  } else {
    var rnd = val('random','x20');
    var ends=[];
    lanes.forEach(function(l){
      var m=RACE_LANES[l]||{name:l,stroke:'#8da2bb',w:1.6,dash:''};
      var pts=['0,'+py(0).toFixed(1)].map(function(){ return px(0).toFixed(1)+','+py(0).toFixed(1); });
      var last=null;
      RACE_HZ.forEach(function(h){ var v=val(l,'x'+h); if(v!==null){ pts.push(px(h).toFixed(1)+','+py(v).toFixed(1)); last={d:h,v:v}; } });
      s+='<polyline class="rc-ln" points="'+pts.join(' ')+'" fill="none" stroke="'+m.stroke+'" stroke-width="'+m.w+'"'+
         (m.dash?' stroke-dasharray="'+m.dash+'"':'')+' stroke-linejoin="round" stroke-linecap="round"'+
         '/>';
      if(last){
        var ahead = (l==='random') ? null : (rnd===null ? null : last.v>rnd);
        var c = (l==='random') ? '#f2b441' : (ahead===null ? '#8da2bb' : (ahead ? '#2fd47a' : '#7f93ad'));
        ends.push({y:py(last.v), name:m.name, v:last.v, c:c, x:px(last.d)});
      }
    });
    /* stack the end labels so two close lines do not print on top of each other */
    ends.sort(function(a,b){return a.y-b.y});
    for(var i=1;i<ends.length;i++) if(ends[i].y-ends[i-1].y<13) ends[i].y=ends[i-1].y+13;
    ends.forEach(function(e){
      s+='<circle cx="'+e.x.toFixed(1)+'" cy="'+py(e.v).toFixed(1)+'" r="3.2" fill="'+e.c+'"/>';
      s+='<text x="'+(x1+10)+'" y="'+(e.y+3).toFixed(1)+'" fill="'+e.c+'" font-size="10" font-weight="800" letter-spacing="1">'+e.name+'</text>';
      s+='<text x="'+(W-2)+'" y="'+(e.y+3).toFixed(1)+'" fill="'+e.c+'" font-size="10" font-weight="800" text-anchor="end">'+raceNum(e.v)+'</text>';
    });
    s+='</svg>';
  }

  /* the app states its own finding in words, or says plainly that it has none */
  var head;
  if(!any){
    head='<b>No result yet.</b> '+done+' of about '+target+' sessions have closed. '+
         'A session is only scored once its picks have had 5, 10 and 20 trading days to run, '+
         'so the first number appears about four weeks after the first slate.';
  } else {
    var rank=lanes.filter(function(l){return val(l,'x20')!==null})
                  .sort(function(a,b){return val(b,'x20')-val(a,'x20')});
    var lead=rank[0], g=val('gates','x20'), r=val('random','x20');
    head='<b>At 20 days '+((RACE_LANES[lead]||{}).full||lead)+' leads at '+raceNum(val(lead,'x20'))+'.</b> ';
    if(g!==null && r!==null)
      head+='Your gates are at '+raceNum(g)+', '+(g>r?'ahead of':'behind')+' RANDOM at '+raceNum(r)+'. ';
    head+=(done<target? 'Too few sessions to mean anything yet.' : 'Enough sessions to look.');
  }

  var tab='';
  if(any){
    var rnd20=val('random','x20');
    tab='<table class="rc-tab"><thead><tr><th></th>'+
        RACE_HZ.map(function(h){return '<th>'+h+'D</th>'}).join('')+'</tr></thead><tbody>'+
      lanes.map(function(l){
        var m=RACE_LANES[l]||{full:l};
        return '<tr><td>'+(m.full||l)+'</td>'+RACE_HZ.map(function(h){
          var v=val(l,'x'+h);
          if(v===null) return '<td class="nil">&ndash;</td>';
          var c = (l==='random') ? '#f2b441'
                : (rnd20===null || h!==20) ? '#c9d1dc'
                : (v>rnd20 ? '#2fd47a' : '#7f93ad');
          return '<td style="color:'+c+'">'+raceNum(v)+'</td>';
        }).join('')+'</tr>';
      }).join('')+'</tbody></table>';
  }
  var pr=Math.min(100,Math.round(done/target*100));
  return '<div class="rc">'+
    '<div class="rc-head">'+head+'</div>'+
    '<div class="rc-sub">Average points ahead of SPY, by how long a pick is held. '+
      'Four ways of picking, same night, same pool, no money on any of them.</div>'+
    s+tab+
    '<div class="rc-foot">'+done+' of about '+target+' scored sessions'+
      '<div class="rc-bar"><i style="width:'+pr+'%"></i></div>'+
      'Sessions are the unit here, not picks: one session closes '+bn+' picks at once and they '+
      'are not '+bn+' independent facts. '+
      (done<target ? 'Not enough yet to mean anything. '
                   : 'Compare every lane with RANDOM, not with each other. ')+
      'The lane to watch is RANDOM. Anything that cannot beat a coin flip from the same pool '+
      'is not picking, it is guessing.</div>'+
    '</div>';
}
