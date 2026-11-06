"""Adapters for existing Amalgam snapshots and NOAA weather alerts.

Adapters only normalize observed source data. They never claim causality.
"""
from datetime import datetime, timezone
from .events import observation, relationship, validate_graph, export_graph

SOURCES = {
    "ecb": ("ECB statistics", "https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/"),
    "ust": ("U.S. Treasury", "https://home.treasury.gov/resource-center/data-chart-center/interest-rates"),
    "eia": ("U.S. Energy Information Administration", "https://www.eia.gov/opendata/"),
    "portwatch": ("IMF PortWatch", "https://portwatch.imf.org/"),
}
HUB_DOMAIN = {"HOU": ("energy", "eia"), "DXB": ("energy", "eia")}
HUB_DOMAIN.update({x: ("economics", "ecb") for x in ("GRU", "LON", "FRA", "ZRH", "JNB", "BOM", "SHA", "TYO", "SYD")})


def _at_date(day):
    if not isinstance(day, str) or len(day) < 10:
        raise ValueError("missing observation date")
    return datetime.strptime(day[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc).isoformat()


def existing_observations(snapshot):
    """Read existing data.json shape; exclude stale/unknown observations explicitly.

    Freshness is NOT inferred here; downstream consumers must check age against
    source-specific thresholds before using records in a live convergence display.
    """
    events, excluded = [], []
    for hub, row in snapshot.get("hubs", {}).items():
        domain_source = HUB_DOMAIN.get(hub)
        if not domain_source and hub != "NYC":
            excluded.append({"id": hub, "reason": "unmapped source"})
            continue
        domain, source_key = domain_source if domain_source else ("economics", "ust")
        if row.get("price") is None or not row.get("asof"):
            excluded.append({"id": hub, "reason": "missing value or source date"})
            continue
        name, url = SOURCES[source_key]
        events.append(observation(id="hub:" + hub + ":" + row["asof"], domain=domain,
                                  title=hub + " source measurement", observed_at=_at_date(row["asof"]),
                                  source={"name": name, "url": url}, value=row["price"],
                                  metadata={"hub": hub, "change": row.get("chg"), "asof": row["asof"]},
                                  missing=["Independent cross-domain explanation"]))
    for row in snapshot.get("chokepoints", []):
        if not row.get("id") or not row.get("asof") or row.get("ratio") is None:
            excluded.append({"id": row.get("id", "unknown chokepoint"), "reason": "missing date or ratio"})
            continue
        events.append(observation(id="choke:" + row["id"] + ":" + row["asof"],
                                  domain="maritime", title=row.get("name", row["id"]) + " transit ratio",
                                  observed_at=_at_date(row["asof"]),
                                  source={"name": SOURCES["portwatch"][0], "url": SOURCES["portwatch"][1]},
                                  location={"lat": row.get("lat"), "lon": row.get("lon")},
                                  value=row["ratio"], unit="baseline ratio",
                                  metadata={"baseline_note": row.get("baseline_note")},
                                  missing=["Causal explanation", "Commercial reuse permission"]))
    return events, excluded


def noaa_alert_observations(payload):
    """Normalize NOAA /alerts/active JSON features; no guessed economic impact."""
    events, excluded = [], []
    for feature in payload.get("features", []):
        props = feature.get("properties") or {}
        alert_id = feature.get("id") or props.get("id")
        issued = props.get("sent") or props.get("effective")
        if not alert_id or not issued:
            excluded.append({"id": alert_id or "unknown", "reason": "missing alert ID or time"})
            continue
        try:
            events.append(observation(
                id="noaa:" + alert_id, domain="weather",
                title=props.get("event") or "NOAA weather alert", observed_at=issued,
                source={"name": "NOAA National Weather Service",
                        "url": "https://www.weather.gov/documentation/services-web-api"},
                location={"area_desc": props.get("areaDesc"),
                          "geometry": feature.get("geometry")},
                status="observed",
                metadata={"severity": props.get("severity"), "urgency": props.get("urgency"),
                          "certainty": props.get("certainty"), "expires": props.get("expires")},
                missing=["Verified affected infrastructure", "Observed market response"] ))
        except ValueError:
            excluded.append({"id": alert_id, "reason": "invalid alert timestamp"})
    return events, excluded


def proposed_connection(weather_event, economic_event, explanation, counterarguments):
    """Manually proposed investigative link, never an automated causal inference."""
    if weather_event["domain"] != "weather" or economic_event["domain"] not in {"energy", "markets", "commodities", "economics", "maritime", "corporate"}:
        raise ValueError("unsupported connection")
    result = relationship(id="candidate:" + weather_event["id"] + ":" + economic_event["id"],
                          from_event=weather_event["id"], to_event=economic_event["id"],
                          kind="hypothesized_transmission", explanation=explanation,
                          evidence_ids=[weather_event["id"], economic_event["id"]],
                          counterarguments=counterarguments,
                          missing=["Verified exposure pathway", "Out-of-sample predictive test"])
    validate_graph([weather_event, economic_event], [result])
    return result


def snapshot_graph(snapshot):
    """Convert an existing Amalgam snapshot into a canonical, non-predictive graph.

    Excluded rows remain visible to the caller; no relationships are inferred.
    """
    events, excluded = existing_observations(snapshot)
    graph = export_graph(events, [])
    graph["excluded_records"] = excluded
    graph["feed_status"] = "snapshot_only_not_live"
    return graph
