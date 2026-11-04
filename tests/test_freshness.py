import unittest
from datetime import datetime, timezone
from intelligence.freshness import eligible


class FreshnessTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime(2026, 11, 4, 12, tzinfo=timezone.utc)
        self.snapshot = {"status": {"eia": {"ok": True}, "portwatch": {"ok": False}},
                         "hubs": {"HOU": {"src": "eia"}}}

    def test_current_energy_allowed(self):
        event = {"domain": "energy", "observed_at": "2026-11-03T00:00:00Z",
                 "source": {"name": "U.S. Energy Information Administration"},
                 "metadata": {"hub": "HOU"}}
        self.assertEqual(eligible(event, self.snapshot, self.now), (True, None))

    def test_failed_portwatch_excluded(self):
        event = {"domain": "maritime", "observed_at": "2026-11-04T00:00:00Z",
                 "source": {"name": "IMF PortWatch"}}
        self.assertEqual(eligible(event, self.snapshot, self.now)[1], "source collector failed")

    def test_old_energy_excluded(self):
        event = {"domain": "energy", "observed_at": "2026-10-20T00:00:00Z",
                 "source": {"name": "U.S. Energy Information Administration"}}
        self.assertEqual(eligible(event, self.snapshot, self.now)[1], "outside freshness window")

    def test_provenance_mismatch_excluded(self):
        event = {"domain": "energy", "observed_at": "2026-11-03T00:00:00Z",
                 "source": {"name": "U.S. Energy Information Administration"},
                 "metadata": {"hub": "HOU"}}
        self.snapshot["hubs"]["HOU"]["src"] = "ecb"
        self.assertEqual(eligible(event, self.snapshot, self.now)[1], "source provenance mismatch")


if __name__ == "__main__":
    unittest.main()
