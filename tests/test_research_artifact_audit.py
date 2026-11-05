import unittest
from unittest.mock import patch

from intelligence.research_artifact_audit import render_text, summarize


class ResearchArtifactAuditTests(unittest.TestCase):
    def setUp(self):
        self.view = {
            "generated_utc": "2026-11-05T12:00:00+00:00",
            "observations": [{"id": "a", "domain": "weather"}],
            "excluded": [
                {"id": "b", "reason": "stale"},
                {"id": "c", "reason": "stale"},
                {"id": "d", "reason": "missing provenance"},
            ],
            "domains": {"weather": 1, "energy": 0},
            "feed_health": [
                {"feed": "portwatch", "condition": "collector_failed", "collector_ok": False},
            ],
            "relationship_readiness": {
                "status": "not_ready",
                "point_in_time_availability": "not_verified",
                "historical_candidate_review": {"blocked": 1},
                "historical_candidate_block_reasons": {"publication unverified": 1},
                "blocking_reasons": ["Source publication time is not independently verified."],
            },
            "relationships": [],
            "predictive_advantage": "not_established",
            "licensing": {"portwatch_commercial_reuse": "permission_not_verified"},
        }

    @patch("intelligence.research_artifact_audit.validate_view", return_value=True)
    def test_audit_counts_and_exclusion_reasons(self, validator):
        result = summarize(self.view)
        self.assertEqual(result["included_observations"], 1)
        self.assertEqual(result["excluded_observations"], 3)
        self.assertEqual(result["exclusion_reasons"], {"missing provenance": 1, "stale": 2})
        validator.assert_called_once_with(self.view)

    @patch("intelligence.research_artifact_audit.validate_view", return_value=True)
    def test_missing_feed_is_not_reported_as_zero_activity(self, _):
        result = summarize(self.view)
        rendered = render_text(result)
        self.assertIn("portwatch: collector_failed", rendered)
        self.assertIn("energy: 0", rendered)
        self.assertIn("Predictive advantage: not_established", rendered)
        self.assertIn("Point-in-time availability: not_verified", rendered)
        self.assertIn("permission_not_verified", rendered)

    @patch("intelligence.research_artifact_audit.validate_view", side_effect=ValueError("invalid view"))
    def test_rejects_invalid_research_view(self, _):
        with self.assertRaisesRegex(ValueError, "invalid view"):
            summarize(self.view)


if __name__ == "__main__":
    unittest.main()
