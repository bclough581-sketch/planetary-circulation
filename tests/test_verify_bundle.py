import hashlib
from zipfile import ZipFile
import json
import tempfile
import unittest
from pathlib import Path

from intelligence.point_in_time import assess_asof
from intelligence.coverage_audit import coverage_report
from intelligence.verify_bundle import verify_bundle, verify_github_run


class BundleVerificationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        panel = {"schema": "amalgam.cross-domain-observation-panel.v1",
                 "predictive_advantage": "not_established",
                 "observations": [{"date": "2025-01-02", "wti_usd_per_barrel": 70,
                                   "brent_usd_per_barrel": 75, "treasury_10y_percent": 4.4}]}
        audit = None
        energy = {"schema": "amalgam.eia-history.v1", "source": "EIA", "source_url": "https://www.eia.gov/opendata/", "retrieved_utc": "2026-11-04T00:00:00Z", "predictive_advantage": "not_established",
                  "observations": [{"series": "RWTC", "date": "2025-01-02", "value": 70},
                                   {"series": "RBRTE", "date": "2025-01-02", "value": 75}]}
        treasury = {"schema": "amalgam.treasury-history.v1", "source": "Treasury", "source_url": "https://home.treasury.gov/", "retrieved_utc": "2026-11-04T00:00:00Z", "predictive_advantage": "not_established",
                    "observations": [{"date": "2025-01-02", "ten_year_yield_percent": 4.4}]}
        from intelligence.cross_domain_history import build as rebuild_panel
        panel = rebuild_panel(energy, treasury)
        audit = assess_asof(panel, "2026-11-04T00:00:00Z")
        values = {"eia-history-research.json": energy,
                  "treasury-history-research.json": treasury,
                  "historical-coverage-audit.json": coverage_report(energy, treasury, panel),
                  "cross-domain-observation-panel.json": panel,
                  "point-in-time-audit.json": audit}
        hashes = {}
        for name, value in values.items():
            path = self.root / name
            path.write_text(json.dumps(value), encoding="utf-8")
            hashes[name] = hashlib.sha256(path.read_bytes()).hexdigest()
        self.manifest = {"schema": "amalgam.research-artifact-manifest.v1",
                         "files": hashes, "workflow_run_id": "41925963100",
                         "commit_sha": "a" * 40, "repository": "bclough581-sketch/planetary-circulation",
                         "workflow_url": "https://github.com/bclough581-sketch/planetary-circulation/actions/runs/41925963100",
                         "predictive_advantage": "not_established",
                         "historical_decision_schedule": {
                             "status": "not_supplied",
                             "scheduled_observations": 0,
                             "asof_eligible_observations": 0,
                             "note": "No historical decision timestamps were provided or inferred."}}
        self.save_manifest()

    def save_manifest(self):
        (self.root / "research-artifact-manifest.json").write_text(
            json.dumps(self.manifest), encoding="utf-8")

    def test_valid_bundle(self):
        self.assertEqual(verify_bundle(self.root)["observations"], 1)

    def test_github_run_metadata_matches(self):
        def fake_fetch(url):
            if url.endswith("/artifacts?per_page=100"):
                return {"artifacts": [{"id": 12, "name": "amalgam-cross-domain-history-41925963100",
                                       "expired": False, "workflow_run": {"id": 41925963100,
                                                                         "head_sha": "a" * 40}}]}
            self.assertTrue(url.endswith("/actions/runs/41925963100"))
            return {"id": 41925963100, "head_sha": "a" * 40,
                    "head_branch": "amalgam-event-foundation",
                    "status": "completed", "conclusion": "success",
                    "name": "intelligence-cross-domain-history-research",
                    "html_url": self.manifest["workflow_url"]}
        self.assertEqual(verify_github_run(self.root, fake_fetch)["status"],
                         "github_run_and_artifact_metadata_matched")

    def test_github_artifact_zip_digest_and_contents(self):
        archive = self.root / "artifact.zip"
        with ZipFile(archive, "w") as zipfile:
            for name in sorted(self.manifest["files"]):
                zipfile.write(self.root / name, arcname=name)
            zipfile.write(self.root / "research-artifact-manifest.json",
                          arcname="research-artifact-manifest.json")
        digest = "sha256:" + hashlib.sha256(archive.read_bytes()).hexdigest()
        def fake_fetch(url):
            if "/artifacts?" in url:
                return {"artifacts": [{"id": 12, "name": "amalgam-cross-domain-history-41925963100",
                                       "expired": False, "digest": digest,
                                       "workflow_run": {"id": 41925963100, "head_sha": "a" * 40}}]}
            return {"id": 41925963100, "head_sha": "a" * 40,
                    "head_branch": "amalgam-event-foundation",
                    "status": "completed", "conclusion": "success",
                    "name": "intelligence-cross-domain-history-research",
                    "html_url": self.manifest["workflow_url"]}
        self.assertEqual(verify_github_run(self.root, fake_fetch, archive)["status"],
                         "github_artifact_zip_digest_matched")
        with archive.open("ab") as stream:
            stream.write(b"tamper")
        with self.assertRaisesRegex(ValueError, "digest mismatch"):
            verify_github_run(self.root, fake_fetch, archive)

    def test_github_artifact_missing_rejected(self):
        def fake_fetch(url):
            if "/artifacts?" in url:
                return {"artifacts": []}
            return {"id": 41925963100, "head_sha": "a" * 40,
                    "head_branch": "amalgam-event-foundation",
                    "status": "completed", "conclusion": "success",
                    "name": "intelligence-cross-domain-history-research",
                    "html_url": self.manifest["workflow_url"]}
        with self.assertRaisesRegex(ValueError, "artifact not found"):
            verify_github_run(self.root, fake_fetch)

    def test_github_run_commit_mismatch_rejected(self):
        def fake_fetch(url):
            return {"id": 41925963100, "head_sha": "b" * 40,
                    "head_branch": "amalgam-event-foundation",
                    "status": "completed", "conclusion": "success",
                    "name": "intelligence-cross-domain-history-research",
                    "html_url": self.manifest["workflow_url"]}
        with self.assertRaisesRegex(ValueError, "mismatch"):
            verify_github_run(self.root, fake_fetch)

    def test_false_decision_schedule_disclosure_rejected(self):
        self.manifest["historical_decision_schedule"]["status"] = "complete"
        self.save_manifest()
        with self.assertRaisesRegex(ValueError, "decision schedule disclosure"):
            verify_bundle(self.root)

    def test_forged_coverage_report_rejected_even_with_updated_manifest(self):
        path = self.root / "historical-coverage-audit.json"
        report = json.loads(path.read_text())
        report["exact_three_series_dates"] = 999
        path.write_text(json.dumps(report), encoding="utf-8")
        self.manifest["files"][path.name] = hashlib.sha256(path.read_bytes()).hexdigest()
        self.save_manifest()
        with self.assertRaisesRegex(ValueError, "coverage report"):
            verify_bundle(self.root)

    def test_forged_joined_value_with_recomputed_hashes_rejected(self):
        path = self.root / "cross-domain-observation-panel.json"
        panel = json.loads(path.read_text())
        panel["observations"][0]["wti_usd_per_barrel"] = 999
        path.write_text(json.dumps(panel), encoding="utf-8")
        self.manifest["files"][path.name] = hashlib.sha256(path.read_bytes()).hexdigest()
        audit_path = self.root / "point-in-time-audit.json"
        audit = assess_asof(panel, "2026-11-04T00:00:00Z")
        audit_path.write_text(json.dumps(audit), encoding="utf-8")
        self.manifest["files"][audit_path.name] = hashlib.sha256(audit_path.read_bytes()).hexdigest()
        self.save_manifest()
        with self.assertRaisesRegex(ValueError, "joined numerical observations"):
            verify_bundle(self.root)

    def test_duplicate_source_value_rejected_even_with_updated_hash(self):
        path = self.root / "eia-history-research.json"
        source = json.loads(path.read_text())
        source["observations"].append(dict(source["observations"][0]))
        path.write_text(json.dumps(source), encoding="utf-8")
        self.manifest["files"][path.name] = hashlib.sha256(path.read_bytes()).hexdigest()
        self.save_manifest()
        with self.assertRaisesRegex(ValueError, "duplicate (EIA|energy series-date)"):
            verify_bundle(self.root)

    def test_invalid_source_value_rejected_even_with_updated_hash(self):
        path = self.root / "treasury-history-research.json"
        source = json.loads(path.read_text())
        source["observations"][0]["ten_year_yield_percent"] = 999
        path.write_text(json.dumps(source), encoding="utf-8")
        self.manifest["files"][path.name] = hashlib.sha256(path.read_bytes()).hexdigest()
        self.save_manifest()
        with self.assertRaisesRegex(ValueError, "invalid Treasury source value"):
            verify_bundle(self.root)

    def test_tampered_file(self):
        (self.root / "point-in-time-audit.json").write_text("{}", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "checksum mismatch"):
            verify_bundle(self.root)

    def test_missing_file_entry(self):
        self.manifest["files"].pop("point-in-time-audit.json")
        self.save_manifest()
        with self.assertRaisesRegex(ValueError, "exactly five"):
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
