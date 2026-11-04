"""Build an auditable, non-predictive JSON research view."""
import json
from pathlib import Path
from .assemble import assemble


def build(snapshot, alerts, now=None):
    result = assemble(snapshot, alerts, now)
    domains = ("weather", "geopolitics", "maritime", "aviation", "energy",
               "commodities", "economics", "markets", "corporate")
    counts = {domain: 0 for domain in domains}
    for event in result["observations"]:
        counts[event["domain"]] += 1
    return {
        "schema": "amalgam.research.v1",
        "generated_from": snapshot.get("generated_utc"),
        "domains": counts,
        "observations": result["observations"],
        "excluded": result["excluded"],
        "relationships": [],
        "predictive_advantage": "not_established",
        "message": "This view displays source observations only; no relationship or trading edge has been validated.",
    }


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--snapshot", default="data.json")
    parser.add_argument("--alerts", required=True, help="NOAA GeoJSON file; never substitute synthetic alerts in production")
    parser.add_argument("--output", default="research-view.json")
    args = parser.parse_args()
    snapshot = json.loads(Path(args.snapshot).read_text(encoding="utf-8"))
    alerts = json.loads(Path(args.alerts).read_text(encoding="utf-8"))
    Path(args.output).write_text(json.dumps(build(snapshot, alerts), indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
