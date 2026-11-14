"""Offline historical panel construction from separately captured research artifacts.

No synthetic history, inferred relationships, or predictive scoring.
"""
from collections import defaultdict
from hashlib import sha256
import json
from datetime import datetime, timezone
from .research_view import validate_view


def _parse(value):
    stamp = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if stamp.tzinfo is None or stamp.utcoffset() is None:
        raise ValueError("timestamp lacks timezone")
    return stamp.astimezone(timezone.utc)


def build_panel(views):
    """Preserve distinct capture times; reject duplicate captures and future evidence."""
    if not isinstance(views, list) or not views:
        raise ValueError("historical panel requires actual captured research artifacts")
    captures = []
    capture_times = set()
    by_domain = defaultdict(set)
    unique_evidence = {}
    conflicting_evidence = set()
    source_event_ids = defaultdict(set)
    id_source_keys = defaultdict(set)
    version_digests = defaultdict(set)
    repeated_appearances = 0
    evidence_locations = defaultdict(list)
    total_appearances = 0
    for view in views:
        validate_view(view)
        captured = _parse(view["generated_utc"])
        if captured in capture_times:
            raise ValueError("duplicate capture timestamp")
        capture_times.add(captured)
        counts = {domain: 0 for domain in view["domains"]}
        for event in view["observations"]:
            observed = _parse(event["observed_at"])
            if observed > captured:
                raise ValueError("observation postdates capture")
            counts[event["domain"]] += 1
            total_appearances += 1
            identity = (event["domain"], event["id"], event["observed_at"], event["source"]["name"], event["source"]["url"])
            payload = json.dumps(event, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
            digest = sha256(payload.encode("utf-8")).hexdigest()
            source_key = (event['domain'], event['source']['name'], event['source']['url'], event['observed_at'])
            source_event_ids[source_key].add(event['id'])
            id_source_keys[(event['domain'], event['id'])].add(source_key)
            version_digests[identity].add(digest)
            evidence_locations[identity].append({"captured_utc": captured.isoformat(), "sha256": digest})
            if identity in unique_evidence:
                repeated_appearances += 1
                if unique_evidence[identity] != digest:
                    conflicting_evidence.add(identity)
            else:
                unique_evidence[identity] = digest
            by_domain[event["domain"]].add(captured.date().isoformat())
        captures.append({"captured_utc": captured.isoformat(), "observation_counts": counts})
    captures.sort(key=lambda item: item["captured_utc"])
    exceptions = []
    def add_exception(kind, identities):
        references = []
        for identity in sorted(identities):
            domain, event_id, observed_at, source_name, source_url = identity
            references.append({"domain": domain, "event_id": event_id, "observed_at": observed_at,
                               "source_name": source_name, "source_url": source_url,
                               "captures": sorted(evidence_locations[identity], key=lambda x: x["captured_utc"])})
        exceptions.append({"type": kind, "records": references})
    for identity in sorted(conflicting_evidence):
        add_exception("revised_identity", [identity])
    for key, ids in sorted(source_event_ids.items()):
        if len(ids) > 1:
            add_exception("possible_alias", [identity for identity in unique_evidence
                                             if (identity[0], identity[3], identity[4], identity[2]) == key])
    for key, source_keys in sorted(id_source_keys.items()):
        if len(source_keys) > 1:
            add_exception("reused_event_id", [identity for identity in unique_evidence
                                              if (identity[0], identity[1]) == key])
    blockers = []
    if len(captures) < 2:
        blockers.append("fewer_than_two_captures")
    if len({item["captured_utc"][:10] for item in captures}) < 2:
        blockers.append("fewer_than_two_capture_dates")
    if len(by_domain) < 2:
        blockers.append("fewer_than_two_observed_domains")
    if conflicting_evidence:
        blockers.append("unresolved_revised_observations")
    if any(len(ids) > 1 for ids in source_event_ids.values()):
        blockers.append("unresolved_possible_aliases")
    if any(len(keys) > 1 for keys in id_source_keys.values()):
        blockers.append("unresolved_reused_event_ids")
    blockers.append("no_time_aligned_independent_outcomes_or_predeclared_test")
    return {
        "schema": "amalgam.historical-panel-manifest.v1",
        "analysis_readiness": {"status": "not_ready", "blocking_reasons": blockers},
        "capture_count": len(captures),
        "observation_appearances": total_appearances,
        "unique_observation_identities": len(unique_evidence),
        "repeated_observation_appearances": repeated_appearances,
        "conflicting_observation_identities": len(conflicting_evidence),
        "revised_identity_versions": sum(len(digests) - 1 for digests in version_digests.values()),
        "possible_alias_groups": sum(len(ids) > 1 for ids in source_event_ids.values()),
        "reused_ids_across_source_keys": sum(len(keys) > 1 for keys in id_source_keys.values()),
        "captures": captures,
        "review_exceptions": exceptions,
        "capture_dates_by_domain": {key: len(value) for key, value in sorted(by_domain.items())},
        "relationships": [],
        "predictive_advantage": "not_established",
        "warning": "Repeated observation identities are not independent evidence. Possible aliases and revisions are diagnostic flags, not confirmed duplicate events. Conflicts require source-level review. Capture counts are not aligned time series or predictive validation. Original artifacts must be retained.",
    }


def main():
    """Build a local manifest from explicitly supplied, downloaded artifacts."""
    import argparse
    import json
    from pathlib import Path
    parser = argparse.ArgumentParser(description="Audit independently captured research-view JSON files")
    parser.add_argument("captures", nargs="+", type=Path, help="Downloaded research-view JSON files")
    parser.add_argument("--output", type=Path, default=Path("historical-panel-manifest.json"))
    args = parser.parse_args()
    views = [json.loads(path.read_text(encoding="utf-8")) for path in args.captures]
    manifest = build_panel(views)
    args.output.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Audited {manifest['capture_count']} captures; no predictive claim.")


if __name__ == "__main__":
    main()
