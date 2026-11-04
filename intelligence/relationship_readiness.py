"""Determine whether a research snapshot supports historical cross-domain validation.

This is a readiness audit, not a relationship detector or backtest.
"""
from collections import Counter
from datetime import datetime


def audit_readiness(view):
    observations = view.get("observations", [])
    by_domain = Counter(event["domain"] for event in observations)
    dated = {}
    for event in observations:
        try:
            stamp = datetime.fromisoformat(event["observed_at"].replace("Z", "+00:00"))
            dated.setdefault(event["domain"], set()).add(stamp.date().isoformat())
        except (KeyError, ValueError, TypeError, AttributeError):
            continue
    domain_dates = {domain: len(days) for domain, days in sorted(dated.items())}
    multi_day_domains = sorted(domain for domain, days in domain_dates.items() if days >= 2)
    return {
        "status": "not_ready",
        "historical_relationships_validated": 0,
        "predictive_advantage": "not_established",
        "observation_counts": dict(sorted(by_domain.items())),
        "distinct_observation_dates": domain_dates,
        "multi_day_domains": multi_day_domains,
        "blocking_reasons": [
            "No preregistered historical cross-domain hypothesis, lag, outcome, or control group is present.",
            "No aligned historical panel and out-of-sample evaluation is present.",
            "A single research snapshot cannot establish cross-domain predictive lift.",
        ],
    }
