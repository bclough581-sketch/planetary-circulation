"""Fail-closed point-in-time eligibility checks for historical research.

Observation dates do not imply publication or availability timestamps.
"""
from datetime import datetime, timezone
import hashlib
import json


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


def _json_number_normalized(value):
    """Normalize integral floats to browser JSON number representation."""
    if isinstance(value, dict):
        return {key: _json_number_normalized(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_json_number_normalized(item) for item in value]
    if isinstance(value, float) and value.is_integer():
        return int(value)
    return value


def assess_asof(panel, decision_utc):
    decision = parse_instant(decision_utc)
    if panel.get("schema") != "amalgam.cross-domain-observation-panel.v1":
        raise ValueError("unsupported historical panel")
    rows = panel.get("observations")
    if not isinstance(rows, list):
        raise ValueError("missing historical observations")
    days = [row.get("date") for row in rows]
    if any(not isinstance(day, str) for day in days) or len(set(days)) != len(days):
        raise ValueError("invalid or repeated historical observation date")
    fingerprint = hashlib.sha256(json.dumps(_json_number_normalized(rows), sort_keys=True, separators=(",", ":"), allow_nan=False, ensure_ascii=False).encode("utf-8")).hexdigest()
    required = ("wti_usd_per_barrel", "brent_usd_per_barrel", "treasury_10y_percent")
    usable = []
    blocked = []
    for row in rows:
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
        # A JSON assertion is not independent verification. No trusted archival
        # publication verifier is connected, so even plausible records fail closed.
        blocked.append({"date": day, "reason": "publication_record_not_independently_authenticated"})
    return {"status": "eligible_for_asof_analysis" if usable else "blocked",
            "decision_utc": decision.isoformat(),
            "source_panel_schema": panel["schema"],
            "source_observation_count": len(rows),
            "source_observations_sha256": fingerprint,
            "usable_count": len(usable), "blocked_count": len(blocked),
            "blocked": blocked,
            "predictive_advantage": "not_established",
            "warning": "No trusted archival publication verifier is connected. User-supplied publication claims never grant as-of eligibility."}
