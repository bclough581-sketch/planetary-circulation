"""Candidate point-in-time ledger checks; never certify publication or predictive edge."""
from datetime import datetime, timezone


def _utc(value):
    if not isinstance(value, str):
        raise ValueError("timestamp must be a string")
    try:
        stamp = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError("invalid timestamp") from exc
    if stamp.tzinfo is None or stamp.utcoffset() is None:
        raise ValueError("timestamp missing timezone")
    return stamp.astimezone(timezone.utc)


def assess_candidate(record, decision_at):
    """Reject impossible or incomplete candidate evidence without granting PIT verification.

    first_seen_at is a capture claim, not proof of the earliest public release.
    An independent archival or release-time verification process is still required.
    """
    try:
        cutoff = _utc(decision_at)
    except ValueError:
        return {"eligible_for_review": False, "reason": "invalid decision timestamp",
                "point_in_time_verified": False}
    if not isinstance(record, dict):
        return {"eligible_for_review": False, "reason": "invalid ledger record",
                "point_in_time_verified": False}
    for field in ("id", "domain", "source_url"):
        if not isinstance(record.get(field), str) or not record[field].strip():
            return {"eligible_for_review": False, "reason": "missing " + field,
                    "point_in_time_verified": False}
    for field in ("observed_at", "published_at", "first_seen_at"):
        try:
            stamp = _utc(record.get(field))
        except ValueError:
            return {"eligible_for_review": False, "reason": "invalid " + field,
                    "point_in_time_verified": False}
        if stamp > cutoff:
            return {"eligible_for_review": False, "reason": field + " postdates decision",
                    "point_in_time_verified": False}
    return {"eligible_for_review": True,
            "reason": "timestamps plausible; independent availability verification required",
            "point_in_time_verified": False}
