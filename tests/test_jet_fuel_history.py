import unittest
from intelligence.jet_fuel_history import build, SERIES


class JetFuelTests(unittest.TestCase):
    def row(self, **changes):
        return dict(series=SERIES, period="2025-01", value="2.347", units="Dollars per Gallon", **changes)

    def build_rows(self, rows, total=None):
        return build("2025-01", "2025-03", key="test", fetch=lambda _: {"response": {"data": rows, "total": len(rows) if total is None else total}})

    def test_api_unit_notation(self):
        result = self.build_rows([{**self.row(), "units": "$/GAL"}])
        self.assertEqual(result["unit"], "USD_per_gallon")

    def test_gaps_and_boundaries(self):
        result = self.build_rows([self.row()])
        self.assertEqual(result["missing_months"], ["2025-02", "2025-03"])
        self.assertEqual(result["observations"][0]["value"], 2.347)
        self.assertFalse(result["publication_time_verified"])
        self.assertNotIn("api_key", str(result))

    def test_bad_values_excluded(self):
        for value in (None, True, "NaN", "Infinity", -1, 0):
            bad = {**self.row(), "value": value, "period": "2025-02"}
            result = self.build_rows([self.row(), bad])
            self.assertEqual(len(result["excluded"]), 1)
            self.assertIn("2025-02", result["missing_months"])

    def test_wrong_units_series_and_conflicts(self):
        for changes in ({"units": "Dollars per Barrel"}, {"series": "RWTC"}, {"value": 9}, {"period": "bad"}):
            with self.assertRaises(ValueError):
                self.build_rows([self.row(), {**self.row(), **changes}])

    def test_truncation_and_empty(self):
        with self.assertRaises(ValueError):
            self.build_rows([self.row()], 2)
        with self.assertRaises(ValueError):
            self.build_rows([])
