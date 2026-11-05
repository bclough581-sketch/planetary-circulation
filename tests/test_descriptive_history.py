import hashlib
import json
import unittest

from intelligence.descriptive_history import descriptive_report, verify_descriptive_report


class DescriptiveHistoryTests(unittest.TestCase):
    def setUp(self):
        self.panel = {
            "schema": "amalgam.cross-domain-observation-panel.v1",
            "predictive_advantage": "not_established",
            "publication_time_verified": False,
            "observations": [
                {"date": "2025-01-02", "wti_usd_per_barrel": 70,
                 "brent_usd_per_barrel": 73, "treasury_10y_percent": 4.1},
                {"date": "2025-01-03", "wti_usd_per_barrel": 72,
                 "brent_usd_per_barrel": 71, "treasury_10y_percent": 4.3},
            ],
        }

    def test_descriptive_spread_without_predictive_claim(self):
        result = descriptive_report(self.panel)
        self.assertEqual(result["matched_dates"], 2)
        canonical = json.dumps(self.panel["observations"], sort_keys=True, separators=(",", ":"))
        self.assertEqual(result["source_observations_sha256"],
                         hashlib.sha256(canonical.encode("utf-8")).hexdigest())
        self.assertEqual(result["brent_minus_wti_usd_per_barrel"]["mean"], 1)
        self.assertEqual(result["brent_minus_wti_usd_per_barrel"]["median"], 1)
        self.assertEqual(result["brent_minus_wti_usd_per_barrel"]["standard_deviation"], 2.8284)
        self.assertEqual(result["treasury_10y_percent"]["median"], 4.2)
        self.assertEqual(result["brent_minus_wti_usd_per_barrel"]["positive_dates"], 1)
        self.assertEqual(result["brent_minus_wti_usd_per_barrel"]["negative_dates"], 1)
        self.assertEqual(result["asof_eligible_dates"], 0)
        self.assertEqual(result["relationships"], [])
        self.assertEqual(result["predictive_advantage"], "not_established")

    def test_rejects_unverified_claim_of_publication(self):
        self.panel["publication_time_verified"] = True
        with self.assertRaises(ValueError):
            descriptive_report(self.panel)

    def test_rejects_nonfinite_numbers(self):
        self.panel["observations"][0]["wti_usd_per_barrel"] = float("nan")
        with self.assertRaises(ValueError):
            descriptive_report(self.panel)

    def test_single_observation_has_no_sample_standard_deviation(self):
        self.panel["observations"] = self.panel["observations"][:1]
        report = descriptive_report(self.panel)
        self.assertIsNone(report["brent_minus_wti_usd_per_barrel"]["standard_deviation"])
        self.assertIsNone(report["treasury_10y_percent"]["standard_deviation"])

    def test_verify_report_against_panel(self):
        report = descriptive_report(self.panel)
        result = verify_descriptive_report(self.panel, report)
        self.assertEqual(result["status"], "verified_against_supplied_panel")

    def test_verify_report_rejects_modified_spread(self):
        report = descriptive_report(self.panel)
        report["brent_minus_wti_usd_per_barrel"]["mean"] = 99
        with self.assertRaises(ValueError):
            verify_descriptive_report(self.panel, report)

    def test_rejects_noncanonical_date(self):
        self.panel["observations"][0]["date"] = "2025-1-2"
        with self.assertRaises(ValueError):
            descriptive_report(self.panel)

    def test_rejects_duplicate_dates(self):
        self.panel["observations"][1]["date"] = "2025-01-02"
        with self.assertRaises(ValueError):
            descriptive_report(self.panel)


if __name__ == "__main__":
    unittest.main()
