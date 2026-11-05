"""Verify a downloaded AMALGAM research-view ZIP against its embedded manifest.

The manifest and dataset share an artifact: integrity is internal, not independent
proof of GitHub origin or historical publication-time availability.
"""
import argparse
import hashlib
import json
import re
import zipfile
from pathlib import Path

from intelligence.research_view import validate_view

EXPECTED = {"research-view.json", "research-view-manifest.json"}
MAX_MEMBER_BYTES = 15_000_000
MAX_ZIP_BYTES = 20_000_000


def _unique_json_keys(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("duplicate JSON object key")
        result[key] = value
    return result


def _parse_json(data):
    return json.loads(data, object_pairs_hook=_unique_json_keys,
                      parse_constant=lambda value: (_ for _ in ()).throw(ValueError("non-finite JSON number")))



def verify_research_payload(payload, manifest_bytes, expected_commit=None, expected_run=None):
    """Validate raw research JSON and manifest with the same rules used for ZIPs."""
    if len(payload) > MAX_MEMBER_BYTES or len(manifest_bytes) > MAX_MEMBER_BYTES:
        raise ValueError("research artifact payload too large")
    view = _parse_json(payload)
    manifest = _parse_json(manifest_bytes)
    if not isinstance(manifest, dict) or manifest.get("schema") != "amalgam.research-view-artifact-manifest.v1":
        raise ValueError("invalid research artifact manifest schema")
    if set(manifest) != {"schema", "commit_sha", "workflow_run_id", "file",
                         "sha256", "generated_utc", "observation_count",
                         "excluded_count", "predictive_advantage"}:
        raise ValueError("unexpected research artifact manifest fields")
    if manifest["file"] != "research-view.json":
        raise ValueError("unexpected research artifact filename")
    if not isinstance(manifest["commit_sha"], str) or not re.fullmatch(r"[0-9a-f]{40}", manifest["commit_sha"]):
        raise ValueError("invalid commit SHA")
    if not isinstance(manifest["workflow_run_id"], str) or not re.fullmatch(r"[1-9][0-9]*", manifest["workflow_run_id"]):
        raise ValueError("invalid workflow run ID")
    if expected_commit is not None and manifest["commit_sha"] != expected_commit:
        raise ValueError("commit SHA mismatch")
    if expected_run is not None and manifest["workflow_run_id"] != str(expected_run):
        raise ValueError("workflow run ID mismatch")
    if manifest["sha256"] != hashlib.sha256(payload).hexdigest():
        raise ValueError("research dataset SHA-256 mismatch")
    validate_view(view)
    if (manifest["generated_utc"] != view["generated_utc"]
            or type(manifest["observation_count"]) is not int
            or manifest["observation_count"] != len(view["observations"])
            or type(manifest["excluded_count"]) is not int
            or manifest["excluded_count"] != len(view["excluded"])
            or manifest["predictive_advantage"] != view["predictive_advantage"]):
        raise ValueError("research artifact manifest disagrees with dataset")
    return manifest


def verify_research_zip(path, expected_commit=None, expected_run=None):
    path = Path(path)
    if path.stat().st_size > MAX_ZIP_BYTES:
        raise ValueError("research artifact ZIP too large")
    with zipfile.ZipFile(path) as archive:
        entries = archive.infolist()
        if len(entries) != 2 or {item.filename for item in entries} != EXPECTED:
            raise ValueError("research artifact must contain exactly the expected files")
        if any(item.is_dir() or item.file_size > MAX_MEMBER_BYTES
               or item.flag_bits & 1 for item in entries):
            raise ValueError("unsafe research artifact member")
        payload = archive.read("research-view.json")
        manifest_bytes = archive.read("research-view-manifest.json")
    return verify_research_payload(payload, manifest_bytes, expected_commit, expected_run)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("zip_path")
    parser.add_argument("--commit", help="Expected 40-character Git commit SHA")
    parser.add_argument("--run-id", help="Expected GitHub Actions run ID")
    args = parser.parse_args()
    print(json.dumps(verify_research_zip(args.zip_path, args.commit, args.run_id), indent=2))


if __name__ == "__main__":
    main()
