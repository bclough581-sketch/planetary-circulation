"""Research-only observation selection. Never emits inferred links."""
from .ingest import existing_observations, noaa_alert_observations
from .freshness import eligible


def assemble(snapshot, noaa_payload, now=None):
    existing, excluded = existing_observations(snapshot)
    weather, weather_excluded = noaa_alert_observations(noaa_payload)
    excluded.extend(weather_excluded)
    accepted = []
    for event in existing + weather:
        ok, reason = eligible(event, snapshot, now)
        if ok:
            accepted.append(event)
        else:
            excluded.append({"id": event["id"], "reason": reason})
    return {
        "observations": accepted,
        "excluded": excluded,
        "relationships": [],
        "predictive_advantage": "not_established",
        "note": "No validated cross-domain relationship or trading edge.",
    }
