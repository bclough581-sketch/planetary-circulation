"""Canonical Python-to-browser evidence export contract regression."""
import json
import unittest
from intelligence.events import observation, relationship, export_graph
from intelligence.ingest import snapshot_graph


class EvidenceExportTests(unittest.TestCase):
    def test_versioned_graph_round_trip(self):
        a = observation(id="geo-1", domain="geopolitics", title="Synthetic restriction",
                        observed_at="2026-11-05T12:00:00Z",
                        source={"name": "Synthetic", "url": "https://example.org/a"})
        b = observation(id="market-1", domain="markets", title="Synthetic movement",
                        observed_at="2026-11-05T13:00:00Z",
                        source={"name": "Synthetic", "url": "https://example.org/b"})
        r = relationship(id="rel-1", from_event="geo-1", to_event="market-1",
                         kind="hypothesized_transmission", explanation="Unverified example",
                         evidence_ids=["geo-1", "market-1"],
                         counterarguments=["Alternative explanation"], missing=["Attribution"])
        result = json.loads(json.dumps(export_graph([a, b], [r])))
        self.assertEqual(result["schema_version"], "amalgam-evidence-v1")
        self.assertEqual(result["relationships"][0]["predictive_advantage"], "not_established")
        self.assertEqual(result["relationships"][0]["counterarguments"], ["Alternative explanation"])
        self.assertEqual(result["events"][0]["observed_at"], "2026-11-05T12:00:00Z")

    def test_existing_snapshot_adapter_excludes_incomplete_rows(self):
        snapshot = {"hubs": {
            "NYC": {"price": 4.5, "asof": "2026-11-05"},
            "HOU": {"price": None, "asof": "2026-11-05"},
            "UNMAPPED": {"price": 2, "asof": "2026-11-05"},
        }, "chokepoints": []}
        graph = snapshot_graph(snapshot)
        self.assertEqual(graph["schema_version"], "amalgam-evidence-v1")
        self.assertEqual(graph["feed_status"], "snapshot_only_not_live")
        self.assertEqual(len(graph["events"]), 1)
        self.assertEqual(graph["events"][0]["domain"], "economics")
        self.assertEqual(graph["relationships"], [])
        self.assertEqual(len(graph["excluded_records"]), 2)

    def test_missing_reference_rejected(self):
        a = observation(id="a", domain="markets", title="Synthetic",
                        observed_at="2026-11-05T12:00:00Z",
                        source={"name": "Synthetic", "url": "https://example.org"})
        r = relationship(id="r", from_event="a", to_event="absent",
                         kind="exposure", explanation="Unverified", evidence_ids=["a"])
        with self.assertRaises(ValueError):
            export_graph([a], [r])


if __name__ == "__main__":
    unittest.main()
