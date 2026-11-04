"""Research-only historical EIA WTI/Brent daily prices; no predictive claims.

Requires EIA_API_KEY. Does not write production data.json.
"""
import json
import os
import urllib.parse
import urllib.request
from datetime import date, datetime, timezone
from pathlib import Path

ENDPOINT = "https://api.eia.gov/v2/petroleum/pri/spt/data/"
SERIES = {"RWTC": "WTI_Cushing_USD_per_barrel", "RBRTE": "Brent_USD_per_barrel"}


def parse_rows(rows, start, end):
    start, end = date.fromisoformat(start), date.fromisoformat(end)
    if start > end:
        raise ValueError("start after end")
    by_key = {}
    for row in rows:
        sid = row.get("series")
        if sid not in SERIES:
            continue
        try:
            day = date.fromisoformat(row["period"])
            value = float(row["value"])
        except (KeyError, ValueError, TypeError):
            continue
        if not (start <= day <= end) or not (0 < value < 10000):
            continue
        key = (sid, day.isoformat())
        if key in by_key and by_key[key] != value:
            raise ValueError("conflicting EIA values for same series and date")
        by_key[key] = value
    return [{"date": day, "series": sid, "series_label": SERIES[sid], "value": value}
            for (sid, day), value in sorted(by_key.items(), key=lambda x: (x[0][1], x[0][0]))]


def build(start, end, key=None, fetch=None):
    date.fromisoformat(start)
    date.fromisoformat(end)
    if start > end:
        raise ValueError("start after end")
    key = key or os.environ.get("EIA_API_KEY", "").strip()
    if not key:
        raise ValueError("EIA_API_KEY required")
    query = [("api_key", key), ("frequency", "daily"), ("data[0]", "value"),
             ("facets[series][]", "RWTC"), ("facets[series][]", "RBRTE"),
             ("start", start), ("end", end),
             ("sort[0][column]", "period"), ("sort[0][direction]", "asc"),
             ("offset", "0"), ("length", "5000")]
    url = ENDPOINT + "?" + urllib.parse.urlencode(query)
    if fetch is None:
        def fetch(address):
            request = urllib.request.Request(address, headers={"User-Agent": "Amalgam research (GitHub planetary-circulation)"})
            with urllib.request.urlopen(request, timeout=45) as response:
                return json.load(response)
    payload = fetch(url)
    response = payload.get("response", {})
    rows = response.get("data")
    if not isinstance(rows, list):
        raise ValueError("EIA response missing data")
    total = response.get("total")
    if total is None:
        raise ValueError("EIA response missing pagination total")
    if int(total) > len(rows):
        raise ValueError("EIA history truncated; narrow date range")
    observations = parse_rows(rows, start, end)
    if not observations:
        raise ValueError("EIA returned no valid observations")
    return {"schema": "amalgam.eia-history.v1",
            "retrieved_utc": datetime.now(timezone.utc).isoformat(),
            "source": "U.S. Energy Information Administration",
            "source_url": "https://www.eia.gov/opendata/",
            "endpoint": ENDPOINT,
            "requested_start": start, "requested_end": end,
            "frequency": "daily", "unit": "USD_per_barrel",
            "observations": observations,
            "relationships": [], "predictive_advantage": "not_established",
            "warning": "Historical oil prices alone do not establish a cross-domain signal or tradable edge."}


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--start", required=True)
    parser.add_argument("--end", required=True)
    parser.add_argument("--output", type=Path, default=Path("eia-history-research.json"))
    args = parser.parse_args()
    result = build(args.start, args.end)
    args.output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print("Historical EIA observations:", len(result["observations"]))


if __name__ == "__main__":
    main()
