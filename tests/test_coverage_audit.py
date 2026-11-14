import unittest

from intelligence.coverage_audit import coverage_report


class CoverageAuditTests(unittest.TestCase):
    def setUp(self):
        self.energy = {"predictive_advantage": "not_established",
                       "observations": [{"series": "RWTC", "date": "2025-01-02"},
                                        {"series": "RBRTE", "date": "2025-01-02"},
                                        {"series": "RWTC", "date": "2025-01-03"}]}
        self.treasury = {"predictive_advantage": "not_established",
                         "observations": [{"date": "2025-01-02"},
                                          {"date": "2025-01-06"}]}
        self.panel = {"predictive_advantage": "not_established",
                      "observations": [{"date": "2025-01-02"}]}

    def test_exact_date_coverage(self):
        result = coverage_report(self.energy, self.treasury, self.panel)
        self.assertEqual(result["exact_three_series_dates"], 1)
        self.assertEqual(result["wti_without_brent"], ["2025-01-03"])
        self.assertEqual(result["treasury_without_paired_oil"], ["2025-01-06"])

    def test_missing_join_date_rejected(self):
        self.panel["observations"] = []
        with self.assertRaisesRegex(ValueError, "intersection"):
            coverage_report(self.energy, self.treasury, self.panel)

    def test_duplicate_energy_date_rejected(self):
        self.energy["observations"].append({"series": "RWTC", "date": "2025-01-02"})
        with self.assertRaisesRegex(ValueError, "duplicate"):
            coverage_report(self.energy, self.treasury, self.panel)

    def test_predictive_claim_rejected(self):
        self.panel["predictive_advantage"] = "established"
        with self.assertRaisesRegex(ValueError, "predictive"):
            coverage_report(self.energy, self.treasury, self.panel)


if __name__ == "__main__":
    unittest.main()
