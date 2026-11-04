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
        for mutation in ("count", "duplicate", "claim", "source"):
            bad = deepcopy(good)
            if mutation == "count":
                bad["domains"]["energy"] = 20
            elif mutation == "duplicate":
                bad["observations"].append(deepcopy(bad["observations"][0]))
                bad["domains"]["energy"] += 1
            elif mutation == "claim":
                bad["predictive_advantage"] = "established"
            else:
                bad["observations"][0]["source"]["url"] = ""
            with self.subTest(mutation=mutation), self.assertRaises(ValueError):
                validate_view(bad)


if __name__ == "__main__":
    unittest.main()
