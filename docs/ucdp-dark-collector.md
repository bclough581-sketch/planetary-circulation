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
date_end slices, at most 20 requests/run, 100 rows/page, one scheduled run/day.
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
AES-256-GCM sealed snapshot is uploaded; its key is derived from a separate
`UCDP_STATE_KEY` secret using PBKDF2-SHA256 (600,000 iterations), random salt and
nonce. The state key must be a separately generated random value of at least 32
characters, different from the API token. The API token is used as an HTTP header
for UCDP requests and never serialized. Token rotation no longer changes the state
encryption key. No raw events are retained.

The restore helper enumerates the artifacts API (including pagination), verifies
workflow/branch provenance, selects the newest non-expired `ucdp-dark-sealed`
artifact, and downloads its ZIP by artifact ID. A newer failed/cancelled run with
no artifact cannot strand an older usable artifact. If a known chain has no usable
artifact, restore fails closed; it never silently bootstraps over lost state.
Retention is 90 days, not permanent archival storage. State remains branch-scoped;
merging to a different branch starts a separate bootstrap unless an explicit state
transfer is reviewed. State-key rotation still needs explicit re-encryption.

## One-time legacy-key migration (pending)

1. In repository Actions secrets add `UCDP_STATE_KEY`, a new independently random
   value (at least 32 characters). Do not paste either secret into chat or Git.
2. Keep the current `UCDP_API_KEY` unchanged until migration finishes: it is needed
   only to decrypt the existing legacy artifact.
3. Dispatch `UCDP Dark Collector` on `feat/ucdp-dark-collector` with the boolean
   input `migrate_legacy=true`. Where CLI dispatch is available:
   `gh workflow run ucdp-dark-collector.yml --ref feat/ucdp-dark-collector -f migrate_legacy=true`
4. Verify the safe log `status=state_key_migrated requests=0 display_allowed=false`
   and a new sealed artifact upload. Migration decrypts legacy state only under
   that explicit flag, validates it and rewraps under the separate state key. It
   preserves all source metadata and retrieval timestamps and makes no UCDP call.
   Repeating migration against already migrated state is also collection-free.
5. Dispatch normally (`migrate_legacy=false`) to verify independent-key restore.
   API-token rotation is safe after migration; do not rotate/delete the state key.

Without the new state secret, collection stops before requesting UCDP. An absent
or wrong state key never automatically falls back to the API token. Connector
tools cannot create repository Actions secrets; Brent must add the secret using
GitHub's secret-entry UI. Migration and live independent-key verification remain
pending that setup; the earlier live result below validates the legacy version.

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

The real workflow checks exposed zero-based API pagination: requesting pages
1..TotalPages skipped page zero and failed completeness. The collector now requests
0..TotalPages-1, and a multi-page synthetic fixture pins this behavior. Page size
is conservatively 100. The official GED codebook
section 5.5 explicitly permits crossed low/best/high estimates in clarity-2 events.
All source estimates are preserved unchanged and crossed estimates counted per
region, regardless of clarity class; they are not sorted or relabeled as confidence
bounds. The live integration also encountered crossed estimates outside clarity-2.
That source-quality issue is flagged, not repaired, imputed or silently excluded.
Noninteger/negative/missing fatalities still fail the entire slice closed.

## Legacy verified checkpoint (before Claude's two requested fixes)

Real authenticated workflow passed on implementation head
3785e54a0a4ed89d13df7db3b443b7648283c710:
https://github.com/bclough581-sketch/planetary-circulation/actions/runs/43454786504

Safe log: `status=collected_historical_context requests=5 display_allowed=false`.
The complete initial seven-day slice was accepted only after all event counts and
page totals reconciled. Encrypted artifact ID 14053492796, digest
`sha256:b59f0413f43225daf1e930962c676d2d7925d57595a86aefb30eb776d0de42d8`.
Restore from preceding encrypted state also passed. Plaintext cleanup passed.
No event/fatality values or raw response bodies were published.

Fourteen UCDP synthetic checks passed in the dedicated workflow. Local full Python
suite: 239 passed. Python/browser PR validation passed on the implementation head:
https://github.com/bclough581-sketch/planetary-circulation/actions/runs/43454798109
The general Python job skips the encryption-specific test when its optional
dependency is absent; the dedicated UCDP job installs it and runs that test.

Earlier failed integration runs remain audit history: completeness, page numbering
and source-estimate semantics were corrected without promoting partial responses.
No auth/rate retry loops were used. This checkpoint update changes documentation
only and does not trigger another collection.

Draft PR for cross-review:
https://github.com/bclough581-sketch/planetary-circulation/pull/4
No automatic message was sent to Claude. Display, merge, deployment, research use
and trial accounting remain held. The daily schedule is not active until a
separately authorized default-branch merge. Artifact expiry and key rotation are
operational limits; the December 2025 window is a bounded historical bootstrap,
not a live conflict feed.

## Cross-review fixes

Claude approved PR #3 @9550a75 and blocked PR #4 @f7b9d81 for restore-chain and
API-token/state-key coupling. Both code fixes are implemented. Added synthetic
tests cover a newer run with no artifact, expired/wrong-branch artifacts, missing
state versus first bootstrap, explicit legacy migration, wrong state key, and
API-token rotation with independent-key restoration. Local UCDP suite: 18 passed.
No independent-key live success is claimed until the new secret is installed and
the explicit migration is verified. No merge, deployment or counter changes.
