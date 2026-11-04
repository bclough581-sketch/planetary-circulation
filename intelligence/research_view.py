"""Build an auditable, non-predictive JSON research view."""
import json
from pathlib import Path
from .assemble import assemble
from .feed_audit import audit

DOMAINS = ("weather", "geopolitics", "maritime", "aviation", "energy",
           "commodities", "economics", "markets", "corporate")


def validate_view(view):
    """Fail closed when ring counts, evidence, or claim boundaries disagree."""
    if view.get("schema") != "amalgam.research.v1":
        raise ValueError("unsupported research schema")
    observations = view.get("observations")
    counts = view.get("domains")
    if not isinstance(observations, list) or not isinstance(counts, dict):
        raise ValueError("missing observations or domain counts")
    expected = {domain: 0 for domain in DOMAINS}
    seen = set()
    for event in observations:
        if not isinstance(event, dict) or event.get("domain") not in expected:
            raise ValueError("unknown observation domain")
        if not event.get("id") or event["id"] in seen:
            raise ValueError("missing or duplicate observation ID")
        seen.add(event["id"])
        if not isinstance(event.get("source"), dict) or not event["source"].get("url") or not event.get("observed_at"):
            raise ValueError("observation missing provenance")
        expected[event["domain"]] += 1
    if counts != expected:
        raise ValueError("domain counts disagree with evidence")
    if view.get("relationships") != [] or view.get("predictive_advantage") != "not_established":
        raise ValueError("unsupported convergence or predictive claim")
    return True


def build(snapshot, alerts, now=None):
    result = assemble(snapshot, alerts, now)
    counts = {domain: 0 for domain in DOMAINS}
    for event in result["observations"]:
        counts[event["domain"]] += 1
    view = {
        "schema": "amalgam.research.v1",
        "generated_from": snapshot.get("generated_utc"),
        "domains": counts,
        "observations": result["observations"],
        "excluded": result["excluded"],
        "feed_health": audit(snapshot, now),
        "licensing": {"portwatch_commercial_reuse": "permission_not_verified"},
        "relationships": [],
        "predictive_advantage": "not_established",
        "message": "This view displays source observations only; no relationship or trading edge has been validated. Feed health does not establish commercial reuse rights.",
    }
    validate_view(view)
    return view


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
