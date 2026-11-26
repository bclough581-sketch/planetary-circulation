"""Assemble the HUD preview from the REAL app stylesheet plus the layer files.

The previous preview was hand-written markup, which is how a set of placeholder numbers
ended up being read as a result. This one renders the race panel by calling the actual
raceInline() from hud.js, so whatever the preview shows is what the app would show for
that input, and the two states are labelled."""
import json, re, subprocess, sys, pathlib

HERE = pathlib.Path(__file__).parent
BASE = HERE / "Claude outputs" if (HERE / "Claude outputs").exists() else HERE

def read(p): return (HERE / p).read_text(encoding="utf-8")

def render_race(payload):
    js = read("hud.js") + "\nprocess.stdout.write(raceInline(%s));" % json.dumps(payload)
    return subprocess.run(["node", "-e", js], capture_output=True, text=True, check=True).stdout

LANES = ["gates", "mom12_1", "pct52w", "random"]
EMPTY = {"lanes": LANES, "summary": {}, "closed_sessions": 0, "target_sessions": 91,
         "basket_n": 20}
# Clearly marked as invented. It exists only so the full state can be designed before any
# real result exists. Nothing here is a finding.
SIM = {"lanes": LANES, "basket_n": 20, "closed_sessions": 74, "target_sessions": 91,
       "summary": {"gates":   {"n": 74, "x5": -0.31, "x10": -0.52, "x20": -1.18, "picks": 1480},
                   "mom12_1": {"n": 74, "x5":  0.44, "x10":  1.02, "x20":  2.31, "picks": 1480},
                   "pct52w":  {"n": 74, "x5":  0.12, "x10":  0.38, "x20":  0.77, "picks": 1480},
                   "random":  {"n": 74, "x5":  0.05, "x10": -0.11, "x20":  0.22, "picks": 1480}}}

src = (BASE / "amalgam_wide_preview.html").read_text(encoding="utf-8")

# 1. the HUD layer goes last so it wins the cascade
# must be the LAST style block: the preview carries three of them and hud.css has to win
i = src.rindex("</style>")
src = src[:i] + "\n/* ===== hud.css ===== */\n" + read("hud.css") + "\n" + src[i:]

# 2. watch-only cards get the modifier the BUY rule keys off
src = src.replace('<div class="pk"><div class="role watchr">', '<div class="pk watch"><div class="role watchr">')

# 3. the old hand-made race table is replaced by the rendered panel, in its own region
old = re.search(r'<section class="z z-meter">.*?</section>', src, re.S)
if not old:
    sys.exit("could not find the z-meter race block to replace")
race = ('<section class="z z-race">'
        '<div class="hd"><span class="sec">THE RACE</span>'
        '<span class="st" id="rcstate">LIVE · NOTHING SCORED</span></div>'
        '<div id="rcslot">' + render_race(EMPTY) + '</div></section>')
stub = ('<section class="z z-meter"><div class="hd"><span class="sec">SCOREBOARD</span></div>'
        '<div class="cp" style="margin:0 18px">Region placeholder. The live app renders the '
        'scoreboard here.</div></section>'
        '<section class="z z-inst"><div class="hd"><span class="sec">FULL INSTRUMENTS</span>'
        '<span class="st">TAP ANY GAUGE FOR THE WHY</span></div>'
        '<div class="cp" style="margin:0 18px;height:300px">Region placeholder.</div></section>'
        '<section class="z z-sig"><div class="hd"><span class="sec">3 WARNINGS</span></div>'
        '<div class="cp" style="margin:0 18px;height:150px">Region placeholder.</div></section>')
src = src.replace(old.group(0), race + stub, 1)

# 4. wrap the regions so the desktop grid has a container
first = src.index('<section class="z z-hud">')
last = src.rindex('</section>') + len('</section>')
src = src[:first] + '<div class="zgrid">' + src[first:last] + '</div>' + src[last:]

# 5. the state switch, and the two payloads, both labelled
toggle = ('<button id="sw" style="background:#0c1118;color:#9aa6b6;border:1px solid #3a4658;'
          'border-radius:999px;padding:11px 14px;font:800 11px/1 ui-sans-serif,system-ui;'
          'letter-spacing:.14em">STATE: LIVE</button>')
src = src.replace('<button id="rp"', toggle + '<button id="rp"', 1)
tail = ("<script>" + read("hud.js") + "\n"
        "var RC_LIVE=" + json.dumps(EMPTY) + ",RC_SIM=" + json.dumps(SIM) + ",rcSim=false;"
        "document.getElementById('sw').addEventListener('click',function(){"
        "rcSim=!rcSim;"
        "document.getElementById('rcslot').innerHTML=raceInline(rcSim?RC_SIM:RC_LIVE);"
        "document.getElementById('rcstate').textContent=rcSim?'INVENTED NUMBERS \\u00b7 LAYOUT ONLY':'LIVE \\u00b7 NOTHING SCORED';"
        "document.getElementById('rcstate').style.color=rcSim?'#f2b441':'';"
        "this.textContent='STATE: '+(rcSim?'SIMULATED':'LIVE');"
        "});</script></body></html>")
src = src.replace("</body></html>", tail, 1)
src = src.replace("<title>Amalgam wide preview</title>", "<title>Amalgam HUD preview</title>", 1)

out = BASE / "amalgam_hud_preview.html"
out.write_text(src, encoding="utf-8")
print("wrote", out, out.stat().st_size, "bytes")
