"""Audit exact-date coverage and exclusions in the historical research panel."""
import argparse
import json
from pathlib import Path


def coverage_report(energy, treasury, panel):
    if (energy.get("predictive_advantage") != "not_established" or
        treasury.get("predictive_advantage") != "not_established" or
        panel.get("predictive_advantage") != "not_established"):
        raise ValueError("unexpected predictive advantage claim")
    dates = {"RWTC": set(), "RBRTE": set()}
    for item in energy["observations"]:
        series, date = item["series"], item["date"]
        if series not in dates or date in dates[series]:
            raise ValueError("unknown series or duplicate energy series-date")
        dates[series].add(date)
    treasury_dates = set()
    for item in treasury["observations"]:
        date = item["date"]
        if date in treasury_dates:
            raise ValueError("duplicate Treasury date")
        treasury_dates.add(date)
    oil_pair = dates["RWTC"] & dates["RBRTE"]
    exact = oil_pair & treasury_dates
    panel_dates = [item["date"] for item in panel["observations"]]
    if len(panel_dates) != len(set(panel_dates)) or set(panel_dates) != exact:
        raise ValueError("panel dates do not equal exact three-series intersection")
    return {
        "schema": "amalgam.historical-coverage-audit.v1",
        "series_counts": {"wti": len(dates["RWTC"]), "brent": len(dates["RBRTE"]),
                          "treasury_10y": len(treasury_dates)},
        "paired_oil_dates": len(oil_pair),
        "exact_three_series_dates": len(exact),
        "wti_without_brent": sorted(dates["RWTC"] - dates["RBRTE"]),
        "brent_without_wti": sorted(dates["RBRTE"] - dates["RWTC"]),
        "paired_oil_without_treasury": sorted(oil_pair - treasury_dates),
        "treasury_without_paired_oil": sorted(treasury_dates - oil_pair),
        "first_aligned_date": min(exact) if exact else None,
        "last_aligned_date": max(exact) if exact else None,
        "predictive_advantage": "not_established",
        "warning": "Exact-date coverage only; does not establish publication timing, independence, or tradable edge.",
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--energy", required=True)
    parser.add_argument("--treasury", required=True)
    parser.add_argument("--panel", required=True)
    parser.add_argument("--output", default="historical-coverage-audit.json")
    args = parser.parse_args()
    read = lambda name: json.loads(Path(name).read_text(encoding="utf-8"))
    result = coverage_report(read(args.energy), read(args.treasury), read(args.panel))
    Path(args.output).write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
