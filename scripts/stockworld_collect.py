#!/usr/bin/env python3
"""
stockworld_collect.py - real daily data for Amalgam Stock World (PRIVATE, personal use only).

Pulls daily prices for the 11 sector ETFs and 5 large members of each from Yahoo Finance's
public chart endpoint, and writes stockworld-data.js next to this script. stock-world.html in
the same folder picks it up automatically and switches the Board from SAMPLE to LIVE.

Yahoo data is for personal use: do NOT publish stockworld-data.js or put it on GitHub Pages.

Run:       python stockworld_collect.py
Schedule:  schtasks /create /tn "StockWorldLog" /sc daily /st 18:35 /tr "<python.exe> <this file>"
Stdlib only. Safe to re-run.
"""
import json
import os
import sys
import time
import urllib.request
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "stockworld-data.js")

# sector id (matches stock-world.html) -> (ETF, large members; top holdings as of mid-2026, edit freely)
SECTORS = {
    "tech":   ("XLK",  ["AAPL", "MSFT", "NVDA", "AVGO", "ORCL"]),
    "fin":    ("XLF",  ["JPM", "V", "MA", "BAC", "WFC"]),
    "health": ("XLV",  ["LLY", "UNH", "JNJ", "ABBV", "MRK"]),
    "energy": ("XLE",  ["XOM", "CVX", "COP", "EOG", "SLB"]),
    "ind":    ("XLI",  ["GE", "CAT", "RTX", "UNP", "HON"]),
    "cyc":    ("XLY",  ["AMZN", "TSLA", "HD", "MCD", "LOW"]),
    "def":    ("XLP",  ["WMT", "COST", "PG", "KO", "PEP"]),
    "util":   ("XLU",  ["NEE", "SO", "DUK", "CEG", "AEP"]),
    "mat":    ("XLB",  ["LIN", "SHW", "APD", "ECL", "FCX"]),
    "re":     ("XLRE", ["PLD", "AMT", "EQIX", "WELL", "SPG"]),
    "comm":   ("XLC",  ["META", "GOOGL", "NFLX", "DIS", "TMUS"]),
}


def chart(t):
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{t}?range=1y&interval=1d"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        j = json.loads(r.read().decode("utf-8"))
    res = j["chart"]["result"][0]
    q = res["indicators"]["quote"][0]
    rows = [(ts, c, v) for ts, c, v in zip(res["timestamp"], q["close"], q["volume"]) if c is not None]
    meta = res.get("meta", {})
    return rows, (meta.get("longName") or meta.get("shortName") or t)


def rsi14(closes):
    if len(closes) < 15:
        return None
    gains = losses = 0.0
    for a, b in zip(closes[-15:-1], closes[-14:]):
        d = b - a
        gains += max(d, 0)
        losses += max(-d, 0)
    if losses == 0:
        return 100.0
    rs = (gains / 14) / (losses / 14)
    return 100 - 100 / (1 + rs)


def stats(t):
    rows, name = chart(t)
    c = [r[1] for r in rows]
    v = [r[2] or 0 for r in rows]
    if len(c) < 30:
        raise ValueError("short history")
    last, prev = c[-1], c[-2]
    lo, hi = min(c), max(c)
    avg20v = sum(v[-21:-1]) / 20 or 1
    return {
        "t": t, "name": name,
        "price": round(last, 2),
        "day": round((last / prev - 1) * 100, 2),
        "yr": round((last / c[0] - 1) * 100, 2),
        "range": round((last - lo) / (hi - lo), 3) if hi > lo else 0.5,
        "rv": round(v[-1] / avg20v, 2),
        "rsi": round(rsi14(c) or 50, 1),
        "dv": round(last * avg20v / 1e6, 1),  # avg daily dollar volume, $M (tile size)
        "spark": [round(x, 2) for x in c[-60:]],
        "asof": datetime.fromtimestamp(rows[-1][0], timezone.utc).date().isoformat(),
    }


def main():
    out, bad = {"sectors": {}, "made": datetime.now(timezone.utc).isoformat(timespec="minutes")}, []
    for sid, (etf, members) in SECTORS.items():
        sec = {"etf": None, "co": []}
        for t in [etf] + members:
            try:
                s = stats(t)
                if t == etf:
                    sec["etf"] = s
                else:
                    sec["co"].append(s)
            except Exception as e:
                bad.append(f"{t}({e.__class__.__name__})")
            time.sleep(0.4)
        if sec["etf"] and sec["co"]:
            out["sectors"][sid] = sec
    if not out["sectors"]:
        sys.exit("FAIL: no data pulled. " + " ".join(bad))
    out["asof"] = max(s["etf"]["asof"] for s in out["sectors"].values())
    with open(OUT, "w", encoding="utf-8") as f:
        f.write("window.SW_DATA=" + json.dumps(out, separators=(",", ":")) + ";\n")
    n = sum(1 + len(s["co"]) for s in out["sectors"].values())
    print(f"OK  : {len(out['sectors'])} sectors, {n} tickers, as of {out['asof']} -> {OUT}")
    print("FAIL:", " ".join(bad) if bad else "none")


if __name__ == "__main__":
    main()
