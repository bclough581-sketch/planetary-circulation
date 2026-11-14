import unittest
from intelligence.ingest import existing_observations, noaa_alert_observations, proposed_connection


class IngestTests(unittest.TestCase):
    def test_existing_snapshot_maps_source_and_exclusions(self):
        data = {"hubs": {"HOU": {"price": 71.2, "asof": "2026-11-03", "chg": 1.1},
                         "GRU": {"price": 6.1, "asof": "2026-11-03"},
                         "BAD": {"price": 1, "asof": "2026-11-03"}},
                "chokepoints": [{"id": "HRM", "name": "Strait of Hormuz",
                                 "asof": "2026-11-02", "ratio": 0.91, "lat": 26.5, "lon": 56.3}]}
        events, excluded = existing_observations(data)
        self.assertEqual(len(events), 3)
        self.assertEqual(len(excluded), 1)
        self.assertEqual({x["domain"] for x in events}, {"energy", "economics", "maritime"})

    def test_noaa_alert_and_unproven_link(self):
        alerts = {"features": [{"id": "alert-1", "geometry": None,
                   "properties": {"event": "Flood Warning", "sent": "2026-11-04T11:00:00-05:00",
                                  "areaDesc": "Example county", "severity": "Severe"}}]}
        weather, excluded = noaa_alert_observations(alerts)
        self.assertEqual(excluded, [])
        energy, _ = existing_observations({"hubs": {"HOU": {"price": 70, "asof": "2026-11-03"}}})
        link = proposed_connection(weather[0], energy[0], "Investigate possible infrastructure exposure",
                                   ["Alert may not overlap energy assets"])
        self.assertEqual(link["predictive_advantage"], "not_established")
        self.assertEqual(link["status"], "hypothesis")

    def test_missing_alert_is_excluded(self):
        events, excluded = noaa_alert_observations({"features": [{"properties": {"event": "Flood"}}]})
        self.assertFalse(events)
        self.assertEqual(len(excluded), 1)


if __name__ == "__main__":
    unittest.main()
