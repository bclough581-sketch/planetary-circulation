"""Diagnose EIA response freshness without changing production collectors."""
import json
import os
import urllib.parse
import urllib.request
from datetime import datetime, timezone


def latest_spot_dates(api_key, opener=urllib.request.urlopen):
    if not api_key:
        return {"status": "unavailable", "reason": "EIA_API_KEY not supplied"}
    q = [
        ("api_key", api_key), ("frequency", "daily"), ("data[0]", "value"),
        ("facets[series][]", "RWTC"), ("facets[series][]", "RBRTE"),
        ("sort[0][column]", "period"), ("sort[0][direction]", "desc"),
        ("length", "200"),
    ]
    url = "https://api.eia.gov/v2/petroleum/pri/spt/data/?" + urllib.parse.urlencode(q)
    req = urllib.request.Request(url, headers={"User-Agent": "Amalgam research diagnostic"})
    with opener(req, timeout=25) as response:
        payload = json.load(response)
    rows = payload.get("response", {}).get("data", [])
    latest = {}
    for sid in ("RWTC", "RBRTE"):
        dates = [r.get("period") for r in rows if r.get("series") == sid and r.get("value") not in (None, "")]
        latest[sid] = max(dates) if dates else None
    return {"status": "checked", "latest_by_series": latest,
            "checked_utc": datetime.now(timezone.utc).isoformat(),
            "note": "Publication lag is distinct from collector failure. No fallback data invented."}


if __name__ == "__main__":
    print(json.dumps(latest_spot_dates(os.environ.get("EIA_API_KEY", "")), indent=2))
