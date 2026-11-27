"""Build amalgam-daily.html from amalgam-daily.src.html plus the layer files.

Edit the SOURCE and the LAYERS, never the built page: this script overwrites it.

Repeatable: it always starts from amalgam-daily.src.html, so the layer files stay the
single source of truth and a copy edit never has to be made twice."""
import pathlib
HERE = pathlib.Path(__file__).parent
base = HERE / "amalgam-daily.src.html"
s = base.read_text(encoding="utf-8")
def need(old):
    assert s.count(old) == 1, "anchor count %d: %.70s" % (s.count(old), old)
    return old
rd = lambda f: (HERE / f).read_text(encoding="utf-8")

s = s.replace(need('<html lang="en">'), '<html lang="en" class="tron">', 1)

css = ("\n/* ================= tron.css ================= */\n" + rd("tron.css")
     + "\n/* ================= wide.css ================= */\n" + rd("wide.css")
     + "\n/* ================= hud.css  ================= */\n" + rd("hud.css")
     + "\n/* ================= heat.css ================= */\n" + rd("heat.css")
     + "\n/* ================= grid.css ================= */\n" + rd("grid.css")
     + """
/* A section header holds its label and up to three buttons on one line with no wrapping,
   which overflows the right edge of a 390px phone and clips the last button. Unscoped,
   because it is a fault in the app rather than in the neon layer. */
@media (max-width:560px){
  .hd{flex-wrap:wrap;row-gap:6px}
  .hd > span:last-child{margin-left:auto}
}
""")
s = s.replace(need("</style>\n</head>"), css + "</style>\n</head>", 1)
s = s.replace(need("<script>\n(function(){"), "<script>\n(function(){\n" + rd("hud.js") + "\n" + rd("heat.js") + "\n", 1)
s = s.replace(need("</script>\n</body>"), "</script>\n<script>\n" + rd("tron.js") + "\n</script>\n</body>", 1)

a = need("    else h+='<section class=\"z z-hud\">'+hudHtml(dec,P.length,P)+'</section>'+")
s = s.replace(a, "    else h+='<div class=\"zgrid\">'+\n"
                 "      '<section class=\"z z-hud\">'+hudHtml(dec,P.length,P)+'</section>'+", 1)
b = need("      '<section class=\"z z-picks\">'+picksBlock(P)+'</section>'+")
s = s.replace(b, b + "\n      heldSection()+\n      vsSection()+\n      raceSection()+\n      heatSection()+", 1)
c = need("      '<section class=\"z z-sig\"><div class=\"hd\"><span class=\"sec\">3 WARNINGS</span></div><div class=\"list\">'+sigRows(sg.w,true)+'</div><div class=\"hd\"><span class=\"sec\">3 POSITIVES</span></div><div class=\"list\">'+sigRows(sg.p,false)+'</div></section>'+")
s = s.replace(c, c + "\n      '</div>'+", 1)

start, end = s.index("function raceHtml(){"), s.index("/* E5: the honest limit.")
assert "sc7" in s[start:end]
s = s[:start] + '''/* The race lives in two places now: always on in the right column of a wide screen, and
   behind its button on a phone. Both call raceInline, so there is exactly one renderer and
   the two can never disagree about what the ledger says. */
function raceForToday(){
  var R = MARKET && MARKET.race;
  return (R && R.asof === (S.mdate || MARKET.asof)) ? R : null;
}
function raceState(){
  var R = raceForToday();
  if(!R) return 'NO SLATE THIS SESSION';
  var d = R.closed_sessions || 0;
  return d ? d + ' SCORED SESSIONS' : 'LIVE \\u00b7 NOTHING SCORED';
}
function raceSection(){
  return '<section class="z z-race"><div class="hd"><span class="sec">THE RACE</span>' +
    '<span class="st">' + raceState() + '</span></div>' +
    (raceForToday() ? raceInline(raceForToday())
                    : '<div class="cp" style="margin:0 18px">No race recorded for this session yet.</div>') +
    '</section>';
}
function raceHtml(){
  var R = raceForToday();
  var sheet = '<div class="scrim" data-act="pclose"></div><div class="sheet"><div class="sh">' +
              '<div class="sn">The race</div><button class="x" data-act="pclose" aria-label="Close">&#10005;</button></div>';
  if(!R) return sheet + '<div class="cp">No race recorded for this session yet.</div></div>';

  /* The chart is the same one the wide layout shows. What the sheet adds is the roster:
     which names each lane actually picked tonight, which does not fit beside the chart. */
  var roster = (R.lanes || []).map(function(l){
    var m = RACE_LANES[l] || {full:l}, picks = (R.cards || {})[l] || [];
    return '<div class="cp" style="margin-top:8px"><b style="color:' + (l === 'random' ? '#f2b441' : '#c9d1dc') + '">' +
      (m.full || l) + '</b><br>' + esc(picks.join('  ')) +
      '<div style="color:#6f7b8a;margin-top:3px">' + LANE_WHY[l] + '</div></div>';
  }).join('');

  return sheet + raceInline(R) +
    '<div class="hd" style="padding:0"><span class="sec">TONIGHT\\'S TOP THREE IN EACH LANE</span></div>' +
    '<div class="st" style="margin:0 0 4px;text-align:left">Each lane is scored on ' + (R.basket_n || 20) +
    ' names; the symbols listed are just the top three, the ones you see as cards.</div>' + roster +
    noEdgeNote() + '</div>';
}
''' + s[end:]



# ---- heat map wiring -------------------------------------------------------------------
# The map is a sibling of the race: inline in the wide band, behind a button on a phone.
d = need('<button class="mini2" data-act="race">RACE</button>')
s = s.replace(d, d + '<button class="mini2" data-act="heat">HEAT</button>', 1)

e = need("  if(S.panel==='race'){ h+=raceHtml(); }")
s = s.replace(e, e + "\n  if(S.panel==='heat'){ h+=heatHtml(); }", 1)

f = need("  else if(act==='race'){ S.panel='race'; }")
s = s.replace(f, f + """
  else if(act==='heat'){ S.panel='heat'; }
  else if(act==='hwin'){ S.hwin=+t.getAttribute('data-h'); }""", 1)

g = need("function raceSection(){")
# The held book is the only panel about Brent's own money, so unlike the race and the market map
# it is never hidden behind a button. It is five small tiles and it is the thing he should see.
s = s.replace(g, """function vsSection(){
  return '<section class="z z-vs"><div class="hd2"><span class="sec">VS SPY</span>' +
    '<span class="st">' + ((S.vs && S.vs.length) ? (S.bookDate ? esc(S.bookDate) : 'TIME-WEIGHTED') : 'NO DATA') + '</span></div>' +
    vsInline(S.vs || [], S.bookDate || null) + '</section>';
}
""" + g, 1)

s = s.replace(g, """function heldSection(){
  var A = (S.acct && !S.acct.sample) ? S.acct : null;   /* never draw a budget off the sample figures */
  return '<section class="z z-book"><div class="hd2"><span class="sec">YOUR BOOK</span>' +
    '<span class="st">' + ((S.held && S.held.length) ? S.held.length + ' OF 5 OPEN' + (S.bookDate ? ' · ' + esc(S.bookDate) : '') : 'NOTHING OPEN') + '</span></div>' +
    heldInline(S.held || [], A) + '</section>';
}
""" + g, 1)
s = s.replace(g, """function heatForToday(){ return (MARKET && MARKET.bars && MARKET.bars.SPY) ? MARKET : null; }
function heatSection(){
  return '<section class="z z-heat"><div class="hd"><span class="sec">THE HEAT MAP</span>' +
    '<span class="st">' + (heatForToday() ? esc(MARKET.asof) : 'NO DATA') + '</span></div>' +
    (heatForToday() ? heatInline(MARKET, S.hwin || 20)
                    : '<div class="cp" style="margin:0 18px">No market data loaded yet.</div>') +
    '</section>';
}
function heatHtml(){
  var sheet = '<div class="scrim" data-act="pclose"></div><div class="sheet"><div class="sh">' +
              '<div class="sn">The heat map</div><button class="x" data-act="pclose" aria-label="Close">&#10005;</button></div>';
  if(!heatForToday()) return sheet + '<div class="cp">No market data loaded yet.</div></div>';
  return sheet + heatInline(MARKET, S.hwin || 20) + '</div>';
}
""" + g, 1)

(HERE / "amalgam-daily.html").write_text(s, encoding="utf-8")
print("integrated:", len(s), "bytes")
