"""Determine whether a research snapshot supports historical cross-domain validation.

This is a readiness audit, not a relationship detector or backtest.
"""
from collections import Counter
from datetime import datetime, timezone
from itertools import combinations


def audit_readiness(view):
    observations = view.get("observations", [])
    by_domain = Counter(event["domain"] for event in observations)
    dated = {}
    for event in observations:
        try:
            stamp = datetime.fromisoformat(event["observed_at"].replace("Z", "+00:00"))
            if stamp.tzinfo is None or stamp.utcoffset() is None:
                continue
            dated.setdefault(event["domain"], set()).add(stamp.astimezone(timezone.utc).date().isoformat())
        except (KeyError, ValueError, TypeError, AttributeError):
            continue
    domain_dates = {domain: len(days) for domain, days in sorted(dated.items())}
    multi_day_domains = sorted(domain for domain, days in domain_dates.items() if days >= 2)
    same_utc_date_overlap = {
        left + '|' + right: len(dated[left] & dated[right])
        for left, right in combinations(sorted(dated), 2)
        if dated[left] & dated[right]
    }
    return {
        "status": "not_ready",
        "historical_relationships_validated": 0,
        "predictive_advantage": "not_established",
        "observation_counts": dict(sorted(by_domain.items())),
        "distinct_observation_dates": domain_dates,
        "multi_day_domains": multi_day_domains,
        "same_utc_date_overlap": same_utc_date_overlap,
        "point_in_time_availability": "not_verified",
        "blocking_reasons": [
            "No preregistered historical cross-domain hypothesis, lag, outcome, or control group is present.",
            "No aligned historical panel and out-of-sample evaluation is present.",
            "Observation timestamps do not establish when source data became publicly available.",
            "A single research snapshot cannot establish cross-domain predictive lift.",
        ],
    }
