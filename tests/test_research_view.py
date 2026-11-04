import unittest
from datetime import datetime, timezone
from intelligence.research_view import build


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
        self.assertTrue(any(x["reason"] == "source collector failed" for x in result["excluded"]))
        self.assertEqual(result["predictive_advantage"], "not_established")


if __name__ == "__main__":
    unittest.main()
