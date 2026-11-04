import unittest
from datetime import datetime, timezone
from intelligence.freshness import eligible


class FreshnessTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime(2026, 11, 4, 12, tzinfo=timezone.utc)
        self.snapshot = {"status": {"eia": {"ok": True}, "portwatch": {"ok": False}},
                         "hubs": {"HOU": {"src": "eia", "asof": "2026-11-03", "price": 72}}}

    def weather(self, expires):
        return {"domain": "weather", "observed_at": "2026-11-04T11:00:00Z",
                "source": {"name": "NOAA National Weather Service"},
                "metadata": {"expires": expires}}

    def test_active_noaa_alert_accepted(self):
        self.assertEqual(eligible(self.weather("2026-11-04T13:00:00Z"), self.snapshot, self.now), (True, None))

    def test_expired_noaa_alert_rejected(self):
        self.assertEqual(eligible(self.weather("2026-11-04T11:30:00Z"), self.snapshot, self.now)[1], "alert expired")

    def test_missing_noaa_expiry_rejected(self):
        self.assertEqual(eligible(self.weather(None), self.snapshot, self.now)[1], "missing alert expiry")

    def test_invalid_noaa_expiry_rejected(self):
        self.assertEqual(eligible(self.weather("bad"), self.snapshot, self.now)[1], "invalid alert expiry")

    def test_unknown_source_rejected(self):
        event = self.weather("2026-11-04T13:00:00Z")
        event["source"]["name"] = "Unverified feed"
        self.assertEqual(eligible(event, self.snapshot, self.now)[1], "unrecognized source")

    def test_noaa_wrong_domain_rejected(self):
        event = self.weather("2026-11-04T13:00:00Z")
        event["domain"] = "markets"
        self.assertEqual(eligible(event, self.snapshot, self.now)[1], "source domain mismatch")

    def test_other_sources_cannot_claim_unrelated_domains(self):
        cases = [
            ("U.S. Energy Information Administration", "markets"),
            ("ECB statistics", "geopolitics"),
            ("U.S. Treasury", "energy"),
            ("IMF PortWatch", "weather"),
        ]
        for source, domain in cases:
            with self.subTest(source=source):
                event = {"domain": domain, "observed_at": "2026-11-04T11:00:00Z",
                         "source": {"name": source}}
                self.assertEqual(eligible(event, self.snapshot, self.now)[1],
                                 "source domain mismatch")

    def test_timezone_free_timestamp_rejected(self):
        event = self.weather("2026-11-04T13:00:00Z")
        event["observed_at"] = "2026-11-04T11:00:00"
        self.assertEqual(eligible(event, self.snapshot, self.now)[1], "invalid observation timestamp")

    def energy(self):
        return {"domain": "energy", "observed_at": "2026-11-03T00:00:00Z",
                "source": {"name": "U.S. Energy Information Administration"},
                "metadata": {"hub": "HOU", "asof": "2026-11-03"}, "value": 72}

    def test_current_energy_allowed(self):
        event = self.energy()
        self.assertEqual(eligible(event, self.snapshot, self.now), (True, None))

    def test_missing_hub_rejected(self):
        event = self.energy()
        event["metadata"].pop("hub")
        self.assertEqual(eligible(event, self.snapshot, self.now)[1], "missing hub provenance")

    def test_date_mismatch_rejected(self):
        event = self.energy()
        event["metadata"]["asof"] = "2026-11-02"
        self.assertEqual(eligible(event, self.snapshot, self.now)[1], "source provenance mismatch")

    def test_value_mismatch_rejected(self):
        event = self.energy()
        event["value"] = 900
        self.assertEqual(eligible(event, self.snapshot, self.now)[1], "source value mismatch")

    def test_failed_portwatch_excluded(self):
        event = {"domain": "maritime", "observed_at": "2026-11-04T00:00:00Z",
                 "source": {"name": "IMF PortWatch"}}
        self.assertEqual(eligible(event, self.snapshot, self.now)[1], "source collector failed")

    def test_old_energy_excluded(self):
        event = self.energy()
        event["observed_at"] = "2026-10-20T00:00:00Z"
        self.assertEqual(eligible(event, self.snapshot, self.now)[1], "outside freshness window")

    def test_provenance_mismatch_excluded(self):
        event = self.energy()
        self.snapshot["hubs"]["HOU"]["src"] = "ecb"
        self.assertEqual(eligible(event, self.snapshot, self.now)[1], "source provenance mismatch")


if __name__ == "__main__":
    unittest.main()
