#!/usr/bin/env python3
"""Daily self-check of data.json and tic.json. Exit 1 on any problem so bad numbers are never published.
Bounds are deliberately wide: they catch broken parsers (wrong units, empty series, a currency
quoted upside down), not unusual markets."""
import json, os, sys
from datetime import date, datetime, timedelta, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
BOUNDS = {  # hub: (min, max) of the headline reading
    "NYC": (0.01, 25), "HOU": (1, 400), "DXB": (1, 400),
    "FRA": (0.3, 3), "LON": (0.3, 2), "ZRH": (0.5, 2), "GRU": (2, 15), "JNB": (8, 40),
    "BOM": (40, 200), "SHA": (3, 20), "TYO": (80, 300), "SYD": (1, 3)}
MAX_ABS_CHG = 60          # percent (basis points for the 10-year)


def _d(s):
    return date.fromisoformat(s)


def check(data, tic, now=None, max_age_hours=36):
    now = now or datetime.now(timezone.utc)
    bad = []
    try:
        gen = datetime.strptime(data["generated_utc"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
        if now - gen > timedelta(hours=max_age_hours):
            bad.append("data.json is older than %dh" % max_age_hours)
    except Exception:
        bad.append("generated_utc missing or malformed")
    hubs = data.get("hubs", {})
    for h, (lo_b, hi_b) in BOUNDS.items():
        v = hubs.get(h)
        if not v:
            bad.append("hub %s missing" % h)
            continue
        try:
            p, lo, hi, chg = float(v["price"]), float(v["lo"]), float(v["hi"]), float(v["chg"])
            if not lo_b <= p <= hi_b:
                bad.append("%s price %s outside plausible %s-%s" % (h, p, lo_b, hi_b))
            if not (0 < lo <= p * (1 + 1e-9) and p <= hi * (1 + 1e-9) and hi / lo < 20):
                bad.append("%s range inconsistent (lo %s, price %s, hi %s)" % (h, lo, p, hi))
            if abs(chg) > MAX_ABS_CHG:
                bad.append("%s move %s is implausibly large" % (h, chg))
            if _d(v["asof"]) > now.date() + timedelta(days=1):
                bad.append("%s as-of date is in the future" % h)
            hist = v.get("hist")
            if hist is not None:
                ds = [_d(x[0]) for x in hist]
                if len(hist) < 20 or ds != sorted(ds, reverse=True) or len(set(ds)) != len(ds):
                    bad.append("%s history is too short or not newest-first" % h)
                if any(not lo_b <= float(x[1]) <= hi_b for x in hist):
                    bad.append("%s history has an implausible value" % h)
        except Exception as e:
            bad.append("hub %s malformed (%s)" % (h, e))
    for c in data.get("chokepoints", []):
        try:
            r = c.get("ratio")
            if r is not None and not 0 <= float(r) <= 5:
                bad.append("chokepoint %s ratio %s implausible" % (c.get("id"), r))
            if min(float(c["latest"]), float(c["avg7"]), float(c["base"])) < 0:
                bad.append("chokepoint %s has negative counts" % c.get("id"))
            _d(c["asof"])
        except Exception as e:
            bad.append("chokepoint %s malformed (%s)" % (c.get("id"), e))
    try:
        for h, trip in tic["holders"].items():
            if len(trip) != 3 or not all(0 < float(x) < 4000 for x in trip):
                bad.append("TIC %s implausible: %s" % (h, trip))
        if _d(tic["asof"]) > now.date():
            bad.append("TIC as-of is in the future")
    except Exception as e:
        bad.append("tic.json malformed (%s)" % e)
    return bad


def main():
    with open(os.path.join(HERE, "data.json"), encoding="utf-8") as f:
        data = json.load(f)
    with open(os.path.join(HERE, "tic.json"), encoding="utf-8") as f:
        tic = json.load(f)
    bad = check(data, tic)
    for b in bad:
        print("CHECK FAILED:", b, file=sys.stderr)
    print("self-check:", "FAILED (%d)" % len(bad) if bad else "all checks passed")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
