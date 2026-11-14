"""Join independently sourced historical energy and Treasury observations.

Research-only: exact observation-date matching, NOT point-in-time availability.
"""
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from .eia_history import aligned_price_dates


def build(energy, treasury):
    if energy.get("schema") != "amalgam.eia-history.v1":
        raise ValueError("unrecognized EIA history schema")
    if treasury.get("schema") != "amalgam.treasury-history.v1":
        raise ValueError("unrecognized Treasury history schema")
    if energy.get("predictive_advantage") != "not_established" or treasury.get("predictive_advantage") != "not_established":
        raise ValueError("source contains unsupported predictive claim")
    prices = aligned_price_dates(energy["observations"])
    yields = {}
    for record in treasury["observations"]:
        day = record["date"]
        rate = float(record["ten_year_yield_percent"])
        if day in yields and yields[day] != rate:
            raise ValueError("conflicting Treasury yields for aligned date")
        yields[day] = rate
    matched = [
        {"date": row["date"], "wti_usd_per_barrel": row["wti"],
         "brent_usd_per_barrel": row["brent"],
         "treasury_10y_percent": yields[row["date"]]}
        for row in prices if row["date"] in yields
    ]
    if not matched:
        raise ValueError("no common dates across independent sources")
    return {
        "schema": "amalgam.cross-domain-observation-panel.v1",
        "generated_utc": datetime.now(timezone.utc).isoformat(),
        "source_artifacts": [
            {"schema": energy["schema"], "source": energy["source"],
             "source_url": energy["source_url"], "retrieved_utc": energy["retrieved_utc"]},
            {"schema": treasury["schema"], "source": treasury["source"],
             "source_url": treasury["source_url"], "retrieved_utc": treasury["retrieved_utc"]}
        ],
        "alignment": "exact_observation_date_only",
        "publication_time_verified": False,
        "point_in_time_tradability": "not_established",
        "observations": matched,
        "relationships": [],
        "predictive_advantage": "not_established",
        "warning": "Observation dates are not publication timestamps. Do not use this panel as an as-of trading backtest."
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--energy", type=Path, required=True)
    parser.add_argument("--treasury", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path("cross-domain-observation-panel.json"))
    args = parser.parse_args()
    result = build(json.loads(args.energy.read_text()), json.loads(args.treasury.read_text()))
    args.output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print("Cross-domain matched observation dates:", len(result["observations"]))


if __name__ == "__main__":
    main()
