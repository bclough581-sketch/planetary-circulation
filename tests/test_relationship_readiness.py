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

    def test_same_day_overlap_is_descriptive_not_predictive(self):
        view = {"observations": [
            {"domain": "weather", "observed_at": "2026-11-03T22:00:00-02:00"},
            {"domain": "weather", "observed_at": "2026-11-04T06:00:00Z"},
            {"domain": "weather", "observed_at": "2026-11-05T06:00:00Z"},
            {"domain": "energy", "observed_at": "2026-11-04T01:00:00Z"},
            {"domain": "energy", "observed_at": "2026-11-06T01:00:00Z"},
            {"domain": "economics", "observed_at": "2026-11-06T02:00:00Z"},
        ]}
        result = audit_readiness(view)
        self.assertEqual(result["same_utc_date_overlap"], {
            "economics|energy": 1, "energy|weather": 1
        })
        self.assertEqual(result["historical_relationships_validated"], 0)
        self.assertEqual(result["predictive_advantage"], "not_established")
        self.assertEqual(result["status"], "not_ready")

    def test_observation_dates_never_imply_point_in_time_availability(self):
        view = {"observations": [
            {"domain": "energy", "observed_at": "2026-11-04T00:00:00Z"},
            {"domain": "weather", "observed_at": "2026-11-04T00:00:00Z"},
        ]}
        result = audit_readiness(view)
        self.assertEqual(result["same_utc_date_overlap"], {"energy|weather": 1})
        self.assertEqual(result["point_in_time_availability"], "not_verified")
        self.assertTrue(any("publicly available" in reason
                            for reason in result["blocking_reasons"]))
        self.assertEqual(result["predictive_advantage"], "not_established")

    def test_publication_timestamp_claims_are_counted_but_never_trusted(self):
        view = {"observations": [
            {"domain": "energy", "observed_at": "2026-11-03T00:00:00Z",
             "metadata": {"published_at": "2026-11-04T08:30:00-05:00"}},
            {"domain": "weather", "observed_at": "2026-11-04T00:00:00Z",
             "metadata": {"published_at": "2026-11-04T08:30:00"}},
            {"domain": "energy", "observed_at": "2026-11-04T00:00:00Z",
             "metadata": {"published_at": "not-a-timestamp"}},
            {"domain": "economics", "observed_at": "2026-11-04T00:00:00Z"},
        ]}
        result = audit_readiness(view)
        self.assertEqual(result["unverified_publication_timestamp_claims"], {"energy": 1})
        self.assertEqual(result["point_in_time_availability"], "not_verified")
        self.assertEqual(result["historical_relationships_validated"], 0)
        self.assertEqual(result["predictive_advantage"], "not_established")

    def test_future_publication_claim_is_flagged_without_predictive_promotion(self):
        view = {"generated_utc": "2026-11-04T12:00:00Z", "observations": [
            {"domain": "energy", "observed_at": "2026-11-03T00:00:00Z",
             "metadata": {"published_at": "2026-11-04T09:00:00-05:00"}},
            {"domain": "weather", "observed_at": "2026-11-04T00:00:00Z",
             "metadata": {"published_at": "2026-11-04T10:00:00Z"}},
        ]}
        result = audit_readiness(view)
        self.assertEqual(result["unverified_publication_timestamp_claims"],
                         {"energy": 1, "weather": 1})
        self.assertEqual(result["publication_claims_after_generation"], {"energy": 1})
        self.assertEqual(result["point_in_time_availability"], "not_verified")
        self.assertEqual(result["predictive_advantage"], "not_established")

    def test_historical_candidate_review_requires_both_availability_timestamps(self):
        view = {"generated_utc": "2026-11-04T12:00:00Z", "observations": [
            {"id": "complete", "domain": "energy",
             "source": {"url": "https://www.eia.gov/opendata/"},
             "observed_at": "2026-11-01T00:00:00Z",
             "metadata": {"published_at": "2026-11-02T00:00:00Z",
                          "first_seen_at": "2026-11-03T00:00:00Z"}},
            {"id": "missing", "domain": "weather",
             "source": {"url": "https://www.weather.gov/"},
             "observed_at": "2026-11-01T00:00:00Z", "metadata": {}},
            {"id": "late", "domain": "energy",
             "source": {"url": "https://www.eia.gov/opendata/"},
             "observed_at": "2026-11-01T00:00:00Z",
             "metadata": {"published_at": "2026-11-05T00:00:00Z",
                          "first_seen_at": "2026-11-03T00:00:00Z"}},
        ]}
        result = audit_readiness(view)
        self.assertEqual(result["historical_candidate_review"],
                         {"blocked": 2, "reviewable": 1})
        self.assertEqual(result["historical_candidate_block_reasons"],
                         {"invalid published_at": 1, "published_at postdates decision": 1})
        self.assertEqual(result["point_in_time_availability"], "not_verified")
        self.assertEqual(result["predictive_advantage"], "not_established")

    def test_historical_block_reasons_include_inconsistent_capture_order(self):
        view = {"generated_utc": "2026-11-04T12:00:00Z", "observations": [
            {"id": "early", "domain": "energy",
             "source": {"url": "https://www.eia.gov/opendata/"},
             "observed_at": "2026-11-01T00:00:00Z",
             "metadata": {"published_at": "2026-11-03T00:00:00Z",
                          "first_seen_at": "2026-11-02T00:00:00Z"}},
        ]}
        result = audit_readiness(view)
        self.assertEqual(result["historical_candidate_review"], {"blocked": 1})
        self.assertEqual(result["historical_candidate_block_reasons"],
                         {"capture predates claimed publication": 1})
        self.assertEqual(result["point_in_time_availability"], "not_verified")
        self.assertEqual(result["predictive_advantage"], "not_established")

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


class PointInTimeLedgerRegressionTests(unittest.TestCase):
    def test_future_publication_rejected(self):
        from intelligence.point_in_time_ledger import assess_candidate
        record = {
            "id": "sample", "domain": "energy", "source_url": "https://www.eia.gov/opendata/",
            "observed_at": "2026-11-01T00:00:00Z",
            "published_at": "2026-11-04T08:00:00-05:00",
            "first_seen_at": "2026-11-03T15:00:00Z",
        }
        result = assess_candidate(record, "2026-11-04T12:00:00Z")
        self.assertFalse(result["eligible_for_review"])
        self.assertFalse(result["point_in_time_verified"])

    def test_capture_before_publication_is_not_verified(self):
        from intelligence.point_in_time_ledger import assess_candidate
        record = {
            "id": "early-capture", "domain": "energy",
            "source_url": "https://www.eia.gov/opendata/",
            "observed_at": "2026-11-01T00:00:00Z",
            "published_at": "2026-11-03T00:00:00Z",
            "first_seen_at": "2026-11-02T00:00:00Z",
        }
        result = assess_candidate(record, "2026-11-04T12:00:00Z")
        self.assertFalse(result["point_in_time_verified"])
        self.assertFalse(result["eligible_for_review"])

    def test_cutoff_is_timezone_normalized_and_inclusive(self):
        from intelligence.point_in_time_ledger import assess_candidate
        record = {
            "id": "boundary", "domain": "energy",
            "source_url": "https://www.eia.gov/opendata/",
            "observed_at": "2026-11-01T00:00:00Z",
            "published_at": "2026-11-04T06:00:00-05:00",
            "first_seen_at": "2026-11-04T12:00:00Z",
        }
        at_cutoff = assess_candidate(record, "2026-11-04T07:00:00-05:00")
        before_cutoff = assess_candidate(record, "2026-11-04T11:59:59Z")
        self.assertTrue(at_cutoff["eligible_for_review"])
        self.assertFalse(at_cutoff["point_in_time_verified"])
        self.assertFalse(before_cutoff["eligible_for_review"])

    def test_plausible_capture_never_verifies_availability(self):
        from intelligence.point_in_time_ledger import assess_candidate
        record = {
            "id": "sample", "domain": "energy", "source_url": "https://www.eia.gov/opendata/",
            "observed_at": "2026-11-01T00:00:00Z",
            "published_at": "2026-11-02T00:00:00Z",
            "first_seen_at": "2026-11-03T00:00:00Z",
        }
        result = assess_candidate(record, "2026-11-04T12:00:00Z")
        self.assertTrue(result["eligible_for_review"])
        self.assertFalse(result["point_in_time_verified"])


if __name__ == "__main__":
    unittest.main()
