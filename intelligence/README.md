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

The report now includes `source_observations_sha256`, a SHA-256 fingerprint of the exact historical observation rows. The development viewer verifies this binding before showing the statistics. Earlier descriptive artifacts without the fingerprint are rejected; regenerate both artifacts using the current workflow. This binding prevents accidentally pairing different panels with identical summary statistics, but does not prove the source data are genuine.

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


## Reproducible airline research bundle

The `airline-fuel-research` development workflow publishes
`amalgam-airline-research-<run-id>` with the exact EIA monthly input,
reviewed Delta quarterly input, generated panel, readable report and SHA-256
manifest. A separate job downloads the bundle and reproduces its outputs.

After extracting the bundle, use the code from that workflow's commit:

```bash
python -m intelligence.airline_research_panel --directory /path/to/bundle --verify
```

To regenerate outputs from the retained inputs, omit `--verify`. This never
fetches new source data. The corporate input must match the reviewed canonical
`intelligence/data/delta-quarterly-curated.json`. The viewer's embedded copy is
checked against this same evidence by regression tests.

Complete descriptive pairs require three fuel months and an observed next-quarter
outcome. Gaps are not filled. The 2024–2025 fuel window and eight curated Delta
quarters yield only seven complete lagged pairs. **Zero rows are trading eligible.**
The report lists availability, sample size, benchmark scope, holdout and market-return
blockers. No regression, predictive performance estimate or stock ranking is produced.

Checksums and reproduction establish internal consistency, not independent source
or publication-time authenticity. SEC automated collection remains separately
blocked by HTTP 403; curated issuer evidence is explicitly labeled.


## SEC quarterly collector access checkpoint

SEC's [declared automated access guidance](https://www.sec.gov/search-filings/edgar-search-assistance/accessing-edgar-data)
shows project identification with an administrative contact email. The collector
now requires an authorized `SEC_CONTACT_EMAIL` environment value for network
requests; the GitHub workflow reads the repository secret with that name.
No personal contact address is hardcoded or printed. This identification may
help with classification but does not guarantee access from GitHub runner IPs.
HTTP 403 remains a failure, with no proxy or access-control circumvention.
Local `--input-dir` processing requires no contact or network access.

Until the owner configures the contact, the SEC workflow stops before making
requests. The separate issuer-curated/EIA research pipeline remains usable.


## Retained SEC quarterly corpus

`airline_quarterly --retain-inputs DIRECTORY --output DIRECTORY/airline-quarterly.json`
retains the exact responses and records SHA-256 digests with normalized facts.
The 2014–2025 request currently yields 59 direct calendar quarters (DAL 28,
UAL 31). Source concept coverage leaves explicit early-period and Q4 gaps.
No new concept is silently spliced into a series to fill them.

With both CIK responses, normalized data and the reviewed issuer input in one folder:

```bash
python -m intelligence.airline_quarterly_audit --directory DIRECTORY
python -m intelligence.airline_quarterly_audit --directory DIRECTORY --verify
```

The audit reproduces every normalized fact from the retained responses and
compares overlapping DAL revenue and operating income with the curated issuer
releases. Current six overlaps match exactly. That is consistency evidence,
not authenticated historical availability. The audit retains mismatches if any;
it does not rewrite either source. The corpus includes no new fuel-expense facts.
Network collection requires an owner-authorized SEC contact; local verification
requires no contact and sends no requests.
