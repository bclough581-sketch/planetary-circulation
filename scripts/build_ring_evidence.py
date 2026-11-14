"""Build the ring explorer's offline starter from retained public repo inputs.

No network or provider credentials. This does not create causal relationships.
Run from the repo root: python -m scripts.build_ring_evidence
"""
import copy
import json
from pathlib import Path

from intelligence.ingest import snapshot_graph

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "ring-evidence.js"
FX = {"GRU": "BRL", "LON": "GBP", "FRA": "USD", "ZRH": "CHF",
      "JNB": "ZAR", "BOM": "INR", "SHA": "CNY", "TYO": "JPY", "SYD": "AUD"}


def build(snapshot, issuer):
    safe = copy.deepcopy(snapshot)
    # PortWatch's commercial-reuse permission is not verified. Do not bundle it.
    quarantined = safe.pop("chokepoints", [])
    graph = snapshot_graph(safe)
    graph["snapshot_generated_utc"] = snapshot.get("generated_utc")
    graph["excluded_records"].extend(
        {"id": str(row.get("id", "unknown chokepoint")),
         "reason": "PortWatch omitted: commercial reuse permission not verified"}
        for row in quarantined)
    for event in graph["events"]:
        hub = event["metadata"]["hub"]
        if hub in FX:
            event.update(title="EUR/" + FX[hub] + " reference rate", unit=FX[hub] + " per EUR")
        elif hub == "NYC":
            event.update(title="U.S. Treasury 10-year par yield", unit="percent")
        elif hub in {"HOU", "DXB"}:
            event.update(title=("WTI" if hub == "HOU" else "Brent") + " crude spot price", unit="USD per barrel")
        event["metadata"]["time_semantics"] = "measurement_date_only"
    return {"schema": "amalgam.ring-starter.v1", "snapshot": graph,
            "issuer": copy.deepcopy(issuer)}


def serialize(bundle):
    # Safe even if a retained string contains HTML/script delimiters.
    payload = json.dumps(bundle, ensure_ascii=True, indent=2).replace("<", "\\u003c").replace(">", "\\u003e")
    return "/* Generated from retained repo inputs; not a live feed. */\nwindow.AMALGAM_STARTER = " + payload + ";\n"


def render():
    # The preserved comparison is independent of the advancing current context.
    snapshot = json.loads((ROOT / "product-data/retained-context-2026-11-04.json").read_text(encoding="utf-8"))
    issuer = json.loads((ROOT / "intelligence/data/delta-quarterly-curated.json").read_text(encoding="utf-8"))
    return serialize(build(snapshot, issuer))


if __name__ == "__main__":
    OUTPUT.write_text(render(), encoding="utf-8", newline="\n")
    print("Built ring-evidence.js from retained inputs; no network requests")
