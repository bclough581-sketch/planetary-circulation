"""Offline verification of downloaded Amalgam research artifact bundles.

Checks file integrity and audit consistency, not external source authenticity.
"""
import argparse
import hashlib
import json
from pathlib import Path

from intelligence.audit_validation import validate_audit

EXPECTED = {
    "eia-history-research.json",
    "treasury-history-research.json",
    "cross-domain-observation-panel.json",
    "point-in-time-audit.json",
}


def verify_bundle(directory):
    root = Path(directory)
    manifest = json.loads((root / "research-artifact-manifest.json").read_text(encoding="utf-8"))
    if manifest.get("schema") != "amalgam.research-artifact-manifest.v1":
        raise ValueError("unsupported manifest schema")
    files = manifest.get("files")
    if not isinstance(files, dict) or set(files) != EXPECTED:
        raise ValueError("manifest must enumerate exactly four research files")
    if manifest.get("predictive_advantage") != "not_established":
        raise ValueError("unsupported predictive claim")
    if not isinstance(manifest.get("workflow_run_id"), str) or not manifest["workflow_run_id"].isdigit():
        raise ValueError("missing workflow run identity")
    if not isinstance(manifest.get("commit_sha"), str) or len(manifest["commit_sha"]) != 40:
        raise ValueError("invalid commit identity")
    for name, digest in files.items():
        if not isinstance(digest, str) or len(digest) != 64 or any(c not in "0123456789abcdef" for c in digest):
            raise ValueError("invalid checksum")
        actual = hashlib.sha256((root / name).read_bytes()).hexdigest()
        if actual != digest:
            raise ValueError("file checksum mismatch: " + name)
    panel = json.loads((root / "cross-domain-observation-panel.json").read_text(encoding="utf-8"))
    audit = json.loads((root / "point-in-time-audit.json").read_text(encoding="utf-8"))
    verdict = validate_audit(panel, audit)
    return {"status": "verified_internal_consistency", "files": len(files),
            "observations": verdict["observations"], "workflow_run_id": manifest["workflow_run_id"],
            "warning": "File integrity and audit consistency only; provenance identity is self-reported and not authenticated against GitHub."}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", help="Directory containing downloaded research JSON files")
    args = parser.parse_args()
    print(json.dumps(verify_bundle(args.directory), indent=2))


if __name__ == "__main__":
    main()
