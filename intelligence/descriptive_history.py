"""Descriptive, non-predictive audit of historical oil spreads and Treasury yields.

Observation-date alignment does not prove trade-time availability.
"""
import argparse
import json
import math
import statistics
from datetime import date
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
    if any(not isinstance(day, str) or date.fromisoformat(day).isoformat() != day for day in dates):
        raise ValueError("invalid or noncanonical observation date")
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
            "median": round(statistics.median(spreads), 4),
            "standard_deviation": round(statistics.stdev(spreads), 4) if len(spreads) > 1 else None,
            "positive_dates": sum(value > 0 for value in spreads),
            "zero_dates": sum(value == 0 for value in spreads),
            "negative_dates": sum(value < 0 for value in spreads),
        },
        "treasury_10y_percent": {
            "minimum": min(yields), "maximum": max(yields),
            "mean": round(sum(yields) / len(yields), 4),
            "median": round(statistics.median(yields), 4),
            "standard_deviation": round(statistics.stdev(yields), 4) if len(yields) > 1 else None,
        },
        "asof_eligible_dates": 0,
        "relationships": [],
        "predictive_advantage": "not_established",
        "warning": "Descriptive statistics only. Standard deviation measures historical dispersion, not forecast risk. Observation dates are not authenticated publication timestamps; no predictive lift, causation, or tradability is inferred.",
    }


def verify_descriptive_report(panel, report):
    """Check a separately downloaded report against a retained source panel."""
    if not isinstance(report, dict) or report != descriptive_report(panel):
        raise ValueError("descriptive report does not match the source panel")
    return {"status": "verified_against_supplied_panel",
            "matched_dates": report["matched_dates"],
            "predictive_advantage": "not_established",
            "warning": "The supplied panel must be authenticated separately. This does not establish historical availability or predictive lift."}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--panel", required=True)
    parser.add_argument("--output", default="descriptive-historical-research.json")
    parser.add_argument("--verify-report", help="Verify an existing descriptive JSON report against the supplied panel")
    args = parser.parse_args()
    panel = json.loads(Path(args.panel).read_text(encoding="utf-8"))
    result = (verify_descriptive_report(panel, json.loads(Path(args.verify_report).read_text(encoding="utf-8")))
              if args.verify_report else descriptive_report(panel))
    if not args.verify_report:
        Path(args.output).write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
