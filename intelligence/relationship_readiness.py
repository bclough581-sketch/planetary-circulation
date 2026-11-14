"""Determine whether a research snapshot supports historical cross-domain validation.

This is a readiness audit, not a relationship detector or backtest.
"""
from collections import Counter
from datetime import datetime, timezone
from itertools import combinations
from .point_in_time_ledger import assess_candidate


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
    # A source-supplied timestamp is an audit lead, never proof of public availability.
    publication_timestamp_claims = Counter()
    publication_after_generation = Counter()
    try:
        generated = datetime.fromisoformat(view["generated_utc"].replace("Z", "+00:00"))
        if generated.tzinfo is None or generated.utcoffset() is None:
            generated = None
    except (KeyError, ValueError, TypeError, AttributeError):
        generated = None
    for event in observations:
        try:
            value = event.get("metadata", {}).get("published_at")
            if not isinstance(value, str):
                continue
            published = datetime.fromisoformat(value.replace("Z", "+00:00"))
            if published.tzinfo is None or published.utcoffset() is None:
                continue
            publication_timestamp_claims[event["domain"]] += 1
            if generated is not None and published > generated:
                publication_after_generation[event["domain"]] += 1
        except (KeyError, ValueError, TypeError, AttributeError):
            continue
    # Existing source observations lack verified first-seen/publication evidence.
    # Candidate review is diagnostic only, never a historical trading eligibility grant.
    candidate_review = Counter()
    candidate_block_reasons = Counter()
    if generated is None:
        candidate_review["not_assessed"] = len(observations)
    else:
        for event in observations:
            metadata = event.get("metadata")
            source = event.get("source")
            candidate = {
                "id": event.get("id"),
                "domain": event.get("domain"),
                "source_url": source.get("url") if isinstance(source, dict) else None,
                "observed_at": event.get("observed_at"),
                "published_at": metadata.get("published_at") if isinstance(metadata, dict) else None,
                "first_seen_at": metadata.get("first_seen_at") if isinstance(metadata, dict) else None,
            }
            outcome = assess_candidate(candidate, generated.isoformat())
            candidate_review["reviewable" if outcome["eligible_for_review"] else "blocked"] += 1
            if not outcome["eligible_for_review"]:
                candidate_block_reasons[outcome["reason"]] += 1
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
        "historical_candidate_review": dict(sorted(candidate_review.items())),
        "historical_candidate_block_reasons": dict(sorted(candidate_block_reasons.items())),
        "unverified_publication_timestamp_claims": dict(sorted(publication_timestamp_claims.items())),
        "publication_claims_after_generation": dict(sorted(publication_after_generation.items())),
        "blocking_reasons": [
            "No preregistered historical cross-domain hypothesis, lag, outcome, or control group is present.",
            "No aligned historical panel and out-of-sample evaluation is present.",
            "Observation timestamps do not establish when source data became publicly available.",
            "A single research snapshot cannot establish cross-domain predictive lift.",
        ],
    }
