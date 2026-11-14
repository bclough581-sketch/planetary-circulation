import unittest
from datetime import datetime, timezone
from intelligence.feed_audit import audit


class FeedAuditTests(unittest.TestCase):
    def test_failure_and_staleness_distinguished(self):
        snapshot = {
            "hubs": {"HOU": {"src": "eia", "asof": "2026-10-27"},
                     "GRU": {"src": "ecb", "asof": "2026-11-03"},
                     "NYC": {"src": "ust", "asof": "2026-11-03"}},
            "chokepoints": [{"id": "HRM", "asof": "2026-10-25"}],
            "status": {"eia": {"ok": True}, "ecb": {"ok": True},
                       "ust": {"ok": True}, "portwatch": {"ok": False, "error": "Invalid URL"}},
        }
        now = datetime(2026, 11, 4, 19, tzinfo=timezone.utc)
        result = {row["feed"]: row for row in audit(snapshot, now)}
        self.assertEqual(result["eia"]["condition"], "outside_freshness_window")
        self.assertEqual(result["portwatch"]["condition"], "collector_failed")
        self.assertFalse(result["portwatch"]["eligible_for_live_convergence"])
        self.assertTrue(result["ecb"]["eligible_for_live_convergence"])


if __name__ == "__main__":
    unittest.main()
