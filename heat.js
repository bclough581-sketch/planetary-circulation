/* Amalgam heat map.
   Brent reads a market faster from a block of coloured tiles than from any table, so this is
   the thinkorswim view built from the data the app already publishes.

   Area is 20-day average dollar volume, so the tiles that are physically big are the ones the
   market is actually trading. Colour is the return over the chosen window, red down, green up,
   against a near-black neutral. Those are the same two colours the rest of the app uses for
   loss and gain, so a tile means here exactly what a number means elsewhere.

   The scale saturates at a cap that grows with the window (3% for a day, 12% for twenty). A
   fixed cap would make every tile look identical at one day and identical at twenty. */

var HEAT_WINS = [1, 5, 20, 60];
var HEAT_CAP  = {1:0.03, 5:0.06, 20:0.12, 60:0.25};

/* Squarified treemap (Bruls, Huizing, van Wijk 2000). Items must arrive sorted by v desc. */
function heatSquarify(items, x, y, w, h){
  var out = [];
  if(!items.length || w <= 0 || h <= 0) return out;
  var total = 0, i;
  for(i = 0; i < items.length; i++) total += items[i].v;
  if(total <= 0) return out;
  var scale = (w * h) / total, row = [], rowSum = 0, side = Math.min(w, h);
  function worst(extra){
    var mx = 0, mn = Infinity, sum = rowSum + (extra || 0), k, a;
    for(k = 0; k < row.length; k++){ a = row[k].v * scale; if(a > mx) mx = a; if(a < mn) mn = a; }
    if(extra){ a = extra * scale; if(a > mx) mx = a; if(a < mn) mn = a; }
    sum *= scale;
    if(sum <= 0 || mn <= 0 || side <= 0) return Infinity;
    return Math.max(side * side * mx / (sum * sum), sum * sum / (side * side * mn));
  }
  i = 0;
  while(i < items.length){
    if(!row.length || worst(items[i].v) <= worst(0)){
      row.push(items[i]); rowSum += items[i].v; i++;
    } else {
      var len = (rowSum * scale) / side, off = 0, k2;
      for(k2 = 0; k2 < row.length; k2++){
        var a2 = row[k2].v * scale, s2 = a2 / len;
        if(w >= h) out.push({it:row[k2], x:x, y:y + off, w:len, h:s2});
        else       out.push({it:row[k2], x:x + off, y:y, w:s2, h:len});
        off += s2;
      }
      if(w >= h){ x += len; w -= len; } else { y += len; h -= len; }
      side = Math.min(w, h); row = []; rowSum = 0;
    }
  }
  if(row.length && rowSum > 0){
    var off2 = 0, full = (w >= h) ? h : w, k3;
    for(k3 = 0; k3 < row.length; k3++){
      var sz = full * (row[k3].v / rowSum);
      if(w >= h) out.push({it:row[k3], x:x, y:y + off2, w:w, h:sz});
      else       out.push({it:row[k3], x:x + off2, y:y, w:sz, h:h});
      off2 += sz;
    }
  }
  return out;
}

/* Close-to-close return over `win` sessions, and the 20-day average dollar volume. */
function heatStat(bars, win){
  if(!bars || bars.length < win + 1) return null;
  var n = bars.length, last = bars[n - 1], prev = bars[n - 1 - win];
  if(!last || !prev || !prev[4] || !last[4]) return null;
  var dv = 0, k = 0, i;
  for(i = Math.max(0, n - 20); i < n; i++){ dv += bars[i][4] * bars[i][5]; k++; }
  return { c:last[4], r:last[4] / prev[4] - 1, dv:k ? dv / k : 0 };
}

function heatColor(r, cap){
  var t = Math.max(-1, Math.min(1, r / cap));
  var tgt = t >= 0 ? [47, 212, 122] : [255, 59, 59];
  var a = Math.pow(Math.abs(t), 0.62);          /* small moves still read, instead of all black */
  var c = [0, 1, 2].map(function(i){ return Math.round(26 + (tgt[i] - 26) * a); });
  return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
}

function heatPct(r){
  var s = (r * 100).toFixed(Math.abs(r) < 0.1 ? 1 : 0);
  return (r < 0 ? '−' + s.replace('-', '') : '+' + s) + '%';
}

/* Returns the whole panel. Safe on missing or short data. */
function heatInline(M, win){
  win = win || 20;
  var cap = HEAT_CAP[win] || 0.12;
  var uni = (M && M.universe) || [], bars = (M && M.bars) || {};
  var picks = (M && M.picks && M.picks.syms) || [];
  var pickSet = {}; picks.forEach(function(s){ pickSet[s] = 1; });

  var items = [], skipped = 0;
  uni.forEach(function(sym){
    var st = heatStat(bars[sym], win);
    if(!st || st.dv <= 0){ skipped++; return; }
    items.push({ sym:sym, v:st.dv, r:st.r, c:st.c });
  });
  if(!items.length)
    return '<div class="ht"><div class="ht-head">No price data loaded yet.</div></div>';
  items.sort(function(a, b){ return b.v - a.v; });

  var W = 1000, H = 520;
  var rects = heatSquarify(items, 0, 0, W, H);
  var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Heat map of the universe by ' + win + '-day return">';
  rects.forEach(function(q){
    var it = q.it, pick = pickSet[it.sym];
    s += '<rect x="' + q.x.toFixed(1) + '" y="' + q.y.toFixed(1) + '" width="' + Math.max(0, q.w - 2).toFixed(1) +
         '" height="' + Math.max(0, q.h - 2).toFixed(1) + '" rx="3" fill="' + heatColor(it.r, cap) + '"' +
         (pick ? ' stroke="#e6edf5" stroke-width="2.5"' : ' stroke="#05070b" stroke-width="1"') + '/>';
    var m = Math.min(q.w, q.h);
    if(m < 26) return;                                   /* a label that does not fit is noise */
    var fs = Math.max(9, Math.min(26, m * 0.27));
    var cx = (q.x + q.w / 2).toFixed(1), cy = q.y + q.h / 2;
    s += '<text x="' + cx + '" y="' + (cy - fs * 0.08).toFixed(1) + '" text-anchor="middle" fill="#f2f7fc" ' +
         'font-size="' + fs.toFixed(1) + '" font-weight="800" letter-spacing="0.5">' + esc(it.sym) + '</text>';
    if(m >= 44)
      s += '<text x="' + cx + '" y="' + (cy + fs * 0.95).toFixed(1) + '" text-anchor="middle" fill="#f2f7fcc4" ' +
           'font-size="' + (fs * 0.62).toFixed(1) + '" font-weight="700">' + heatPct(it.r) + '</text>';
  });
  s += '</svg>';

  var spy = heatStat(bars.SPY, win);
  var up = items.filter(function(i){ return i.r > 0; }).length;
  var head;
  if(spy) head = '<b>SPY is ' + heatPct(spy.r) + ' over ' + win + ' session' + (win > 1 ? 's' : '') + '.</b> ' +
                 up + ' of ' + items.length + ' names are up over the same stretch.';
  else    head = '<b>' + up + ' of ' + items.length + ' names are up over ' + win + ' sessions.</b>';

  var btns = HEAT_WINS.map(function(h){
    return '<button class="mini2' + (h === win ? ' on' : '') + '" data-act="hwin" data-h="' + h + '">' +
           (h === 1 ? '1 DAY' : h + ' DAYS') + '</button>';
  }).join('');

  var pickLine = picks.length
    ? 'Tonight’s picks are outlined in white' +
      (picks.filter(function(p){ return uni.indexOf(p) >= 0; }).length ? '.' :
       ', and none of them is in this map: the picks come from the whole market, this map is the 24 names the app tracks closely.')
    : 'No picks tonight.';

  return '<div class="ht">' +
    '<div class="ht-head">' + head + '</div>' +
    '<div class="ht-sub">Tile size is how many dollars a day actually trade. Colour is the ' + win +
      '-session return, saturating at ' + Math.round(cap * 100) + '%.</div>' +
    '<div class="ht-btns">' + btns + '</div>' + s +
    '<div class="ht-foot">' + pickLine +
      (skipped ? ' ' + skipped + ' name' + (skipped > 1 ? 's have' : ' has') + ' too little history for this window.' : '') +
      '<br>This is what has already happened. Nothing on it is a signal, a rank or a reason to buy.</div>' +
    '</div>';
}

/* ---- the held book -----------------------------------------------------------------------
   The market map answers what the market did. This one answers what Brent's own money is doing,
   and it is the one that should make him act.

   Five slots, because that is what the 1% risk unit and the 5% open-risk cap were sized for on
   2026-11-26. Empty slots are drawn, so the shape of the book is visible rather than implied.

   Colour is the R-multiple: how far the trade has come from its entry, measured in the risk it
   was taken with. R = (price - cost) / (cost - stop). Minus one R is the stop, zero is break
   even, plus two R is a good trade. The same scale as the market map, red bad to blue good, so
   red never means two different things in this app.

   An alert is NOT a colour. A position can be down and fine, or flat with no stop order and be
   an emergency, and those must not be the same shade of anything. Alerts get a bright border and
   a reason printed on the tile. */

var HELD_SLOTS = 5;
var HELD_CAP_PCT = 5.0;          // mirrors sizing.MAX_OPEN_RISK_PCT on Petunia

function heldR(h){
  if(!h.stop || h.cost <= h.stop) return null;      // no stop, or a stop above the entry
  return (h.price - h.cost) / (h.cost - h.stop);
}

function heldColor(r){
  if(r === null) return 'rgb(26,26,26)';
  var t = r < 0 ? Math.max(-1, r) : Math.min(1, r / 2);     // -1R to +2R
  var tgt = t >= 0 ? [91, 140, 255] : [255, 59, 59];        // tron blue, tron red
  var a = Math.pow(Math.abs(t), 0.6);
  var c = [0, 1, 2].map(function(i){ return Math.round(26 + (tgt[i] - 26) * a); });
  return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
}

/* What the tile says is wrong, in the order it matters. Null when nothing is. */
function heldAlert(h, r){
  if(!h.stop) return 'NO STOP ORDER';
  if(r !== null && r <= -0.75) return 'NEAR THE STOP';
  if(h.cost <= h.stop) return 'STOP ABOVE ENTRY';
  return null;
}

function heldInline(held, acct){
  held = (held || []).slice(0, HELD_SLOTS);
  var netLiq = (acct && acct.netLiq) || 0;
  var risk = 0, alerts = 0, unstopped = 0;
  held.forEach(function(h){
    if(h.stop) risk += h.qty * (h.price - h.stop); else unstopped++;
  });
  var budget = netLiq * HELD_CAP_PCT / 100;
  var used = budget > 0 ? Math.min(1, risk / budget) : 0;

  var tiles = '';
  held.forEach(function(h){
    var r = heldR(h), al = heldAlert(h, r);
    if(al) alerts++;
    var at = h.stop ? h.qty * (h.price - h.stop) : h.qty * h.price;
    tiles += '<div class="hd-t' + (al ? ' hd-al' : '') + '" style="background:' + heldColor(r) + '">' +
      '<div class="hd-s">' + esc(h.sym) + '</div>' +
      '<div class="hd-r">' + (r === null ? '&ndash;' : (r >= 0 ? '+' : '−') + Math.abs(r).toFixed(1) + 'R') + '</div>' +
      '<div class="hd-m">$' + at.toFixed(0) + (netLiq ? ' · ' + (at / netLiq * 100).toFixed(1) + '%' : '') +
        (h.stop ? ' at risk' : ' exposed') + '</div>' +
      (al ? '<div class="hd-a">' + al + '</div>' : '') + '</div>';
  });
  for(var i = held.length; i < HELD_SLOTS; i++)
    tiles += '<div class="hd-t hd-e"><div class="hd-s">OPEN</div></div>';

  var head;
  if(!held.length) head = '<b>Nothing open.</b> Five slots, and the whole risk budget is free.';
  else if(alerts) head = '<b>' + alerts + ' of ' + held.length + ' position' + (held.length > 1 ? 's need' : ' needs') +
                         ' a look.</b> The reason is on the tile.';
  else head = '<b>' + held.length + ' of ' + HELD_SLOTS + ' slots open, nothing flagged.</b>';

  var bar = netLiq
    ? '<div class="hd-bar"><i style="width:' + (used * 100).toFixed(1) + '%"></i></div>' +
      '<div class="hd-sub">$' + risk.toFixed(0) + ' of the $' + budget.toFixed(0) + ' risk budget used, ' +
      (used * 100).toFixed(0) + '%. The budget is ' + HELD_CAP_PCT + '% of the account, half the kill switch.' +
      (unstopped ? ' ' + unstopped + ' position' + (unstopped > 1 ? 's sit' : ' sits') +
        ' outside it entirely, with no stop order.' : '') + '</div>'
    : '<div class="hd-sub">No account size yet, so the risk budget cannot be drawn. Open tonight’s push link.</div>';

  return '<div class="bk">' +
    '<div class="hd-head">' + head + '</div>' + bar +
    '<div class="hd-grid">' + tiles + '</div>' +
    '<div class="hd-foot">R is how far a trade has come from its entry, in units of what it risked. ' +
    '−1R is the stop, +2R is a good trade. Colour is that number and nothing else. ' +
    'A bright border is a thing to act on, which is not the same as being down.</div>' +
    '</div>';
}

/* ---- You against SPY ---------------------------------------------------
   The scoreboard. Time-weighted return against SPY bought and held over the
   same two dates, so a deposit or a withdrawal cannot flatter the number.
   Tron blue is ahead of SPY. Tron red is behind. The bar is the spread in
   percentage points, centred on zero, and the number beside it is the truth
   whether or not the bar has run out of room. */
var VS_CAP = 10;                      /* points of spread that fill the bar */
var VS_ORDER = ['wk', 'mo', 'qt', 'al'];
var VS_LABEL = {wk: 'THIS WEEK', mo: 'THIS MONTH', qt: 'THREE MONTHS', al: 'SINCE SEPT 23'};
var VS_EXPECT = {wk: 5, mo: 21, qt: 63};   /* trading days each window asks for */
var VS_STALE_DAYS = 4;                /* past this the panel says how old it is */

function vsColor(sp){
  if(sp === null || isNaN(sp)) return 'rgb(26,26,26)';
  var t = Math.max(-1, Math.min(1, sp / VS_CAP)), e = Math.pow(Math.abs(t), 0.62);
  var a = [26, 26, 26], b = t >= 0 ? [91, 140, 255] : [255, 59, 59];
  return 'rgb(' + a.map(function(c, i){ return Math.round(c + (b[i] - c) * e); }).join(',') + ')';
}
function vsSign(v, d){ return (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d === undefined ? 1 : d); }

/* left and width as percentages of a bar whose centre is zero. */
function vsBar(sp){
  var w = 50 * Math.min(1, Math.abs(sp) / VS_CAP);
  return sp >= 0 ? {left: 50, width: w} : {left: 50 - w, width: w};
}

/* Whole days between an ISO date and today, or null if the date is unusable. */
function vsAge(asof){
  if(!asof) return null;
  var t = Date.parse(asof + 'T00:00:00');
  if(isNaN(t)) return null;
  var now = new Date();
  var today = Date.parse(now.toISOString().slice(0, 10) + 'T00:00:00');
  return Math.round((today - t) / 86400000);
}

function vsInline(vs, asof){
  if(!vs || !vs.length)
    return '<div class="vs"><div class="vs-head">No scoreboard yet. It arrives with tonight’s ' +
           'push link, once the run has a day of account history to compare.</div></div>';

  var by = {};
  vs.forEach(function(r){ by[r.code] = r; });

  var all = by.al, head;
  if(all){
    var sp = all.you - all.bench;
    head = '<b style="color:' + (sp >= 0 ? '#5b8cff' : '#ff3b3b') + '">' + vsSign(sp) +
           ' points ' + (sp >= 0 ? 'ahead of' : 'behind') + ' SPY</b> since you started.';
  } else {
    head = '<b>Not enough history yet.</b>';
  }

  var rows = '';
  VS_ORDER.forEach(function(code){
    var r = by[code];
    if(!r){
      rows += '<div class="vs-r"><div class="vs-l">' + VS_LABEL[code] + '</div>' +
              '<div class="vs-b"><i class="vs-z"></i></div>' +
              '<div class="vs-n vs-dim">short</div></div>';
      return;
    }
    var sp = r.you - r.bench, g = vsBar(sp), exp = VS_EXPECT[code];
    var off = (exp && Math.abs(r.days - exp) > 1)
      ? ' <span class="vs-warn">' + r.days + ' trading days, not ' + exp + '</span>' : '';
    rows += '<div class="vs-r">' +
      '<div class="vs-l">' + VS_LABEL[code] + '</div>' +
      '<div class="vs-b"><i class="vs-z"></i>' +
        '<i class="vs-f" style="left:' + g.left.toFixed(1) + '%;width:' + g.width.toFixed(1) +
        '%;background:' + vsColor(sp) + '"></i></div>' +
      '<div class="vs-n" style="color:' + (sp >= 0 ? '#5b8cff' : '#ff3b3b') + '">' + vsSign(sp) + '</div>' +
      '<div class="vs-sub">you ' + vsSign(r.you) + '% · SPY ' + vsSign(r.bench) + '%' + off + '</div>' +
      '</div>';
  });

  /* Kept from the last push, so it can be old. An old spread shown with no date reads as
     today's, which is the one way this panel could make him act on a stale number. */
  var age = vsAge(asof), stale = '';
  if(age !== null && age > VS_STALE_DAYS)
    stale = '<div class="vs-stale">Measured to ' + esc(asof) + ', ' + age +
            ' days ago. Nothing since then is in it.</div>';

  return '<div class="vs">' +
    '<div class="vs-head">' + head + stale + '</div>' +
    '<div class="vs-rows">' + rows + '</div>' +
    '<div class="vs-foot">Your return here is time-weighted, so money you add or take out ' +
    'does not move it. SPY is bought and held between the same two dates. ' +
    'Blue is ahead of SPY and red is behind, which is not the same as up or down: ' +
    'in a falling market you can be blue and still be down money.</div>' +
    '</div>';
}
