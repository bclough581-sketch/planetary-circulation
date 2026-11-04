import unittest
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

    def test_duplicate_capture_rejected(self):
        with self.assertRaisesRegex(ValueError, "duplicate capture"):
            build_panel([self.view(4), self.view(4)])

    def test_forged_readiness_rejected(self):
        view = self.view(4)
        view["relationship_readiness"]["status"] = "ready"
        with self.assertRaisesRegex(ValueError, "readiness"):
            build_panel([view])

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
