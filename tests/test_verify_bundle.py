import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from intelligence.point_in_time import assess_asof
from intelligence.verify_bundle import verify_bundle


class BundleVerificationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        panel = {"schema": "amalgam.cross-domain-observation-panel.v1",
                 "observations": [{"date": "2025-01-02", "wti_usd_per_barrel": 70,
                                   "brent_usd_per_barrel": 75, "treasury_10y_percent": 4.4}]}
        audit = assess_asof(panel, "2026-11-04T00:00:00Z")
        values = {"eia-history-research.json": {"schema": "test"},
                  "treasury-history-research.json": {"schema": "test"},
                  "cross-domain-observation-panel.json": panel,
                  "point-in-time-audit.json": audit}
        hashes = {}
        for name, value in values.items():
            path = self.root / name
            path.write_text(json.dumps(value), encoding="utf-8")
            hashes[name] = hashlib.sha256(path.read_bytes()).hexdigest()
        self.manifest = {"schema": "amalgam.research-artifact-manifest.v1",
                         "files": hashes, "workflow_run_id": "41925963100",
                         "commit_sha": "a" * 40, "predictive_advantage": "not_established"}
        self.save_manifest()

    def save_manifest(self):
        (self.root / "research-artifact-manifest.json").write_text(
            json.dumps(self.manifest), encoding="utf-8")

    def test_valid_bundle(self):
        self.assertEqual(verify_bundle(self.root)["observations"], 1)

    def test_tampered_file(self):
        (self.root / "point-in-time-audit.json").write_text("{}", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "checksum mismatch"):
            verify_bundle(self.root)

    def test_missing_file_entry(self):
        self.manifest["files"].pop("point-in-time-audit.json")
        self.save_manifest()
        with self.assertRaisesRegex(ValueError, "exactly four"):
            verify_bundle(self.root)

    def test_forged_audit_with_recomputed_checksum(self):
        path = self.root / "point-in-time-audit.json"
        audit = json.loads(path.read_text())
        audit["blocked"][0]["reason"] = "published_after_decision"
        path.write_text(json.dumps(audit), encoding="utf-8")
        self.manifest["files"][path.name] = hashlib.sha256(path.read_bytes()).hexdigest()
        self.save_manifest()
        with self.assertRaisesRegex(ValueError, "reason"):
            verify_bundle(self.root)


if __name__ == "__main__":
    unittest.main()
