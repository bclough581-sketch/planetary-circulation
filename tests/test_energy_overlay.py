import unittest
from unittest.mock import patch
from intelligence.energy_overlay import refresh_energy


class EnergyOverlayTests(unittest.TestCase):
    @patch("intelligence.energy_overlay.build")
    def test_overlay_only_replaces_energy_and_does_not_mutate_input(self, fetch):
        fetch.return_value = {"hubs": {
            "HOU": {"asof": "2026-11-03", "price": 77, "src": "eia"},
            "DXB": {"asof": "2026-11-03", "price": 81, "src": "eia"}},
            "source": "U.S. Energy Information Administration",
            "generated_utc": "2026-11-04T19:00:00Z"}
        original = {"hubs": {"HOU": {"asof": "2026-10-27", "price": 65, "src": "eia"},
                              "FRA": {"asof": "2026-11-03", "price": 1.1, "src": "ecb"}},
                    "status": {"eia": {"ok": False}, "portwatch": {"ok": False}},
                    "chokepoints": [{"id": "HRM", "ratio": 0.9}]}
        result = refresh_energy(original)
        self.assertEqual(result["hubs"]["HOU"]["price"], 77)
        self.assertEqual(result["hubs"]["FRA"], original["hubs"]["FRA"])
        self.assertEqual(result["status"]["portwatch"], {"ok": False})
        self.assertEqual(result["chokepoints"], original["chokepoints"])
        self.assertEqual(original["hubs"]["HOU"]["price"], 65)
        self.assertTrue(result["status"]["eia"]["research_only"])


if __name__ == "__main__":
    unittest.main()
