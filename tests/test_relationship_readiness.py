import unittest
from intelligence.relationship_readiness import audit_readiness


class RelationshipReadinessTests(unittest.TestCase):
    def test_multiple_domains_in_one_snapshot_do_not_claim_validation(self):
        view = {"observations": [
            {"domain": "weather", "observed_at": "2026-11-04T12:00:00Z"},
            {"domain": "energy", "observed_at": "2026-11-04T12:00:00Z"},
        ]}
        result = audit_readiness(view)
        self.assertEqual(result["status"], "not_ready")
        self.assertEqual(result["historical_relationships_validated"], 0)
        self.assertEqual(result["predictive_advantage"], "not_established")
        self.assertEqual(result["distinct_observation_dates"], {"energy": 1, "weather": 1})
        self.assertEqual(result["multi_day_domains"], [])

    def test_utc_dates_are_normalized_and_naive_dates_are_ignored(self):
        view = {"observations": [
            {"domain": "energy", "observed_at": "2026-11-03T23:30:00-02:00"},
            {"domain": "energy", "observed_at": "2026-11-04T01:30:00Z"},
            {"domain": "energy", "observed_at": "2026-11-05T01:30:00+02:00"},
            {"domain": "weather", "observed_at": "2026-11-04T12:00:00"},
        ]}
        result = audit_readiness(view)
        self.assertEqual(result["observation_counts"], {"energy": 3, "weather": 1})
        self.assertEqual(result["distinct_observation_dates"], {"energy": 2})
        self.assertEqual(result["multi_day_domains"], ["energy"])
        self.assertEqual(result["historical_relationships_validated"], 0)

    def test_multiple_dates_still_do_not_establish_predictive_edge(self):
        view = {"observations": [
            {"domain": "weather", "observed_at": "2026-11-03T12:00:00Z"},
            {"domain": "weather", "observed_at": "2026-11-04T12:00:00Z"},
            {"domain": "energy", "observed_at": "2026-11-04T12:00:00Z"},
        ]}
        result = audit_readiness(view)
        self.assertEqual(result["multi_day_domains"], ["weather"])
        self.assertEqual(result["status"], "not_ready")
        self.assertEqual(result["historical_relationships_validated"], 0)


if __name__ == "__main__":
    unittest.main()
