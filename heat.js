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
