# Amalgam intelligence research — development branch

Nine domains: weather, geopolitics, maritime, aviation, energy, commodities,
economics, markets and corporate. The convergence ring is a research interface,
not a validated signal or a trading recommendation.

## Current capabilities
- Source-attributed event records, NOAA collection, freshness and eligibility audits.
- A standalone `convergence-research.html` viewer; research JSON is uploaded
  manually. There is no live production connection or automatic deployment.
- EIA WTI/Brent and U.S. Treasury 10-year historical collection and exact-date
  alignment, with a coverage/exclusion audit.
- Fail-closed historical point-in-time audit: **zero rows are eligible** without
  independently authenticated publication-time evidence.
- Artifact manifests, SHA-256 file checksums, cross-file consistency validation,
  GitHub workflow metadata verification, and original ZIP-byte verification.
- The historical decision schedule tool audits user-supplied decision timestamps;
  supplying timestamps **never** grants point-in-time eligibility.

## Verify a downloaded historical bundle

1. Download the `amalgam-cross-domain-history-<run-id>` artifact ZIP from the
   **intelligence-cross-domain-history-research** GitHub Actions run.
2. From the repository root, with Python 3:

```bash
python -m intelligence.verify_downloaded_zip /path/to/artifact.zip --check-github
```

This queries GitHub's public API to check the completed run, commit, artifact
attachment and published ZIP digest, then checks all six ZIP entries and the
research panel, source data, manifest and exclusion audit for consistency.

If GitHub is inaccessible, an independently copied SHA-256 digest may be used:

```bash
python -m intelligence.verify_downloaded_zip /path/to/artifact.zip --github-sha256 <64-lowercase-hex-digest>
```

Do not obtain the expected digest from the same untrusted ZIP. The digest is
published in the GitHub Actions artifact metadata (not the research manifest).
A report can be saved with `--output verification-report.json`.

To verify already-extracted files without authenticating the ZIP:

```bash
python -m intelligence.verify_bundle /path/to/extracted-directory
```

**Trust boundary:** A matching GitHub ZIP digest establishes integrity against
GitHub's published artifact, not independent authenticity of the upstream
observations, historical publication times, or any predictive relationship.
An internally consistent panel is not an as-of trading backtest.

## Descriptive research report verification

The historical workflow also publishes a **separate** `amalgam-descriptive-history-<run-id>` artifact. Extract its `descriptive-historical-research.json` and the source panel from the **same run**, then compare them:

```bash
python -m intelligence.descriptive_history --panel cross-domain-observation-panel.json --verify-report descriptive-historical-research.json
```

This detects altered statistics relative to the supplied panel. Authenticate the source bundle separately using `verify_downloaded_zip --check-github`. The descriptive artifact itself is not included in that bundle or its manifest, and panel consistency alone does **not** authenticate the descriptive artifact against GitHub.

## Tests

```bash
python -m unittest discover -s tests -p 'test_*.py'
```

The development workflows also run Node viewer checks. Historical research
artifacts are retained for 30 days; scheduled capture is not enabled on this
development branch.

## Outstanding blockers

- Historical observation dates are not independently verified availability
  timestamps. The 244 aligned 2025 dates are **not** trade-time eligible.
- No preregistered cross-domain hypothesis has passed out-of-sample testing.
- PortWatch licensing for commercial reuse remains unverified; keep it quarantined.
- The convergence ring must not imply validated relationships or predictive lift.

**Predictive advantage: not established.** Production `main` is unchanged.
