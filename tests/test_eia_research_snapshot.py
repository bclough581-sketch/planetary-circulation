import unittest
from datetime import date
from intelligence.eia_research_snapshot import validate_dates


class EiaResearchSnapshotTests(unittest.TestCase):
    def test_current_dates_accepted(self):
        validate_dates({"HOU": {"asof": "2026-11-03"}, "DXB": {"asof": "2026-11-03"}}, date(2026, 11, 4))

    def test_stale_date_rejected(self):
        with self.assertRaisesRegex(ValueError, "freshness"):
            validate_dates({"HOU": {"asof": "2026-10-27"}, "DXB": {"asof": "2026-11-03"}}, date(2026, 11, 4))

    def test_future_date_rejected(self):
        with self.assertRaisesRegex(ValueError, "freshness"):
            validate_dates({"HOU": {"asof": "2026-11-05"}, "DXB": {"asof": "2026-11-03"}}, date(2026, 11, 4))

    def test_missing_hub_rejected(self):
        with self.assertRaisesRegex(ValueError, "Missing"):
            validate_dates({"HOU": {"asof": "2026-11-03"}}, date(2026, 11, 4))


if __name__ == "__main__":
    unittest.main()
