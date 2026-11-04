"""Offline verification of downloaded Amalgam research artifact bundles.

Checks file integrity and audit consistency, not external source authenticity.
"""
import argparse
import hashlib
import json
from pathlib import Path
from urllib.request import Request, urlopen

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


def verify_github_run(directory, fetch_json=None):
    """Cross-check claimed run metadata with GitHub's public Actions API.

    This verifies run identity, not the authenticity of downloaded artifact bytes.
    """
    root = Path(directory)
    manifest = json.loads((root / "research-artifact-manifest.json").read_text(encoding="utf-8"))
    repo = manifest.get("repository")
    run_id = manifest.get("workflow_run_id")
    sha = manifest.get("commit_sha")
    if repo != "bclough581-sketch/planetary-circulation":
        raise ValueError("unexpected repository identity")
    if not isinstance(run_id, str) or not run_id.isdigit():
        raise ValueError("invalid workflow run ID")
    if not isinstance(sha, str) or len(sha) != 40 or any(x not in "0123456789abcdef" for x in sha.lower()):
        raise ValueError("invalid commit SHA")
    url = "https://api.github.com/repos/" + repo + "/actions/runs/" + run_id
    if fetch_json is None:
        def fetch_json(target):
            request = Request(target, headers={"Accept": "application/vnd.github+json",
                                               "User-Agent": "Amalgam-research-verifier"})
            with urlopen(request, timeout=15) as response:
                return json.load(response)
    run = fetch_json(url)
    if (str(run.get("id")) != run_id or run.get("head_sha") != sha or
        run.get("head_branch") != "amalgam-event-foundation" or
        run.get("status") != "completed" or run.get("conclusion") != "success" or
        run.get("name") != "intelligence-cross-domain-history-research"):
        raise ValueError("GitHub run identity or success status mismatch")
    if manifest.get("workflow_url") != run.get("html_url"):
        raise ValueError("workflow URL does not match GitHub")
    return {"status": "github_run_metadata_matched",
            "workflow_run_id": run_id,
            "warning": "Run identity verified against GitHub; artifact bytes are not authenticated by this check."}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", help="Directory containing downloaded research JSON files")
    parser.add_argument("--check-github", action="store_true", help="Also check run metadata against GitHub API")
    args = parser.parse_args()
    result = verify_bundle(args.directory)
    if args.check_github:
        result["github_run"] = verify_github_run(args.directory)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
