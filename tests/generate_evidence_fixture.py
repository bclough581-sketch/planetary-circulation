"""Generate a deterministic canonical graph fixture for browser contract testing."""
import json
import sys
from intelligence.events import observation, relationship, export_graph

events = [
    observation(id="python-geo", domain="geopolitics", title="Python-exported event",
                observed_at="2026-11-05T12:00:00Z",
                source={"name": "Synthetic fixture", "url": "https://example.org/geo"}),
    observation(id="python-market", domain="markets", title="Python-exported market",
                observed_at="2026-11-05T13:00:00Z",
                source={"name": "Synthetic fixture", "url": "https://example.org/market"}),
]
relationships = [
    relationship(id="python-link", from_event="python-geo", to_event="python-market",
                 kind="hypothesized_transmission", explanation="Python fixture, no causation",
                 evidence_ids=["python-geo", "python-market"],
                 counterarguments=["Alternative causes"], missing=["Causal identification"])
]
json.dump(export_graph(events, relationships), sys.stdout, sort_keys=True)
sys.stdout.write("\n")
