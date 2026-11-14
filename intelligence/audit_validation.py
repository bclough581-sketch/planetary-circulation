"""Independent consistency checks for fail-closed historical audit artifacts.

Checks reproduce the current missing-evidence exclusion rule; they do not
authenticate external publication claims or certify trading eligibility.
"""
import hashlib
import json

from intelligence.point_in_time import _json_number_normalized, assess_asof


def validate_audit(panel, audit):
    if not isinstance(audit, dict):
        raise ValueError("audit must be an object")
    if not isinstance(panel, dict) or panel.get("schema") != "amalgam.cross-domain-observation-panel.v1":
        raise ValueError("unsupported historical panel")
    rows = panel.get("observations")
    if not isinstance(rows, list) or not rows:
        raise ValueError("missing historical observations")
    if audit.get("source_panel_schema") != panel["schema"]:
        raise ValueError("audit panel schema mismatch")
    canonical = json.dumps(_json_number_normalized(rows), sort_keys=True,
                           separators=(",", ":"), allow_nan=False, ensure_ascii=False)
    fingerprint = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    if audit.get("source_observations_sha256") != fingerprint:
        raise ValueError("audit source fingerprint mismatch")
    if audit.get("source_observation_count") != len(rows):
        raise ValueError("audit source count mismatch")
    if audit.get("predictive_advantage") != "not_established" or audit.get("status") != "blocked":
        raise ValueError("unsupported audit status")
    if audit.get("usable_count") != 0 or audit.get("blocked_count") != len(rows):
        raise ValueError("audit eligibility totals mismatch")
    blocked = audit.get("blocked")
    if not isinstance(blocked, list) or len(blocked) != len(rows):
        raise ValueError("audit exclusion list mismatch")
    expected_dates = [row.get("date") for row in rows]
    if any(not isinstance(day, str) for day in expected_dates) or len(set(expected_dates)) != len(rows):
        raise ValueError("invalid or repeated panel dates")
    actual_dates = [entry.get("date") for entry in blocked if isinstance(entry, dict)]
    if len(actual_dates) != len(rows) or len(set(actual_dates)) != len(rows) or set(actual_dates) != set(expected_dates):
        raise ValueError("audit exclusion dates mismatch")
    if any(row.get("availability_evidence") is not None for row in rows):
        raise ValueError("publication evidence requires external authentication")
    if any(entry["reason"] != "missing_independent_availability_evidence" for entry in blocked):
        raise ValueError("audit exclusion reason not reproducible")
    try:
        expected = assess_asof(panel, audit["decision_utc"])
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError("invalid audit decision timestamp") from exc
    if expected["blocked"] != blocked:
        raise ValueError("audit exclusion ledger mismatch")
    return {"status": "verified_internal_consistency", "observations": len(rows),
            "source_observations_sha256": fingerprint,
            "warning": "Internal consistency only; no publication authentication or predictive advantage."}
