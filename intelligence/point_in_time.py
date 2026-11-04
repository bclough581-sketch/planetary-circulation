"""Fail-closed point-in-time eligibility checks for historical research.

Observation dates do not imply publication or availability timestamps.
"""
from datetime import datetime, timezone


def parse_instant(value):
    if not isinstance(value, str):
        raise ValueError("timestamp must be an ISO-8601 string")
    try:
        stamp = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError("invalid timestamp") from exc
    if stamp.tzinfo is None or stamp.utcoffset() is None:
        raise ValueError("timezone-aware timestamp required")
    return stamp.astimezone(timezone.utc)


def assess_asof(panel, decision_utc):
    decision = parse_instant(decision_utc)
    if panel.get("schema") != "amalgam.cross-domain-observation-panel.v1":
        raise ValueError("unsupported historical panel")
    required = ("wti_usd_per_barrel", "brent_usd_per_barrel", "treasury_10y_percent")
    usable = []
    blocked = []
    for row in panel.get("observations", []):
        day = row.get("date")
        evidence = row.get("availability_evidence")
        if not isinstance(evidence, dict):
            blocked.append({"date": day, "reason": "missing_independent_availability_evidence"})
            continue
        try:
            times = []
            for field in required:
                proof = evidence[field]
                if proof.get("verification") != "independent_publication_record" or not proof.get("source_url"):
                    raise ValueError("unverified availability source")
                stamp = parse_instant(proof["available_utc"])
                times.append(stamp)
            if any(stamp > decision for stamp in times):
                blocked.append({"date": day, "reason": "published_after_decision"})
                continue
        except (KeyError, TypeError, ValueError):
            blocked.append({"date": day, "reason": "invalid_or_incomplete_availability_evidence"})
            continue
        # A JSON assertion is not independent verification. No trusted archival\n        # publication verifier is connected, so even plausible records fail closed.\n        blocked.append({"date": day, "reason": "publication_record_not_independently_authenticated"})
    return {"status": "eligible_for_asof_analysis" if usable else "blocked",
            "decision_utc": decision.isoformat(),
            "usable_count": len(usable), "blocked_count": len(blocked),
            "blocked": blocked,
            "predictive_advantage": "not_established",
            "warning": "No trusted archival publication verifier is connected. User-supplied publication claims never grant as-of eligibility."}
