"""Reproduce local integrity verification for a downloaded GitHub research ZIP.

The expected SHA-256 must come from an independently obtained GitHub artifact
record; passing an untrusted digest alongside an untrusted ZIP proves nothing.
"""
import argparse
import hashlib
import json
import tempfile
from pathlib import Path
from zipfile import ZipFile

from intelligence.verify_bundle import EXPECTED, verify_bundle, verify_github_run


def verify_downloaded_zip(zip_path, published_sha256=None, check_github=False, fetch_json=None):
    if published_sha256 is None and not check_github:
        raise ValueError("independent SHA-256 or --check-github required")
    if published_sha256 is not None and (not isinstance(published_sha256, str) or len(published_sha256) != 64 or any(
        ch not in "0123456789abcdef" for ch in published_sha256
    )):
        raise ValueError("expected SHA-256 must be 64 lowercase hex characters")
    zip_path = Path(zip_path)
    actual = hashlib.sha256(zip_path.read_bytes()).hexdigest()
    if published_sha256 is not None and actual != published_sha256:
        raise ValueError("GitHub-published ZIP SHA-256 mismatch")
    expected = EXPECTED | {"research-artifact-manifest.json"}
    with ZipFile(zip_path) as archive:
        members = archive.infolist()
        if len(members) != len(expected) or {entry.filename for entry in members} != expected:
            raise ValueError("ZIP must contain exactly the six flat research files")
        if any(entry.is_dir() or entry.file_size > 20_000_000 for entry in members):
            raise ValueError("ZIP contains directory or oversized file")
        with tempfile.TemporaryDirectory() as tmp:
            for entry in members:
                (Path(tmp) / entry.filename).write_bytes(archive.read(entry))
            result = verify_bundle(tmp)
            manifest = json.loads((Path(tmp) / "research-artifact-manifest.json").read_text())
            github = verify_github_run(tmp, fetch_json=fetch_json, artifact_zip=zip_path) if check_github else None
    return {
        "schema": "amalgam.local-artifact-verification.v1",
        "status": ("github_published_zip_digest_and_internal_consistency_matched" if check_github else "supplied_digest_and_internal_consistency_matched"),
        "zip_sha256": actual,
        "workflow_run_id": result["workflow_run_id"],
        "commit_sha": manifest["commit_sha"],
        "research_files_verified": result["files"],
        "matched_observation_dates": result["observations"],
        "predictive_advantage": "not_established",
        "github_run": github,
        "warning": ("GitHub run and published ZIP digest independently cross-checked; upstream observations and historical publication times remain unauthenticated." if check_github else "The supplied digest was NOT independently authenticated by this tool. Obtain it independently from GitHub; upstream observations and historical publication times remain unauthenticated."),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("zip_path")
    parser.add_argument("--github-sha256", help="Optional digest independently copied from GitHub; required unless --check-github is set")
    parser.add_argument("--check-github", action="store_true", help="Query GitHub Actions and cross-check run, commit, artifact and published ZIP digest")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    report = verify_downloaded_zip(args.zip_path, args.github_sha256, check_github=args.check_github)
    output = json.dumps(report, indent=2) + "\n"
    if args.output:
        args.output.write_text(output, encoding="utf-8")
    print(output, end="")


if __name__ == "__main__":
    main()
