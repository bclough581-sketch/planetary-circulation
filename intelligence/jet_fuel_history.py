"""Monthly Gulf Coast jet-fuel spot context, not airline purchase costs."""
import argparse
import json
import math
import os
import re
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ENDPOINT = "https://api.eia.gov/v2/petroleum/pri/spt/data/"
SERIES = "EER_EPJK_PF4_RGC_DPG"
SOURCE = "https://www.eia.gov/dnav/pet/hist/eer_epjk_pf4_rgc_dpgM.htm"


def months(start, end):
    for value in (start, end):
        if not isinstance(value, str) or not re.fullmatch(r"[0-9]{4}-(0[1-9]|1[0-2])", value):
            raise ValueError("expected YYYY-MM")
        datetime.strptime(value, "%Y-%m")
    if start > end:
        raise ValueError("start after end")
    year, month = map(int, start.split("-"))
    result = []
    while f"{year:04d}-{month:02d}" <= end:
        result.append(f"{year:04d}-{month:02d}")
        year, month = (year + 1, 1) if month == 12 else (year, month + 1)
    return result


def build(start, end, key=None, fetch=None):
    expected = months(start, end)
    key = key or os.environ.get("EIA_API_KEY", "").strip()
    if not key:
        raise ValueError("EIA_API_KEY required")
    query = {"api_key": key, "frequency": "monthly", "data[0]": "value",
             "facets[series][]": SERIES, "start": start, "end": end,
             "sort[0][column]": "period", "sort[0][direction]": "asc", "length": "5000"}
    if fetch is None:
        def fetch(url):
            try:
                with urllib.request.urlopen(url, timeout=45) as response:
                    return json.load(response)
            except Exception:
                # Request URLs contain a credential; never include them in logs.
                raise ValueError("EIA jet-fuel request failed") from None
    response = fetch(ENDPOINT + "?" + urllib.parse.urlencode(query)).get("response", {})
    rows = response.get("data")
    total = str(response.get("total", ""))
    if not isinstance(rows, list) or not total.isdigit() or int(total) != len(rows):
        raise ValueError("missing or truncated EIA response")
    values, excluded = {}, []
    for row in rows:
        period = row.get("period")
        if row.get("series") != SERIES or period not in expected:
            raise ValueError("unexpected series or period")
        if row.get("units") != "Dollars per Gallon":
            raise ValueError("unexpected jet-fuel unit")
        raw = row.get("value")
        try:
            value = float(raw)
        except (TypeError, ValueError):
            value = float("nan")
        if isinstance(raw, bool) or not math.isfinite(value) or value <= 0:
            excluded.append({"period": period, "reason": "missing_or_invalid_value"})
            continue
        if period in values and values[period] != value:
            raise ValueError("conflicting values for month")
        values[period] = value
    if not values:
        raise ValueError("no valid jet-fuel observations")
    return {"schema": "amalgam.jet-fuel-history.v1", "source_url": SOURCE,
            "source": "U.S. Energy Information Administration", "series": SERIES,
            "retrieved_utc": datetime.now(timezone.utc).isoformat(),
            "frequency": "monthly", "unit": "USD_per_gallon",
            "requested_start": start, "requested_end": end,
            "observations": [{"period": period, "value": value} for period, value in sorted(values.items())],
            "missing_months": [period for period in expected if period not in values], "excluded": excluded,
            "publication_time_verified": False, "predictive_advantage": "not_established",
            "warning": "Regional spot benchmark, not airline realized fuel cost. No gap filling. Retrieval time does not establish historical availability. No airline margins or stock returns are supplied."}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--start", required=True)
    parser.add_argument("--end", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    result = build(args.start, args.end)
    args.output.write_text(json.dumps(result, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print("Jet-fuel months:", len(result["observations"]), "Missing:", len(result["missing_months"]))


if __name__ == "__main__":
    main()
