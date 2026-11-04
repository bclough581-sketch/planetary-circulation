import unittest
import json
import subprocess
import sys
import tempfile
from pathlib import Path
from copy import deepcopy
from datetime import datetime, timezone
from intelligence.research_view import build
from intelligence.historical_panel import build_panel


class HistoricalPanelTests(unittest.TestCase):
    def view(self, day):
        return build({"status": {}}, {"features": []},
                     datetime(2026, 11, day, 12, tzinfo=timezone.utc))

    def test_separate_captures_preserved_without_claiming_edge(self):
        panel = build_panel([self.view(4), self.view(3)])
        self.assertEqual(panel["capture_count"], 2)
        self.assertLess(panel["captures"][0]["captured_utc"],
                        panel["captures"][1]["captured_utc"])
        self.assertEqual(panel["relationships"], [])
        self.assertEqual(panel["predictive_advantage"], "not_established")

    def test_repeated_evidence_is_not_counted_as_independent(self):
        first, second = self.view(3), self.view(4)
        event = {'id': 'same-source-event', 'domain': 'weather', 'observed_at': '2026-11-03T09:00:00Z',
                 'source': {'name': 'NOAA National Weather Service', 'url': 'https://www.weather.gov/documentation/services-web-api'}}
        from intelligence.relationship_readiness import audit_readiness
        for view in (first, second):
            view['observations'] = [deepcopy(event)]
            view['domains']['weather'] = 1
            view['relationship_readiness'] = audit_readiness(view)
        panel = build_panel([first, second])
        self.assertEqual(panel['observation_appearances'], 2)
        self.assertEqual(panel['unique_observation_identities'], 1)
        self.assertEqual(panel['repeated_observation_appearances'], 1)
        self.assertEqual(panel['conflicting_observation_identities'], 0)
        second['observations'][0]['title'] = 'Changed title'
        second['relationship_readiness'] = audit_readiness(second)
        changed = build_panel([first, second])
        self.assertEqual(changed['conflicting_observation_identities'], 1)
        self.assertEqual(changed['revised_identity_versions'], 1)
        revisions = [x for x in changed['review_exceptions'] if x['type'] == 'revised_identity']
        self.assertEqual(len(revisions), 1)
        self.assertEqual(len(revisions[0]['records'][0]['captures']), 2)
        self.assertTrue(all(len(x['sha256']) == 64 for x in revisions[0]['records'][0]['captures']))
        self.assertEqual(changed['possible_alias_groups'], 0)
        second['observations'][0]['id'] = 'different-id-same-source-time'
        second['relationship_readiness'] = audit_readiness(second)
        alias = build_panel([first, second])
        self.assertEqual(alias['possible_alias_groups'], 1)
        aliases = [x for x in alias['review_exceptions'] if x['type'] == 'possible_alias']
        self.assertEqual(len(aliases), 1)
        self.assertEqual(len(aliases[0]['records']), 2)
        self.assertEqual(alias['unique_observation_identities'], 2)
        self.assertEqual(alias['repeated_observation_appearances'], 0)

    def test_duplicate_capture_rejected(self):
        with self.assertRaisesRegex(ValueError, "duplicate capture"):
            build_panel([self.view(4), self.view(4)])

    def test_forged_readiness_rejected(self):
        view = self.view(4)
        view["relationship_readiness"]["status"] = "ready"
        with self.assertRaisesRegex(ValueError, "readiness"):
            build_panel([view])

    def test_cli_builds_manifest_from_actual_files(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            first, second, output = root / 'first.json', root / 'second.json', root / 'manifest.json'
            first.write_text(json.dumps(self.view(3)), encoding='utf-8')
            second.write_text(json.dumps(self.view(4)), encoding='utf-8')
            subprocess.run([sys.executable, '-m', 'intelligence.historical_panel', str(first), str(second), '--output', str(output)], check=True, capture_output=True)
            manifest = json.loads(output.read_text(encoding='utf-8'))
            self.assertEqual(manifest['capture_count'], 2)
            self.assertEqual(manifest['predictive_advantage'], 'not_established')

    def test_empty_panel_rejected(self):
        with self.assertRaises(ValueError):
            build_panel([])

    def test_observation_after_capture_rejected(self):
        view = self.view(4)
        event = {"id": "test", "domain": "weather", "observed_at": "2026-11-05T12:00:00Z",
                 "source": {"name": "NOAA National Weather Service", "url": "https://www.weather.gov/documentation/services-web-api"}}
        view["observations"].append(event)
        view["domains"]["weather"] = 1
        view["relationship_readiness"]["observation_counts"] = {"weather": 1}
        view["relationship_readiness"]["distinct_observation_dates"] = {"weather": 1}
        view["relationship_readiness"]["multi_day_domains"] = []
        with self.assertRaisesRegex(ValueError, "postdates capture"):
            build_panel([view])


if __name__ == "__main__":
    unittest.main()
