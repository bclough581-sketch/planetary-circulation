import unittest
from intelligence.decision_schedule import audit_decision_schedule


class DecisionScheduleTests(unittest.TestCase):
    def setUp(self):
        self.panel = {"schema": "amalgam.cross-domain-observation-panel.v1",
                      "predictive_advantage": "not_established",
                      "observations": [{"date": "2025-01-02"}, {"date": "2025-01-03"}]}

    def test_missing_decision_is_visible_and_blocks(self):
        result = audit_decision_schedule(self.panel, {"2025-01-02": "2025-01-02T20:00:00Z"})
        self.assertEqual(result["missing_dates"], ["2025-01-03"])
        self.assertFalse(result["schedule_complete"])
        self.assertEqual(result["asof_eligible_count"], 0)

    def test_complete_schedule_still_cannot_prove_publication(self):
        result = audit_decision_schedule(self.panel, {
            "2025-01-02": "2025-01-02T20:00:00Z",
            "2025-01-03": "2025-01-03T20:00:00Z"})
        self.assertTrue(result["schedule_complete"])
        self.assertEqual(result["asof_eligible_count"], 0)

    def test_invalid_and_extra_dates(self):
        result = audit_decision_schedule(self.panel, {
            "2025-01-02": "2025-01-01T20:00:00Z",
            "2025-01-03": "not a timestamp",
            "2025-01-04": "2025-01-04T20:00:00Z"})
        self.assertEqual(len(result["invalid_dates"]), 2)
        self.assertEqual(result["extra_dates"], ["2025-01-04"])

    def test_unsupported_claim_rejected(self):
        self.panel["predictive_advantage"] = "established"
        with self.assertRaisesRegex(ValueError, "predictive"):
            audit_decision_schedule(self.panel, {})


if __name__ == "__main__":
    unittest.main()
