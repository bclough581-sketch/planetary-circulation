"""Fetch current EIA series into a development-only research snapshot.

Does not change data.json, production, or the convergence evidence gate.
"""
import json
import os
from datetime import datetime, timezone, date
from pathlib import Path
from fetch_data import fetch_eia


def validate_dates(series, today=None):
    today = today or datetime.now(timezone.utc).date()
    for hub in ('HOU', 'DXB'):
        if hub not in series:
            raise ValueError(f'Missing EIA hub {hub}')
        try:
            observed = date.fromisoformat(series[hub]['asof'])
        except (KeyError, ValueError, TypeError) as exc:
            raise ValueError(f'Invalid EIA observation date for {hub}') from exc
        age = (today - observed).days
        if not 0 <= age <= 7:
            raise ValueError(f'EIA {hub} outside 7-day freshness window: {age} days')


def build():
    series = fetch_eia()
    required = ("HOU", "DXB")
    missing = [hub for hub in required if hub not in series]
    if missing:
        raise RuntimeError("Missing EIA hubs: " + ", ".join(missing))
    validate_dates(series)
    return {
        "generated_utc": datetime.now(timezone.utc).isoformat(),
        "source": "U.S. Energy Information Administration",
        "source_url": "https://www.eia.gov/opendata/",
        "status": "research_only",
        "hubs": {hub: {**series[hub], "src": "eia"} for hub in required},
        "note": "Published observation date is independent of retrieval date.",
    }


if __name__ == "__main__":
    if not os.environ.get("EIA_API_KEY"):
        raise SystemExit("EIA_API_KEY required")
    result = build()
    Path("eia-research-snapshot.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps({"hubs": {hub: row["asof"] for hub, row in result["hubs"].items()},
                      "status": result["status"]}, indent=2))
