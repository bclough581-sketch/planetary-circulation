"""Offline verification of downloaded Amalgam research artifact bundles.

Checks file integrity and audit consistency, not external source authenticity.
"""
import argparse
import hashlib
import json
import math
from datetime import date, datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen
from zipfile import ZipFile

from intelligence.audit_validation import validate_audit
from intelligence.coverage_audit import coverage_report
from intelligence.cross_domain_history import build as rebuild_cross_domain_panel
from intelligence.eia_history import aligned_price_dates, ENDPOINT as EIA_ENDPOINT
from intelligence.treasury_history import SOURCE as TREASURY_SOURCE

EXPECTED = {
    "eia-history-research.json",
    "treasury-history-research.json",
    "cross-domain-observation-panel.json",
    "point-in-time-audit.json",
    "historical-coverage-audit.json",
}


def verify_bundle(directory):
    root = Path(directory)
    manifest = json.loads((root / "research-artifact-manifest.json").read_text(encoding="utf-8"))
    if manifest.get("schema") != "amalgam.research-artifact-manifest.v1":
        raise ValueError("unsupported manifest schema")
    files = manifest.get("files")
    if not isinstance(files, dict) or set(files) != EXPECTED:
        raise ValueError("manifest must enumerate exactly five research files")
    if manifest.get("predictive_advantage") != "not_established":
        raise ValueError("unsupported predictive claim")
    schedule = manifest.get("historical_decision_schedule")
    if schedule != {
        "status": "not_supplied",
        "scheduled_observations": 0,
        "asof_eligible_observations": 0,
        "note": "No historical decision timestamps were provided or inferred."
    }:
        raise ValueError("unsupported or inconsistent historical decision schedule disclosure")
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
    energy = json.loads((root / "eia-history-research.json").read_text(encoding="utf-8"))
    treasury = json.loads((root / "treasury-history-research.json").read_text(encoding="utf-8"))
    saved_coverage = json.loads((root / "historical-coverage-audit.json").read_text(encoding="utf-8"))
    if energy.get("schema") != "amalgam.eia-history.v1" or energy.get("source") != "U.S. Energy Information Administration" or energy.get("source_url") != "https://www.eia.gov/opendata/" or energy.get("endpoint") != EIA_ENDPOINT or energy.get("frequency") != "daily" or energy.get("unit") != "USD_per_barrel":
        raise ValueError("unsupported EIA source identity or units")
    if treasury.get("schema") != "amalgam.treasury-history.v1" or treasury.get("source") != "U.S. Department of the Treasury" or treasury.get("source_url") != TREASURY_SOURCE or treasury.get("frequency") != "business_day" or treasury.get("unit") != "percent_per_year":
        raise ValueError("unsupported Treasury source identity or units")
    if energy.get("predictive_advantage") != "not_established" or treasury.get("predictive_advantage") != "not_established" or energy.get("relationships") != [] or treasury.get("relationships") != []:
        raise ValueError("unsupported source-level predictive or relationship claim")
    # Collection timestamps establish ordering only, never historical availability.
    def utc_instant(value):
        if not isinstance(value, str):
            raise ValueError("missing collection timestamp")
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError as exc:
            raise ValueError("invalid collection timestamp") from exc
        if parsed.tzinfo is None or parsed.utcoffset() is None:
            raise ValueError("timezone-naive collection timestamp")
        return parsed.astimezone(timezone.utc)

    captured = utc_instant(manifest.get("captured_utc"))
    for source in (energy, treasury):
        if utc_instant(source.get("retrieved_utc")) > captured:
            raise ValueError("source retrieval occurs after manifest capture")

    # Source dates must be canonical calendar days, not merely matching strings.
    def canonical_day(value):
        if not isinstance(value, str):
            raise ValueError("invalid source observation date")
        try:
            parsed = date.fromisoformat(value)
        except ValueError as exc:
            raise ValueError("invalid source observation date") from exc
        if parsed.isoformat() != value:
            raise ValueError("noncanonical source observation date")
        return parsed

    start = canonical_day(energy.get("requested_start"))
    end = canonical_day(energy.get("requested_end"))
    if start > end:
        raise ValueError("invalid EIA requested date window")
    year = treasury.get("requested_year")
    if isinstance(year, bool) or not isinstance(year, int) or not 1990 <= year <= 2100:
        raise ValueError("invalid Treasury requested year")

    # Validate retained source records independently of their manifest hashes.
    energy_seen = set()
    for record in energy.get("observations", []):
        observation_day = canonical_day(record.get("date"))
        if not start <= observation_day <= end:
            raise ValueError("EIA observation outside requested date window")
        key = (record.get("series"), record.get("date"))
        if key in energy_seen:
            raise ValueError("duplicate EIA source observation")
        energy_seen.add(key)
        if key[0] not in ("RWTC", "RBRTE"):
            raise ValueError("unsupported EIA source series")
        value = record.get("value")
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not 0 < value < 10000:
            raise ValueError("invalid EIA source value")
    if energy.get("aligned_prices") != aligned_price_dates(energy["observations"]):
        raise ValueError("EIA aligned prices do not match source observations")
    treasury_seen = set()
    for record in treasury.get("observations", []):
        day = record.get("date")
        if canonical_day(day).year != year:
            raise ValueError("Treasury observation outside requested year")
        if day in treasury_seen:
            raise ValueError("duplicate Treasury source observation")
        treasury_seen.add(day)
        value = record.get("ten_year_yield_percent")
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not 0 <= value <= 100:
            raise ValueError("invalid Treasury source value")
    if saved_coverage != coverage_report(energy, treasury, panel):
        raise ValueError("historical coverage report does not match source files")
    reconstructed = rebuild_cross_domain_panel(energy, treasury)
    if panel.get("observations") != reconstructed["observations"]:
        raise ValueError("joined numerical observations do not match source files")
    if panel.get("source_artifacts") != reconstructed["source_artifacts"]:
        raise ValueError("joined panel provenance does not match source files")
    for field in ("alignment", "publication_time_verified", "point_in_time_tradability",
                  "relationships", "predictive_advantage"):
        if panel.get(field) != reconstructed[field]:
            raise ValueError("joined panel research safeguard mismatch: " + field)
    return {"status": "verified_internal_consistency", "files": len(files),
            "observations": verdict["observations"], "workflow_run_id": manifest["workflow_run_id"],
            "warning": "File integrity and audit consistency only; provenance identity is self-reported and not authenticated against GitHub."}


def verify_github_run(directory, fetch_json=None, artifact_zip=None):
    """Cross-check claimed run metadata with GitHub's public Actions API.

    Without artifact_zip this verifies metadata only. With artifact_zip it also
    compares ZIP bytes against GitHub's published digest and extracted files.
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
    artifact_response = fetch_json(url + "/artifacts?per_page=100")
    artifacts = artifact_response.get("artifacts")
    if not isinstance(artifacts, list):
        raise ValueError("GitHub artifact listing unavailable")
    expected_name = "amalgam-cross-domain-history-" + run_id
    matching = [item for item in artifacts if item.get("name") == expected_name
                and item.get("expired") is False]
    if len(matching) != 1:
        raise ValueError("expected unexpired artifact not found in GitHub run")
    attached = matching[0].get("workflow_run")
    if not isinstance(attached, dict) or str(attached.get("id")) != run_id or attached.get("head_sha") != sha:
        raise ValueError("artifact run/commit attachment mismatch")
    if artifact_zip is not None:
        digest = matching[0].get("digest")
        if not isinstance(digest, str) or not digest.startswith("sha256:"):
            raise ValueError("GitHub artifact digest unavailable")
        actual_digest = hashlib.sha256(Path(artifact_zip).read_bytes()).hexdigest()
        if actual_digest != digest.removeprefix("sha256:"):
            raise ValueError("GitHub artifact ZIP digest mismatch")
        with ZipFile(artifact_zip) as archive:
            names = archive.namelist()
            if len(names) != len(EXPECTED) + 1 or set(names) != EXPECTED | {"research-artifact-manifest.json"}:
                raise ValueError("GitHub artifact ZIP file listing mismatch")
            for name in names:
                if archive.read(name) != (root / name).read_bytes():
                    raise ValueError("GitHub artifact ZIP contents mismatch: " + name)
    return {"status": "github_artifact_zip_digest_matched" if artifact_zip is not None else "github_run_and_artifact_metadata_matched",
            "workflow_run_id": run_id,
            "artifact_id": matching[0].get("id"),
            "warning": ("ZIP bytes matched GitHub-published digest and extracted files; this does not establish original upstream data authenticity or historical publication times." if artifact_zip is not None else "Run and artifact listing matched GitHub; local artifact bytes are NOT authenticated by this check.")}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", help="Directory containing downloaded research JSON files")
    parser.add_argument("--check-github", action="store_true", help="Also check run metadata against GitHub API")
    parser.add_argument("--artifact-zip", help="Original GitHub artifact ZIP; verify GitHub SHA-256 digest and contents")
    args = parser.parse_args()
    result = verify_bundle(args.directory)
    if args.check_github or args.artifact_zip:
        result["github_run"] = verify_github_run(args.directory, artifact_zip=args.artifact_zip)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
