# UCDP dark collector — current cross-review brief

## Decision and scope

Brent authorized bounded collection and live workflow verification. Claude's
co-equal decision withdraws a separate encryption secret as a hard requirement:
this December-2025 bootstrap is reproducible from the public source. API-token
rotation costs bounded recollection requests, not unique forward observations.
No UCDP_STATE_KEY setup or migration is required. No merge, deploy, study,
holdout access or trial-counter change is authorized. scoreboard-k26 stays HOLD.
Display remains blocked pending UCDP's written licensing answer, including the
optional contribution question. display_allowed is always false; no UI, map,
Explorer bundle or service worker reads this summary.

## Source and collection

Verified 2026-11-13: https://ucdp.uu.se/apidocs/
GED latest is 26.1; candidate monthly latest is 26.0.9, quarterly latest is
26.01.26.09. Both use /api/gedevents/<version>. This collector pins GED 26.1 only;
no automatic version promotion or candidate/annual concatenation.
Codebook: https://ucdp.uu.se/downloads/ged/ged261.pdf
Annual coverage ends 2025-12-31. This is historical context, not a live conflict
feed, a trading premise, or proof of historical first availability.

Bootstrap: December 2025 in successive complete seven-day date_end slices, page
size 100, maximum 20 UCDP request attempts/run including errors. First verified
slice required 5 requests; later slice counts depend on source volume and are not
promised to be exactly 5. One daily schedule; manual/push runs also consume quota.
UCDP quota is 5,000/day, reset 00:00 UTC. No retries or redirects; stop immediately
on auth/rate/transport errors. Page numbering starts at zero. All page totals and
unique IDs must reconcile, and returned dates must respect the inclusive filters,
before advancing the stored window. Next slice starts one day after its end.

Failure retains last-good totals/window/retrieval timestamp and marks stale.
Completed pinned coverage makes zero requests and never advances retrieved_utc.
Historical coverage remains stale for contemporary context even after a good pull.
Source low/best/high estimates are summed unchanged; crossed estimates are flagged,
never sorted, imputed, discarded or presented as confidence bounds. GED codebook
section 5.5 discusses crossed estimates. No raw events are retained.

## Sealing and restore

The sole plaintext summary, product-data/ucdp-conflict-summary.json, is Git-ignored,
exists only on the ephemeral runner and is removed in an always step. It is never
uploaded. Only dark-state/ucdp-summary.sealed is retained as an encrypted artifact.
AES-256-GCM uses PBKDF2-SHA256 (600,000 iterations) derived from UCDP_API_KEY,
with random salt and nonce. The API token is sent to UCDP only in the header
x-ucdp-access-token; never in URLs, source, fixtures, serialized output or logs.
Runtime checks reject token material in tracked files and plaintext output.

scripts/restore_ucdp_state.py is unchanged from Claude's approved version. It
paginates the artifacts API, verifies workflow/branch provenance, selects the
newest non-expired ucdp-dark-sealed artifact and downloads by ID. A newer failed
or cancelled run without an artifact does not strand an older usable snapshot.
A known chain without a usable artifact fails closed, never silently resets.

On unseal failure (including rotated token/corruption), the collector logs only
status=state_key_changed requests=0 and fails before collection or any state write.
The restored sealed file remains byte-identical; any always-step upload contains
those same encrypted bytes. Decrypted malformed state reports state_invalid and
also fails closed. Neither error authorizes resetting state.

## Rotation recovery — explicit re-bootstrap, never migration

Keep the last-good encrypted artifact untouched. If the old API token is no longer
available, recovery requires a separately reviewed one-time reset commit that
explicitly re-bootstraps December 2025 from scratch. It must not overwrite audit
history or inherit the previous retrieval timestamp. Re-seal the new snapshot under
the current API token, verify complete pages and darkness, and remove the temporary
reset mechanism. No reset switch or automatic key fallback is implemented here.
Budget about 5 requests for the initial slice (observed, not guaranteed), with a
hard maximum of 20 per run. This recovery is documented, not executed/authorized.

## Operational limits

State is branch-scoped: moving to another branch starts a separate bootstrap
unless a state transfer is reviewed. Artifacts expire after 90 days; they are not
permanent archival storage. Schedule is inactive until an authorized default-branch
merge. workflow_dispatch is unavailable before the workflow exists on the default
branch; the development-branch push trigger permits authorized verification.
refresh.yml, research inputs, research viewer and scoreboard remain unchanged.

## Review and verification record

Claude approved Delta PR #3 @9550a75. UCDP PR #4 remains draft for final re-review:
https://github.com/bclough581-sketch/planetary-circulation/pull/4

Original API-key-sealed live run 43454786504 @3785e54a passed with 5 requests,
complete initial slice, display_allowed=false and encrypted upload/cleanup.
Artifact-ID restoration subsequently passed live, including selecting older usable
artifacts across runs without usable state. A separate state-key approach was
implemented and code-reviewed, but its live attempts failed closed with zero UCDP
requests because the additional secret was absent. No migration succeeded. The
separate-key requirement is now withdrawn; prior commits/runs remain audit history.

Current change returns to API-token sealing, removes migration inputs/mode, and
retains the reviewed restore helper unchanged. Synthetic wrong-token regression
asserts zero collection calls, no plaintext output, byte-identical sealed state
and a safe state_key_changed status. Prior encryption tests remain.

Local UCDP tests: 18 passed. Live push verification of this change is pending; its
run ID and artifact ID will be recorded in PR #4 after completion. Earlier live
success is not claimed as validation of the new head.
