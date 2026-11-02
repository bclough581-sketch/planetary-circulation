#!/usr/bin/env python3
"""Daily data job for Amalgam.

Pulls ONLY sources whose terms allow public display with attribution:
  - ECB euro foreign exchange reference rates   (Source: ECB statistics.)
  - U.S. Treasury daily par yield curve         (public domain)
  - U.S. EIA spot prices, needs EIA_API_KEY     (public domain, cite EIA + date)
  - IMF PortWatch chokepoint transit calls      (cite IMF; commercial reuse needs permission)
Writes data.json. Each source is independent: a failure marks that source
not-ok and keeps its previous values (never silently shows a stale number as
fresh: every series carries its own as-of date and the page enforces age limits).
Stdlib only. Exits non-zero if EVERY source failed, so the Action goes red.
"""
import csv, io, json, os, re, statistics, sys, time, urllib.parse, urllib.request, zipfile
from datetime import date, datetime, timedelta, timezone

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data.json")
UA = {"User-Agent": "planetary-circulation/1.0 (open-data HUD; contact via repo)"}


def get(url, timeout=60):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def load_prev():
    try:
        with open(OUT, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def pct(a, b):
    return None if (a is None or b in (None, 0)) else (a / b - 1) * 100


HIST_N = 130


def range_stats(vals, dates=None):
    """vals newest-first. returns price, chg%, lo, hi over up to 260 obs.
    With dates, also returns hist: [[date, value], ...] newest-first (about six months) for Pulse and Sync."""
    pairs = [(d, v) for d, v in zip(dates or [None] * len(vals), vals) if v is not None]
    vals = [v for _, v in pairs]
    if len(vals) < 2:
        return None
    w = vals[:260]
    st = {"price": vals[0], "chg": pct(vals[0], vals[1]), "lo": min(w), "hi": max(w)}
    if dates:
        st["hist"] = [[d, round(v, 6)] for d, v in pairs[:HIST_N]]
    return st


# ---------------------------------------------------------------- ECB
ECB_CCY = {"GRU": "BRL", "LON": "GBP", "FRA": "USD", "ZRH": "CHF", "JNB": "ZAR",
           "BOM": "INR", "SHA": "CNY", "TYO": "JPY", "SYD": "AUD"}


def fetch_ecb():
    z = zipfile.ZipFile(io.BytesIO(get("https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist.zip")))
    name = [n for n in z.namelist() if n.endswith(".csv")][0]
    rows = list(csv.DictReader(io.StringIO(z.read(name).decode("utf-8"))))
    rows = [r for r in rows if r.get("Date")]
    rows.sort(key=lambda r: r["Date"], reverse=True)   # newest first
    out = {}
    for hub, ccy in ECB_CCY.items():
        series = []
        for r in rows[:300]:
            try:
                series.append(float(r[ccy]))
            except (KeyError, ValueError):
                series.append(None)
        st = range_stats(series, [r["Date"] for r in rows[:300]])
        if st:
            st["asof"] = rows[0]["Date"]
            out[hub] = st
    if not out:
        raise RuntimeError("ECB: no series parsed")
    return out


# ---------------------------------------------------------------- Treasury 10Y
def fetch_ust():
    vals = []  # (date, yield)
    y = date.today().year
    for yr in (y, y - 1):
        url = ("https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml"
               "?data=daily_treasury_yield_curve&field_tdr_date_value=%d" % yr)
        txt = get(url, 90).decode("utf-8", "replace")
        for ent in txt.split("<entry>")[1:]:
            d = re.search(r"<d:NEW_DATE[^>]*>([^<]+)<", ent)
            v = re.search(r"<d:BC_10YEAR[^>]*>([^<]+)<", ent)
            if d and v:
                try:
                    vals.append((d.group(1)[:10], float(v.group(1))))
                except ValueError:
                    pass
    if len(vals) < 2:
        raise RuntimeError("Treasury: no 10Y rows parsed")
    vals.sort(reverse=True)
    series = [v for _, v in vals[:260]]
    cur, prev = series[0], series[1]
    return {"price": cur, "chg": (cur - prev) * 100, "chg_unit": "bp",   # basis points
            "lo": min(series), "hi": max(series), "asof": vals[0][0],
            "hist": [[d, v] for d, v in vals[:HIST_N]]}


# ---------------------------------------------------------------- EIA
def fetch_eia():
    key = os.environ.get("EIA_API_KEY", "").strip()
    if not key:
        raise RuntimeError("EIA_API_KEY not set (free key at eia.gov/opendata)")
    q = [("api_key", key), ("frequency", "daily"), ("data[0]", "value"),
         ("facets[series][]", "RWTC"), ("facets[series][]", "RBRTE"),
         ("sort[0][column]", "period"), ("sort[0][direction]", "desc"), ("length", "1200")]
    url = "https://api.eia.gov/v2/petroleum/pri/spt/data/?" + urllib.parse.urlencode(q)
    rows = json.loads(get(url, 90))["response"]["data"]
    out = {}
    for hub, sid in (("HOU", "RWTC"), ("DXB", "RBRTE")):
        rr = sorted([r for r in rows if r.get("series") == sid and r.get("value") not in (None, "")],
                    key=lambda r: r["period"], reverse=True)
        st = range_stats([float(r["value"]) for r in rr], [r["period"] for r in rr])
        if st:
            st["asof"] = rr[0]["period"]
            out[hub] = st
    if not out:
        raise RuntimeError("EIA: no series parsed")
    return out


# ---------------------------------------------------------------- IMF PortWatch
CHOKES = [  # (key, lat, lon, label, substrings to match portname)
    ("HRM", 26.5, 56.3, "Strait of Hormuz", ["hormuz"]),
    ("BAB", 12.6, 43.3, "Bab el-Mandeb", ["mandeb"]),
    ("SUZ", 30.0, 32.5, "Suez Canal", ["suez"]),
    ("MAL", 2.5, 101.5, "Strait of Malacca", ["malacca"]),
    ("PAN", 9.1, -79.7, "Panama Canal", ["panama"]),
    ("CAP", -34.4, 18.5, "Cape of Good Hope", ["cape of good hope"]),
]
PW = "https://services9.arcgis.com/weJ1QsnbMYJlCHdG/ArcGIS/rest/services/Daily_Chokepoints_Data/FeatureServer/0/query"


PW_VARIANTS = [PW, PW.replace("/ArcGIS/", "/arcgis/")]
_pw_good = [None]


def _pw(q):
    q = dict(q)
    errs = []
    order = [_pw_good[0]] if _pw_good[0] is not None else range(len(PW_VARIANTS))
    for i in order:
        for attempt in range(4):
            if attempt:
                time.sleep(4 * attempt)
            try:
                js = json.loads(get(PW_VARIANTS[i] + "?" + urllib.parse.urlencode(q), 90))
            except Exception as e:
                errs.append("v%d a%d: %s" % (i, attempt, str(e)[:80]))
                continue
            if "error" in js:
                errs.append("v%d a%d %s: %s" % (i, attempt, q.get("outFields"), json.dumps(js["error"])[:160]))
                continue
            _pw_good[0] = i
            return js.get("features", [])
    raise RuntimeError("PortWatch all variants failed: " + " | ".join(errs))


def fetch_portwatch():
    # Step 1: list distinct chokepoints (no LIKE / percent signs, which this server's URL filter may reject)
    probe = date.today() - timedelta(days=21)
    names = _pw({"where": "year = %d AND month = %d AND day = %d" % (probe.year, probe.month, probe.day),
                 "outFields": "portid,portname", "returnGeometry": "false", "f": "json"})
    ids = {}
    for f in names:
        a = f["attributes"]
        nm = (a.get("portname") or "").lower()
        if any(s in nm for c in CHOKES for s in c[4]):
            ids[a["portid"]] = a.get("portname")
    if not ids:
        raise RuntimeError("PortWatch: no matching chokepoint names in %d distinct rows" % len(names))
    # Step 2: pull recent rows by portid and integer year (no date literals)
    year_from = date.today().year - 2
    idlist = ",".join("'%s'" % i for i in ids)
    rows, offset = [], 0
    while True:
        feats = _pw({"where": "portid IN (%s) AND year >= %d" % (idlist, year_from),
                     "outFields": "*", "returnGeometry": "false", "f": "json",
                     "resultOffset": str(offset), "resultRecordCount": "1000"})
        for f in feats:
            r = f["attributes"]
            if r.get("n_total") is None:
                parts = [r.get(k) for k in ("n_container", "n_dry_bulk", "n_general_cargo", "n_roro", "n_tanker")]
                r["n_total"] = sum(x for x in parts if isinstance(x, (int, float))) if any(isinstance(x, (int, float)) for x in parts) else None
            rows.append(r)
        if len(feats) < 1000 or offset > 20000:
            break
        offset += 1000
    out = []
    for key, lat, lon, label, subs in CHOKES:
        mine = [r for r in rows if any(s in (r.get("portname") or "").lower() for s in subs)]
        if not mine:
            continue

        def dstr(r):
            d = r["date"]
            return (datetime.fromtimestamp(d / 1000, timezone.utc).date().isoformat()
                    if isinstance(d, (int, float)) else str(d)[:10])
        by = {}
        for r in mine:
            if r.get("n_total") is not None:
                by[dstr(r)] = r["n_total"]
        days = sorted(by, reverse=True)
        if len(days) < 14:
            continue
        last7 = [by[d] for d in days[:7]]
        base_year = str(date.today().year - 1)
        base_vals = [v for d, v in by.items() if d.startswith(base_year)]
        base = statistics.mean(base_vals) if len(base_vals) > 60 else statistics.mean([by[d] for d in days[28:]] or last7)
        avg7 = statistics.mean(last7)
        out.append({"id": key, "name": label, "lat": lat, "lon": lon, "latest": by[days[0]],
                    "avg7": round(avg7, 1), "base": round(base, 1),
                    "ratio": round(avg7 / base, 3) if base else None, "asof": days[0],
                    "baseline_note": "mean of %s" % base_year if len(base_vals) > 60 else "trailing mean"})
    if not out:
        raise RuntimeError("PortWatch: no chokepoints parsed")
    return out


# ---------------------------------------------------------------- Treasury TIC (major foreign holders)
TIC_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tic.json")
TIC_URLS = ["https://ticdata.treasury.gov/resource-center/data-chart-center/tic/Documents/mfh.txt",
            "https://ticdata.treasury.gov/Publish/mfh.txt"]
MONTHS = {m: i + 1 for i, m in enumerate("Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split())}
TIC_MAP = {"TYO": ["Japan"], "LON": ["United Kingdom"], "SHA": ["China, Mainland"],
           "FRA": ["France", "Belgium", "Luxembourg", "Ireland"], "DXB": ["Saudi Arabia"],
           "SIN": ["Singapore"], "BOM": ["India"], "GRU": ["Brazil"], "ZRH": ["Switzerland"]}


def _num(tok):
    try:
        return float(tok.replace(",", ""))
    except ValueError:
        return None


def parse_mfh(text):
    """Parse Treasury's 'Major Foreign Holders' text table (newest month first).
    Returns {"asof": "YYYY-MM-DD", "label": "Mon YYYY", "holders": {hub: [latest, prior, six_months_before]}}.
    Raises ValueError on anything unexpected, so the caller keeps the previous file."""
    months = years = None
    rows = {}
    for ln in text.splitlines():
        toks = ln.split()
        if not toks:
            continue
        if months is None:
            if len(toks) >= 8 and all(t in MONTHS for t in toks):
                months = toks
            continue
        if years is None:
            if toks[0] == "Country" and len(toks) > len(months) and all(t.isdigit() for t in toks[1:len(months) + 1]):
                years = toks[1:len(months) + 1]
            continue
        nums = []
        while toks and _num(toks[-1]) is not None:
            nums.append(_num(toks.pop()))
        nums.reverse()
        if toks and len(nums) >= len(months):
            rows[" ".join(toks)] = nums[:len(months)]
    if months is None or years is None or not rows:
        raise ValueError("TIC: header or country rows not found")
    y0, m0, y1, m1 = int(years[0]), MONTHS[months[0]], int(years[1]), MONTHS[months[1]]
    if (y0, m0) <= (y1, m1):
        raise ValueError("TIC: columns are not newest-first")
    holders = {}
    for hub, names in TIC_MAP.items():
        series = []
        for nm in names:
            if nm not in rows or len(rows[nm]) < 7:
                raise ValueError("TIC: missing country %s" % nm)
            series.append(rows[nm])
        trip = [round(sum(s[i] for s in series), 1) for i in (0, 1, 6)]
        if not all(0 < v < 4000 for v in trip):
            raise ValueError("TIC: implausible value for %s: %s" % (hub, trip))
        holders[hub] = trip
    nxt = date(y0 + (m0 == 12), m0 % 12 + 1, 1)
    return {"asof": (nxt - timedelta(days=1)).isoformat(),
            "label": "%s %d" % (months[0], y0), "holders": holders}


def fetch_tic():
    """Refresh tic.json when Treasury has published a newer month. Returns a short status string."""
    best, errs = None, []
    for url in TIC_URLS:
        try:
            p = parse_mfh(get(url, 60).decode("utf-8", "replace"))
            if best is None or p["asof"] > best["asof"]:
                best = p
        except Exception as e:
            errs.append("%s: %s" % (url.rsplit("/", 2)[-2], str(e)[:80]))
    if best is None:
        raise RuntimeError("TIC fetch/parse failed: " + " | ".join(errs))
    try:
        with open(TIC_PATH, encoding="utf-8") as f:
            cur = json.load(f)
    except Exception:
        cur = {}
    if cur.get("asof", "") >= best["asof"]:
        return "tic up to date (%s)" % cur.get("asof")
    cur.update({"label": best["label"], "asof": best["asof"], "holders": best["holders"]})
    cur.setdefault("max_age_days", 100)
    with open(TIC_PATH, "w", encoding="utf-8") as f:
        json.dump(cur, f, indent=1, ensure_ascii=False)
    return "tic updated to %s" % best["label"]


# ---------------------------------------------------------------- main
def main():
    prev = load_prev()
    data = {"generated_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "hubs": dict(prev.get("hubs", {})), "chokepoints": prev.get("chokepoints", []),
            "status": {}}
    jobs = [("ecb", fetch_ecb), ("ust", fetch_ust), ("eia", fetch_eia), ("portwatch", fetch_portwatch), ("tic", fetch_tic)]
    ok = 0
    for name, fn in jobs:
        try:
            res = fn()
            if name == "ecb":
                for k, v in res.items(): data["hubs"][k] = {**v, "src": "ecb"}
            elif name == "ust":
                data["hubs"]["NYC"] = {**res, "src": "ust"}
            elif name == "eia":
                for k, v in res.items(): data["hubs"][k] = {**v, "src": "eia"}
            elif name == "portwatch":
                data["chokepoints"] = res
            # "tic" writes tic.json itself
            data["status"][name] = {"ok": True, "ran_utc": data["generated_utc"]}
            if name != "tic":
                ok += 1
            print("ok  ", name, res if name == "tic" else "")
        except Exception as e:                      # keep previous values; page will age them out
            data["status"][name] = {"ok": False, "error": str(e)[:200],
                                    "last_ok_utc": prev.get("status", {}).get(name, {}).get("last_ok_utc") or
                                                   prev.get("status", {}).get(name, {}).get("ran_utc")}
            print("FAIL", name, e, file=sys.stderr)
        if data["status"][name]["ok"]:
            data["status"][name]["last_ok_utc"] = data["generated_utc"]
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=1, ensure_ascii=False)
    if ok == 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
