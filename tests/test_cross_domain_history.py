import unittest
from intelligence.cross_domain_history import build


def energy(rows):
    return {"schema": "amalgam.eia-history.v1", "source": "EIA",
            "source_url": "https://www.eia.gov/opendata/", "retrieved_utc": "2026-11-04T00:00:00+00:00",
            "predictive_advantage": "not_established", "observations": rows}


def treasury(rows):
    return {"schema": "amalgam.treasury-history.v1", "source": "Treasury",
            "source_url": "https://home.treasury.gov/", "retrieved_utc": "2026-11-04T00:00:00+00:00",
            "predictive_advantage": "not_established", "observations": rows}


class CrossDomainHistoryTests(unittest.TestCase):
    def test_exact_dates_only_and_no_lookahead_claim(self):
        e = energy([{"date": "2025-01-02", "series": "RWTC", "value": 70},
                    {"date": "2025-01-02", "series": "RBRTE", "value": 75},
                    {"date": "2025-01-03", "series": "RWTC", "value": 71},
                    {"date": "2025-01-03", "series": "RBRTE", "value": 76}])
        t = treasury([{"date": "2025-01-02", "ten_year_yield_percent": 4.4}])
        result = build(e, t)
        self.assertEqual(len(result["observations"]), 1)
        self.assertEqual(result["observations"][0]["date"], "2025-01-02")
        self.assertFalse(result["publication_time_verified"])
        self.assertEqual(result["predictive_advantage"], "not_established")
        self.assertEqual(result["relationships"], [])

    def test_no_common_date_rejected(self):
        e = energy([{"date": "2025-01-02", "series": "RWTC", "value": 70},
                    {"date": "2025-01-02", "series": "RBRTE", "value": 75}])
        t = treasury([{"date": "2025-01-03", "ten_year_yield_percent": 4.4}])
        with self.assertRaisesRegex(ValueError, "no common dates"):
            build(e, t)

    def test_conflicting_treasury_values_rejected(self):
        e = energy([{"date": "2025-01-02", "series": "RWTC", "value": 70},
                    {"date": "2025-01-02", "series": "RBRTE", "value": 75}])
        t = treasury([{"date": "2025-01-02", "ten_year_yield_percent": 4.4},
                      {"date": "2025-01-02", "ten_year_yield_percent": 4.5}])
        with self.assertRaisesRegex(ValueError, "conflicting"):
            build(e, t)


if __name__ == "__main__":
    unittest.main()
