"""Explain feed gaps without treating missing coverage as zero real-world activity."""
from datetime import datetime, timezone

FEEDS = {
    "ecb": ("economics", 7),
    "ust": ("economics", 7),
    "eia": ("energy", 7),
    "portwatch": ("maritime", 3),
}


def audit(snapshot, now=None):
    now = now or datetime.now(timezone.utc)
    if now.tzinfo is None:
        raise ValueError("now must have timezone")
    findings = []
    hubs = snapshot.get("hubs", {})
    for key, (domain, max_days) in FEEDS.items():
        state = snapshot.get("status", {}).get(key, {})
        rows = [row for row in hubs.values() if row.get("src") == key]
        if key == "portwatch":
            rows = snapshot.get("chokepoints", [])
        dated = []
        for row in rows:
            try:
                timestamp = datetime.fromisoformat(row["asof"][:10]).replace(tzinfo=timezone.utc)
                dated.append(timestamp)
            except (ValueError, KeyError, TypeError):
                pass
        newest = max(dated) if dated else None
        age = (now - newest).total_seconds() / 86400 if newest else None
        if not state.get("ok"):
            condition = "collector_failed"
        elif age is None:
            condition = "no_dated_observations"
        elif age > max_days or age < -1:
            condition = "outside_freshness_window"
        else:
            condition = "eligible_source"
        findings.append({
            "feed": key, "domain": domain, "condition": condition,
            "latest_observation": newest.date().isoformat() if newest else None,
            "age_days": round(age, 2) if age is not None else None,
            "collector_ok": state.get("ok") is True,
            "reason": state.get("error") if not state.get("ok") else None,
            "eligible_for_live_convergence": condition == "eligible_source",
        })
    return findings
