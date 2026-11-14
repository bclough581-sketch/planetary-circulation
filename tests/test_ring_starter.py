"""Meaningful starter trust boundaries: exact source binding and quarantine."""
import json
import unittest
from unittest.mock import patch
import tempfile
from pathlib import Path

from scripts.build_ring_evidence import ROOT, build, render, serialize


class RingStarterTests(unittest.TestCase):
    def test_committed_bundle_is_reproducible(self):
        self.assertEqual((ROOT / "ring-evidence.js").read_text(encoding="utf-8"), render())

    def test_retained_render_is_independent_of_live_snapshot(self):
        expected = render()
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            for name in ('product-data/retained-context-2026-11-04.json',
                         'intelligence/data/delta-quarterly-curated.json'):
                destination = root / name
                destination.parent.mkdir(parents=True, exist_ok=True)
                destination.write_bytes((ROOT / name).read_bytes())
            (root / 'data.json').write_text('{"hubs":{},"generated_utc":"2099-01-01T00:00:00Z"}')
            with patch('scripts.build_ring_evidence.ROOT', root):
                self.assertEqual(render(), expected)

    def test_retained_fixture_does_not_republish_portwatch_values(self):
        data = json.loads((ROOT / 'product-data/retained-context-2026-11-04.json').read_text())
        self.assertEqual(data['generated_utc'], '2026-11-04T02:10:55Z')
        self.assertNotIn('portwatch', data['status'])
        self.assertTrue(all(set(row) == {'id'} for row in data['chokepoints']))

    def test_issuer_is_exact_canonical_input_and_no_links_are_inferred(self):
        source = json.loads((ROOT / "data.json").read_text(encoding="utf-8"))
        original = json.loads(json.dumps(source))
        issuer = json.loads((ROOT / "intelligence/data/delta-quarterly-curated.json").read_text(encoding="utf-8"))
        result = build(source, issuer)
        self.assertEqual(result["issuer"], issuer)
        self.assertFalse(issuer["publication_time_verified"])
        self.assertEqual(result["snapshot"]["relationships"], [])
        self.assertEqual(result["snapshot"]["feed_status"], "snapshot_only_not_live")
        self.assertFalse(any(e["domain"] == "maritime" for e in result["snapshot"]["events"]))
        self.assertEqual(len([e for e in result["snapshot"]["excluded_records"]
                              if "PortWatch" in e["reason"]]), len(source["chokepoints"]))
        self.assertEqual(source, original, "quarantine must not mutate source input")
        for event in result["snapshot"]["events"]:
            self.assertTrue(event["unit"])
            self.assertEqual(event["metadata"]["time_semantics"], "measurement_date_only")

    def test_unsafe_script_text_is_escaped(self):
        script = serialize({"title": "</script><script>alert(1)</script>"})
        self.assertNotIn("</script>", script)
        self.assertIn("\\u003c", script)


if __name__ == "__main__":
    unittest.main()
