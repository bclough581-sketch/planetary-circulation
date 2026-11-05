import unittest
from copy import deepcopy
from datetime import datetime, timezone
from intelligence.research_view import build, validate_view


class ResearchViewTests(unittest.TestCase):
    def test_failed_feed_never_enters_ring(self):
        snapshot = {
            "generated_utc": "2026-11-04T02:10:55Z",
            "hubs": {"HOU": {"src": "eia", "price": 72, "asof": "2026-11-03"}},
            "chokepoints": [{"id": "HRM", "name": "Hormuz", "ratio": 0.1, "asof": "2026-11-04"}],
            "status": {"eia": {"ok": True}, "portwatch": {"ok": False}},
        }
        now = datetime(2026, 11, 4, 12, tzinfo=timezone.utc)
        result = build(snapshot, {"features": []}, now)
        self.assertEqual(result["domains"]["energy"], 1)
        self.assertEqual(result["domains"]["maritime"], 0)
        self.assertEqual(result["relationships"], [])
        self.assertEqual(result["licensing"]["portwatch_commercial_reuse"], "permission_not_verified")
        self.assertEqual(next(x for x in result["feed_health"] if x["feed"] == "portwatch")["condition"], "collector_failed")
        self.assertTrue(any(x["reason"] == "source collector failed" for x in result["excluded"]))
        self.assertEqual(result["predictive_advantage"], "not_established")

    def test_validation_rejects_misleading_totals_and_claims(self):
        now = datetime(2026, 11, 4, 12, tzinfo=timezone.utc)
        snapshot = {"hubs": {"HOU": {"src": "eia", "price": 72, "asof": "2026-11-03"}},
                    "status": {"eia": {"ok": True}}}
        good = build(snapshot, {"features": []}, now)
        self.assertTrue(validate_view(good))
        self.assertEqual(good["generated_utc"], "2026-11-04T12:00:00+00:00")
        self.assertEqual(good["relationship_readiness"]["status"], "not_ready")
        for mutation in ("count", "duplicate", "claim", "source", "license", "health", "timestamp", "readiness_missing", "readiness_forged", "readiness_dates", "event_status", "event_probability", "naive_observation", "post_generation_observation"):
            bad = deepcopy(good)
            if mutation == "count":
                bad["domains"]["energy"] = 20
            elif mutation == "duplicate":
                bad["observations"].append(deepcopy(bad["observations"][0]))
                bad["domains"]["energy"] += 1
            elif mutation == "claim":
                bad["predictive_advantage"] = "established"
            elif mutation == "license":
                bad["licensing"]["portwatch_commercial_reuse"] = "permitted"
            elif mutation == "timestamp":
                bad.pop("generated_utc")
            elif mutation == "readiness_missing":
                bad.pop("relationship_readiness")
            elif mutation == "readiness_forged":
                bad["relationship_readiness"]["historical_relationships_validated"] = 1
            elif mutation == "readiness_dates":
                bad["relationship_readiness"]["distinct_observation_dates"]["energy"] = 999
            elif mutation == "naive_observation":
                bad["observations"][0]["observed_at"] = "2026-11-03T00:00:00"
            elif mutation == "post_generation_observation":
                bad["observations"][0]["observed_at"] = "2026-11-04T12:00:01Z"
            elif mutation == "event_status":
                bad["observations"][0]["status"] = "validated"
            elif mutation == "event_probability":
                bad["observations"][0]["probability"] = 0.95
            elif mutation == "health":
                bad.pop("feed_health")
            else:
                bad["observations"][0]["source"]["url"] = ""
            with self.subTest(mutation=mutation), self.assertRaises(ValueError):
                validate_view(bad)


if __name__ == "__main__":
    unittest.main()
