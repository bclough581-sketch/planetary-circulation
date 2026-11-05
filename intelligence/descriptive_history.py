"""Descriptive, non-predictive audit of historical oil spreads and Treasury yields.

Observation-date alignment does not prove trade-time availability.
"""
import argparse
import json
import math
from pathlib import Path


def descriptive_report(panel):
    if panel.get("schema") != "amalgam.cross-domain-observation-panel.v1":
        raise ValueError("unsupported panel schema")
    if panel.get("predictive_advantage") != "not_established" or panel.get("publication_time_verified") is not False:
        raise ValueError("unsupported predictive or publication claim")
    rows = panel.get("observations")
    if not isinstance(rows, list) or not rows:
        raise ValueError("no historical observations")
    dates = [row["date"] for row in rows]
    if dates != sorted(set(dates)):
        raise ValueError("observations must be sorted by unique dates")
    spreads = []
    yields = []
    for row in rows:
        values = [row.get("wti_usd_per_barrel"), row.get("brent_usd_per_barrel"),
                  row.get("treasury_10y_percent")]
        if any(isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) for v in values):
            raise ValueError("invalid numeric observation")
        wti, brent, treasury = values
        if not (0 < wti < 10000 and 0 < brent < 10000 and 0 <= treasury <= 100):
            raise ValueError("out-of-range observation")
        spreads.append(round(brent - wti, 6))
        yields.append(treasury)
    return {
        "schema": "amalgam.descriptive-historical-research.v1",
        "status": "descriptive_only",
        "matched_dates": len(rows),
        "first_date": dates[0],
        "last_date": dates[-1],
        "brent_minus_wti_usd_per_barrel": {
            "minimum": min(spreads), "maximum": max(spreads),
            "mean": round(sum(spreads) / len(spreads), 4),
            "positive_dates": sum(value > 0 for value in spreads),
            "zero_dates": sum(value == 0 for value in spreads),
            "negative_dates": sum(value < 0 for value in spreads),
        },
        "treasury_10y_percent": {
            "minimum": min(yields), "maximum": max(yields),
            "mean": round(sum(yields) / len(yields), 4),
        },
        "asof_eligible_dates": 0,
        "relationships": [],
        "predictive_advantage": "not_established",
        "warning": "Descriptive statistics only. Observation dates are not authenticated publication timestamps; no predictive lift, causation, or tradability is inferred.",
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--panel", required=True)
    parser.add_argument("--output", default="descriptive-historical-research.json")
    args = parser.parse_args()
    panel = json.loads(Path(args.panel).read_text(encoding="utf-8"))
    result = descriptive_report(panel)
    Path(args.output).write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
