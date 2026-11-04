"""Offline historical panel construction from separately captured research artifacts.

No synthetic history, inferred relationships, or predictive scoring.
"""
from collections import defaultdict
from datetime import datetime, timezone
from .research_view import validate_view


def _parse(value):
    stamp = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if stamp.tzinfo is None or stamp.utcoffset() is None:
        raise ValueError("timestamp lacks timezone")
    return stamp.astimezone(timezone.utc)


def build_panel(views):
    """Preserve distinct capture times; reject duplicate captures and future evidence."""
    if not isinstance(views, list) or not views:
        raise ValueError("historical panel requires actual captured research artifacts")
    captures = []
    capture_times = set()
    by_domain = defaultdict(set)
    for view in views:
        validate_view(view)
        captured = _parse(view["generated_utc"])
        if captured in capture_times:
            raise ValueError("duplicate capture timestamp")
        capture_times.add(captured)
        counts = {domain: 0 for domain in view["domains"]}
        for event in view["observations"]:
            observed = _parse(event["observed_at"])
            if observed > captured:
                raise ValueError("observation postdates capture")
            counts[event["domain"]] += 1
            by_domain[event["domain"]].add(captured.date().isoformat())
        captures.append({"captured_utc": captured.isoformat(), "observation_counts": counts})
    captures.sort(key=lambda item: item["captured_utc"])
    return {
        "schema": "amalgam.historical-panel-manifest.v1",
        "capture_count": len(captures),
        "captures": captures,
        "capture_dates_by_domain": {key: len(value) for key, value in sorted(by_domain.items())},
        "relationships": [],
        "predictive_advantage": "not_established",
        "warning": "Capture counts are not independent observations, aligned time series, or predictive validation. Original artifacts must be retained.",
    }
