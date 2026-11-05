import hashlib
import json
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch

from intelligence.verify_research_artifact import verify_research_zip


class ResearchArtifactVerificationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name) / "research.zip"
        self.view = {
            "generated_utc": "2026-11-05T12:00:00+00:00",
            "observations": [], "excluded": [],
            "predictive_advantage": "not_established",
        }
        self.commit = "a" * 40
        self.run_id = "123456"

    def write(self, mutate=None, extra=None):
        payload = json.dumps(self.view).encode()
        manifest = {
            "schema": "amalgam.research-view-artifact-manifest.v1",
            "commit_sha": self.commit, "workflow_run_id": self.run_id,
            "file": "research-view.json",
            "sha256": hashlib.sha256(payload).hexdigest(),
            "generated_utc": self.view["generated_utc"],
            "observation_count": len(self.view["observations"]),
            "excluded_count": len(self.view["excluded"]),
            "predictive_advantage": "not_established",
        }
        if mutate:
            mutate(manifest)
        with zipfile.ZipFile(self.path, "w") as archive:
            archive.writestr("research-view.json", payload)
            archive.writestr("research-view-manifest.json", json.dumps(manifest))
            if extra:
                archive.writestr(extra, b"unexpected")

    @patch("intelligence.verify_research_artifact.validate_view", return_value=True)
    def test_matching_artifact(self, validator):
        self.write()
        result = verify_research_zip(self.path, self.commit, self.run_id)
        self.assertEqual(result["observation_count"], 0)
        validator.assert_called_once_with(self.view)

    @patch("intelligence.verify_research_artifact.validate_view", return_value=True)
    def test_rejects_digest_mismatch(self, _):
        self.write(lambda m: m.update(sha256="0" * 64))
        with self.assertRaisesRegex(ValueError, "SHA-256"):
            verify_research_zip(self.path)

    @patch("intelligence.verify_research_artifact.validate_view", return_value=True)
    def test_rejects_commit_mismatch(self, _):
        self.write()
        with self.assertRaisesRegex(ValueError, "commit SHA mismatch"):
            verify_research_zip(self.path, "b" * 40)

    @patch("intelligence.verify_research_artifact.validate_view", return_value=True)
    def test_rejects_count_mismatch(self, _):
        self.write(lambda m: m.update(observation_count=1))
        with self.assertRaisesRegex(ValueError, "disagrees"):
            verify_research_zip(self.path)

    @patch("intelligence.verify_research_artifact.validate_view", return_value=True)
    def test_rejects_extra_member(self, _):
        self.write(extra="unexpected.txt")
        with self.assertRaisesRegex(ValueError, "exactly"):
            verify_research_zip(self.path)

    @patch("intelligence.verify_research_artifact.validate_view", return_value=True)
    def test_rejects_run_id_mismatch(self, _):
        self.write()
        with self.assertRaisesRegex(ValueError, "workflow run ID mismatch"):
            verify_research_zip(self.path, self.commit, "999999")

    @patch("intelligence.verify_research_artifact.validate_view", return_value=True)
    def test_rejects_manifest_schema_change(self, _):
        self.write(lambda m: m.update(schema="unknown"))
        with self.assertRaisesRegex(ValueError, "schema"):
            verify_research_zip(self.path)

    @patch("intelligence.verify_research_artifact.validate_view", return_value=True)
    def test_rejects_predictive_claim_change(self, _):
        self.write(lambda m: m.update(predictive_advantage="established"))
        with self.assertRaisesRegex(ValueError, "disagrees"):
            verify_research_zip(self.path)

    @patch("intelligence.verify_research_artifact.validate_view", return_value=True)
    def test_rejects_noninteger_count(self, _):
        self.write(lambda m: m.update(observation_count=True))
        with self.assertRaisesRegex(ValueError, "disagrees"):
            verify_research_zip(self.path)

    @patch("intelligence.verify_research_artifact.validate_view", return_value=True)
    def test_rejects_manifest_extra_field(self, _):
        self.write(lambda m: m.update(unverified_claim=True))
        with self.assertRaisesRegex(ValueError, "unexpected"):
            verify_research_zip(self.path)

    @patch("intelligence.verify_research_artifact.validate_view", side_effect=ValueError("invalid view"))
    def test_calls_research_view_validation(self, _):
        self.write()
        with self.assertRaisesRegex(ValueError, "invalid view"):
            verify_research_zip(self.path)


if __name__ == "__main__":
    unittest.main()
