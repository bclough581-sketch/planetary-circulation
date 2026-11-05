"""Produce a conservative, human-readable audit of an AMALGAM research view."""
import argparse
import json
from collections import Counter
from pathlib import Path

from .research_view import validate_view


def summarize(view):
    validate_view(view)
    readiness = view["relationship_readiness"]
    exclusions = Counter(item["reason"] for item in view["excluded"])
    feeds = [
        {"feed": item["feed"], "condition": item["condition"],
         "collector_ok": item.get("collector_ok") is True}
        for item in view["feed_health"]
    ]
    return {
        "generated_utc": view["generated_utc"],
        "included_observations": len(view["observations"]),
        "excluded_observations": len(view["excluded"]),
        "domain_counts": view["domains"],
        "exclusion_reasons": dict(sorted(exclusions.items())),
        "feed_health": feeds,
        "historical_readiness": readiness["status"],
        "point_in_time_availability": readiness["point_in_time_availability"],
        "historical_candidate_review": readiness["historical_candidate_review"],
        "historical_candidate_block_reasons": readiness["historical_candidate_block_reasons"],
        "validated_relationships": len(view["relationships"]),
        "predictive_advantage": view["predictive_advantage"],
        "portwatch_commercial_reuse": view["licensing"]["portwatch_commercial_reuse"],
        "blocking_reasons": readiness["blocking_reasons"],
    }


def render_text(summary):
    lines = [
        "AMALGAM RESEARCH ARTIFACT AUDIT",
        "Generated (UTC): " + summary["generated_utc"],
        "Included observations: " + str(summary["included_observations"]),
        "Excluded observations: " + str(summary["excluded_observations"]),
        "Validated relationships: " + str(summary["validated_relationships"]),
        "Predictive advantage: " + summary["predictive_advantage"],
        "Point-in-time availability: " + summary["point_in_time_availability"],
        "Historical readiness: " + summary["historical_readiness"],
        "PortWatch commercial reuse: " + summary["portwatch_commercial_reuse"],
    ]
    for label, mapping in (
        ("DOMAIN COUNTS", summary["domain_counts"]),
        ("EXCLUSION REASONS", summary["exclusion_reasons"]),
        ("HISTORICAL CANDIDATE REVIEW", summary["historical_candidate_review"]),
        ("HISTORICAL BLOCK REASONS", summary["historical_candidate_block_reasons"]),
    ):
        lines.append("")
        lines.append(label)
        lines.extend("  " + str(key) + ": " + str(value) for key, value in mapping.items())
    lines.extend(["", "FEED HEALTH"])
    lines.extend("  " + row["feed"] + ": " + row["condition"]
                 for row in summary["feed_health"])
    lines.extend(["", "WHY HISTORICAL PREDICTION IS NOT ESTABLISHED"])
    lines.extend("  - " + reason for reason in summary["blocking_reasons"])
    return "\n".join(lines) + "\n"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("view_path")
    parser.add_argument("--json", action="store_true", help="Emit machine-readable audit")
    args = parser.parse_args()
    view = json.loads(Path(args.view_path).read_bytes())
    result = summarize(view)
    print(json.dumps(result, indent=2) if args.json else render_text(result), end="" if not args.json else "\n")


if __name__ == "__main__":
    main()
