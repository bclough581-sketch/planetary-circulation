"""Standalone heat-map preview: one file that opens from disk with the data baked in.

The app itself fetches amalgam-market.json, which a browser refuses to do from file://,
so this exists purely so the map can be looked at without a web server. It reads the same
built page and the same data the app uses, so what it draws is what the app draws.

    python build_heat_preview.py        writes heat_preview.html
"""
import json
import pathlib

HERE = pathlib.Path(__file__).parent
SRC = (HERE / "amalgam-daily.html").read_text(encoding="utf-8")


def extract(name):
    """Pull one function out of the built page by matching braces."""
    start = SRC.index("function %s(" % name)
    depth = 0
    for j in range(SRC.index("{", start), len(SRC)):
        if SRC[j] == "{":
            depth += 1
        elif SRC[j] == "}":
            depth -= 1
            if not depth:
                return SRC[start:j + 1]
    raise AssertionError("unbalanced braces in " + name)


def consts():
    a = SRC.index("var HEAT_WINS")
    b = SRC.index("}", SRC.index("var HEAT_CAP")) + 1
    return SRC[a:b]


css_a = SRC.index("/* ---- the heat map")
css_b = SRC.index("</style>", css_a)
js = consts() + "\n" + "\n".join(extract(n) for n in
                                 ("esc", "heatSquarify", "heatStat", "heatColor", "heatPct", "heatInline"))
market = json.loads((HERE / "amalgam-market.json").read_text(encoding="utf-8"))
slim = {k: market[k] for k in ("asof", "generated", "universe", "picks")}
slim["bars"] = {k: v[-70:] for k, v in market["bars"].items()}        # 60-day window needs 61

out = """<!doctype html><html lang="en" class="tron"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Amalgam heat map preview</title>
<style>
:root{--t1:12px;--t2:14px;--t4:11px;--txt:#e6edf5;--dim:#8da2bb;--warn:#f2b441}
body{margin:0;background:#07090c;color:#e6edf5;font:14px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
.wrap{max-width:1100px;margin:0 auto;padding:22px 4px 40px}
h1{font-size:13px;letter-spacing:.34em;color:#ff3b3b;font-weight:800;margin:0 0 4px 18px}
.note{font-size:12px;color:#55637a;margin:0 0 16px 18px;letter-spacing:.04em}
.mini2{background:#0d1219;border:1px solid #2a3647;color:#9aa6b6;border-radius:999px;
  padding:5px 11px;font-size:10px;font-weight:800;letter-spacing:.14em;cursor:pointer}
%s
</style></head><body><div class="wrap">
<h1>AMALGAM HEAT MAP</h1><div class="note">Preview built from the live data file. Click a window.</div>
<div id="m"></div></div>
<script>
var MARKET=%s, S={hwin:20};
%s
function draw(){ document.getElementById('m').innerHTML = heatInline(MARKET, S.hwin); }
document.addEventListener('click', function(e){
  var b=e.target.closest('[data-act="hwin"]'); if(!b) return;
  S.hwin=+b.getAttribute('data-h'); draw();
});
draw();
</script></body></html>
""" % (SRC[css_a:css_b], json.dumps(slim, separators=(",", ":")), js)

path = HERE / "heat_preview.html"
path.write_text(out, encoding="utf-8")
print("wrote", path.name, len(out), "bytes")
