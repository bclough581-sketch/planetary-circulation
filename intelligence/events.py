"""Evidence-first event and relationship records. No predictive claims."""
from datetime import datetime, timezone

DOMAINS = frozenset({
    "weather", "geopolitics", "maritime", "aviation", "energy",
    "commodities", "economics", "markets", "corporate",
})
EVIDENCE_STATES = frozenset({"observed", "hypothesis", "investigating", "validated", "refuted"})
RELATION_TYPES = frozenset({"coincident", "exposure", "lead_lag", "hypothesized_transmission"})


def _time(value):
    if not isinstance(value, str):
        raise ValueError("timestamp must be an ISO 8601 string")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError("invalid timestamp") from exc
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise ValueError("timestamp must include timezone")
    return parsed.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def observation(*, id, domain, title, observed_at, source, location=None,
                value=None, unit=None, status="observed", missing=None, metadata=None):
    """Create a source-attributed observation; never infer causation or confidence."""
    if not isinstance(id, str) or not id.strip():
        raise ValueError("id is required")
    if domain not in DOMAINS:
        raise ValueError("unknown domain")
    if not isinstance(title, str) or not title.strip():
        raise ValueError("title is required")
    if not isinstance(source, dict) or not source.get("name") or not source.get("url"):
        raise ValueError("source requires name and url")
    if status not in EVIDENCE_STATES:
        raise ValueError("unknown evidence state")
    if missing is not None and (not isinstance(missing, list) or not all(isinstance(x, str) for x in missing)):
        raise ValueError("missing must be a list of strings")
    return {"id": id, "domain": domain, "title": title, "observed_at": _time(observed_at),
            "source": {"name": source["name"], "url": source["url"]},
            "location": location, "value": value, "unit": unit, "status": status,
            "missing": missing or [], "metadata": metadata or {}}


def relationship(*, id, from_event, to_event, kind, explanation, evidence_ids,
                 status="hypothesis", counterarguments=None, missing=None):
    """Describe a proposed connection; validation is a separate research process."""
    if not isinstance(id, str) or not id.strip():
        raise ValueError("id is required")
    if from_event == to_event or not from_event or not to_event:
        raise ValueError("relationship requires two distinct event IDs")
    if kind not in RELATION_TYPES or status not in EVIDENCE_STATES:
        raise ValueError("invalid relationship type or state")
    if not isinstance(explanation, str) or not explanation.strip():
        raise ValueError("explanation is required")
    if not isinstance(evidence_ids, list) or not evidence_ids or not all(isinstance(x, str) and x.strip() for x in evidence_ids):
        raise ValueError("at least one evidence ID is required")
    return {"id": id, "from_event": from_event, "to_event": to_event,
            "kind": kind, "explanation": explanation, "evidence_ids": evidence_ids,
            "status": status, "counterarguments": counterarguments or [],
            "missing": missing or [], "predictive_advantage": "not_established"}


def validate_graph(events, relationships):
    """Check references and unique IDs. No relationship is created automatically."""
    event_ids = [e["id"] for e in events]
    relation_ids = [r["id"] for r in relationships]
    if len(set(event_ids)) != len(event_ids) or len(set(relation_ids)) != len(relation_ids):
        raise ValueError("duplicate IDs")
    known = set(event_ids)
    for r in relationships:
        if r["from_event"] not in known or r["to_event"] not in known:
            raise ValueError("relationship references unknown event")
        if not set(r["evidence_ids"]).issubset(known):
            raise ValueError("relationship references unknown evidence")
    return True
