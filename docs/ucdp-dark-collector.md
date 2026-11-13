# UCDP dark collector — cross-review brief

Brent authorized collection and one real workflow verification. Display remains
blocked pending UCDP's written licensing answer, including optional contributions.
This is context collection, not a trading premise or research study. No trial
allocation, scoreboard change, merge or deployment is included.

Verified 2026-11-13 against https://ucdp.uu.se/apidocs/:
GED latest is 26.1; candidate monthly latest is 26.0.9 and quarterly latest is
26.01.26.09. Candidates also use `/api/gedevents/<version>`, not a guessed
candidate endpoint. This implementation pins GED 26.1 only. Its codebook
https://ucdp.uu.se/downloads/ged/ged261.pdf defines coverage through 2025-12-31.
No automatic version promotion or candidate/annual concatenation is implemented.

Initial bounded context window: December 2025, collected in successive seven-day
date_end slices, at most 20 requests/run, 1,000 rows/page, one scheduled run/day.
This bootstrap is historical source context, never contemporary conflict coverage
or historical first availability. Completed coverage makes zero further requests
and does not advance retrieved_utc. A version/window expansion needs review.
Date filters are inclusive; next slice starts one day after the last complete
slice. Row dates are independently checked because the API can ignore bad filters.
All pages must complete, match totals and contain unique IDs before any aggregate
is replaced. No redirects, retries or raw exception/body logging. Any request
failure stops immediately, preserves last-good totals/window/retrieval clock and
marks stale. Request attempts including errors are counted in safe metadata logs.
Quota is 5,000/day; this workflow's maximum is 20/day on its once-daily schedule,
not an account-wide reservation. Manual/push runs also consume quota.

Public-repository darkness requires more than hiding a UI: derived values must
not be committed or uploaded in plaintext. The sole plaintext summary is ignored
by Git, used only on the ephemeral runner, and removed in an always step. Only an
AES-256-GCM sealed snapshot is uploaded; its key is derived from the existing API
secret using PBKDF2-SHA256 (600,000 iterations) with a random salt and nonce.
The token is used as an HTTP header only for UCDP requests and never serialized.
The encrypted artifact is restored from the latest completed run of this workflow
on the same branch. Missing/expired artifacts or changed keys fail closed instead
of silently resetting state. Retention is 90 days, not permanent archival storage.
Key rotation requires an explicit state migration. No raw events are retained.

Scheduled GitHub Actions workflows run from the default branch: schedule activation
therefore remains pending Brent's merge decision. The branch push trigger permits
the explicitly authorized real verification run without merging or deploying.
Do not merge this branch before cross-review. No changes to refresh.yml.

`display_allowed` is always false; no setting or command-line flag can enable it.
Tests reject missing/true flags and page/bundle/service-worker references. A written
license answer alone does not flip the flag; a separately reviewed code change is
still required. Source citation is carried inside the encrypted summary.

Run synthetic checks with:
`python -m unittest discover -s tests -p test_ucdp_dark.py`

Real workflow verification: pending; do not report collection operational until a
successful workflow log confirms a real authenticated request and sealed upload.
