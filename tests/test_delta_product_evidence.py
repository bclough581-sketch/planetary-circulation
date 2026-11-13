"""Product updates must not alter the frozen research inputs or historical case."""
import hashlib
import json
from pathlib import Path
import unittest
from scripts.build_delta_product_evidence import ROOT, render


class DeltaProductEvidenceTests(unittest.TestCase):
    def test_research_boundary_content_unchanged(self):
        # Normalize only line endings so the same fixture hashes work in clean
        # Linux and Windows checkouts. Git diff separately verifies no edits.
        expected = {
            "intelligence/data/delta-quarterly-curated.json": "c838853a773acbecdbdb9effd3d085346a15241abec8abf7ffd295ecdced291e",
            "ring-evidence.js": "23781f4835839ffe13a60e69be998967a6c3e78f0cff28d1904ed3933159a6e2",
            "convergence-research.html": "36ccbbb1b1a6c39feeedefa494f38ae39bc30bf5b030e7a69ad88465ded9658d",
        }
        for name, digest in expected.items():
            with self.subTest(name=name):
                self.assertEqual(hashlib.sha256((ROOT/name).read_text(encoding="utf-8").encode()).hexdigest(), digest)

    def test_product_bundle_reproduces_exactly(self):
        self.assertEqual((ROOT/"delta-company-evidence.js").read_text(encoding="utf-8"), render())

    def test_gaap_definitions_provenance_and_verified_transcription(self):
        data = json.loads((ROOT/"product-data/delta-company-evidence.json").read_text())
        self.assertEqual(data["schema"], "amalgam.delta-company-evidence.v1")
        self.assertEqual(data["metric_definitions"]["fuelExpense"], "Aircraft fuel and related taxes")
        self.assertFalse(data["publication_time_verified"])
        rows = {r["period"]: r for r in data["observations"]}
        for period, values in {"2026Q1": (15854, 501, 2742), "2026Q2": (19757, 1864, 4109), "2026Q3": (20186, 1454, 4351)}.items():
            with self.subTest(period=period):
                self.assertEqual(tuple(rows[period][k] for k in ("revenue", "operatingIncome", "fuelExpense")), values)
                source = data["sources"][rows[period]["source"]]
                self.assertRegex(source["raw_sha256"], r"^[a-f0-9]{64}$")
                self.assertTrue(source["retrieved_utc"].startswith("2026-11-13T"))
                self.assertEqual(source["reported_period"], period)
        research = json.loads((ROOT/"intelligence/data/delta-quarterly-curated.json").read_text())
        for old in research["observations"]:
            if old["period"] in rows:
                self.assertEqual(tuple(old[k] for k in ("revenue", "operatingIncome", "fuelExpense")), tuple(rows[old["period"]][k] for k in ("revenue", "operatingIncome", "fuelExpense")))


if __name__ == "__main__":
    unittest.main()
