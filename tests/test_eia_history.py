import unittest
from intelligence.eia_history import build, parse_rows


class EIAHistoryTests(unittest.TestCase):
    def test_parse_sorted_and_deduplicated(self):
        rows = [{"series": "RWTC", "period": "2026-10-02", "value": "72.5"},
                {"series": "RWTC", "period": "2026-10-02", "value": "72.5"},
                {"series": "RBRTE", "period": "2026-10-01", "value": "75"},
                {"series": "OTHER", "period": "2026-10-01", "value": "2"}]
        parsed = parse_rows(rows, "2026-10-01", "2026-10-03")
        self.assertEqual(len(parsed), 2)
        self.assertEqual(parsed[0]["series"], "RBRTE")

    def test_conflicting_revision_rejected(self):
        rows = [{"series": "RWTC", "period": "2026-10-02", "value": "72"},
                {"series": "RWTC", "period": "2026-10-02", "value": "73"}]
        with self.assertRaisesRegex(ValueError, "conflicting"):
            parse_rows(rows, "2026-10-01", "2026-10-03")

    def test_truncated_response_rejected(self):
        with self.assertRaisesRegex(ValueError, "truncated"):
            build("2026-10-01", "2026-10-03", key="test", fetch=lambda url: {
                "response": {"total": 2, "data": [{"series": "RWTC", "period": "2026-10-02", "value": 72}]}})

    def test_research_only_and_source_preserved(self):
        result = build("2026-10-01", "2026-10-03", key="test", fetch=lambda url: {
            "response": {"total": 1, "data": [{"series": "RWTC", "period": "2026-10-02", "value": 72}]}})
        self.assertEqual(result["predictive_advantage"], "not_established")
        self.assertEqual(result["relationships"], [])
        self.assertEqual(result["observations"][0]["value"], 72)
        self.assertEqual(result["frequency"], "daily")

    def test_missing_key_rejected(self):
        with self.assertRaisesRegex(ValueError, "required"):
            build("2026-10-01", "2026-10-03", key="", fetch=lambda url: {})


if __name__ == "__main__":
    unittest.main()
