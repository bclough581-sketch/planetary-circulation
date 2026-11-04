import unittest
from intelligence.point_in_time import assess_asof, parse_instant


class PointInTimeTests(unittest.TestCase):
    def setUp(self):
        self.panel = {"schema": "amalgam.cross-domain-observation-panel.v1",
                      "observations": [{"date": "2025-01-02", "wti_usd_per_barrel": 70,
                                        "brent_usd_per_barrel": 75, "treasury_10y_percent": 4.4}]}

    def test_current_panel_fails_closed(self):
        result = assess_asof(self.panel, "2025-01-03T12:00:00Z")
        self.assertEqual(result["status"], "blocked")
        self.assertEqual(result["usable_count"], 0)
        self.assertEqual(result["blocked"][0]["reason"], "missing_independent_availability_evidence")

    def test_observation_date_is_not_publication_proof(self):
        row = self.panel["observations"][0]
        row["availability_evidence"] = {
            field: {"available_utc": "2025-01-02T12:00:00Z", "source_url": "https://example.org",
                    "verification": "inferred_from_observation_date"}
            for field in ("wti_usd_per_barrel", "brent_usd_per_barrel", "treasury_10y_percent")}
        result = assess_asof(self.panel, "2025-01-03T12:00:00Z")
        self.assertEqual(result["usable_count"], 0)

    def test_later_publication_blocks(self):
        row = self.panel["observations"][0]
        row["availability_evidence"] = {
            field: {"available_utc": "2025-01-04T12:00:00Z", "source_url": "https://example.org",
                    "verification": "independent_publication_record"}
            for field in ("wti_usd_per_barrel", "brent_usd_per_barrel", "treasury_10y_percent")}
        result = assess_asof(self.panel, "2025-01-03T12:00:00Z")
        self.assertEqual(result["blocked"][0]["reason"], "published_after_decision")

    def test_timezone_required(self):
        with self.assertRaisesRegex(ValueError, "timezone"):
            parse_instant("2025-01-03T12:00:00")


if __name__ == "__main__":
    unittest.main()
