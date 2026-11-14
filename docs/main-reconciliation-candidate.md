# Main reconciliation candidate — preparation only

No default-branch PR, main merge, deployment, Pages-setting change, source-data
pull, research study, holdout access or trial-counter change is authorized here.
Display stays OFF and scoreboard-k26 stays HOLD.

## Pinned inputs and reconciliation

- Main: c9394527cdcb38d3b21ff70e54fa7d626980171c.
- Reviewed Delta, including merged PRs #5/#6/#7:
  3d5d971a4aec4dd3804e4796d39f401ec87fa6a6.
- Common ancestor: 86361488b5a536e74c1846a01496db3d73a3cc28.
- Delta is 485 commits ahead / 9 behind main at preparation time.

Three-way blob/mode comparison found no content conflicts: main changed only
data.json relative to the common ancestor; Delta left that ancestral data blob
unchanged. All reviewed Delta code is retained, and main's newer data.json is
preserved byte-for-byte: Git blob 6ae807aa0c2e07d5790a77572a528a23d6d5e669,
generated_utc 2026-11-13T02:32:56Z. This is an existing repository snapshot, not a
new provider pull or a claim that every series is current. The default age/schema
check passed at preparation time; it must be re-run before any eventual merge.
Main may advance; a later main head must be compared and reconciled again.

The remote preparation branch is rooted in the pinned main with Delta as its
additional reconciliation parent. Local validation history has different commit
identities, as in earlier connector-published work; compare trees, never force-push
local history over the remote branch.

## Integration fixes discovered by validation

Preserving current main data exposed three old couplings:

1. scripts/build_ring_evidence.py rebuilt a historical starter from advancing
   data.json. It now reads an explicit retained November-4 context fixture.
   The existing ring-evidence.js is unchanged and still reproduces exactly.
2. tests/test_delta_context.cjs assumed the deployment's data.json was permanently
   November 4. Fixed stale/fresh boundary cases now use that retained fixture.
   Current data.json is still checked directly by check_data.py and browser tests.
3. The first browser CI run (43537999641) exposed the same assumption in the Delta
   browser test: it treated any observation before today as stale, even within its
   allowed age. Stale-state UI assertions now use the fixed retained fixture;
   a separate browser case loads the actual deployment snapshot and verifies its
   observation dates appear. Product freshness rules are unchanged.

product-data/retained-context-2026-11-04.json copies existing retained hub/history
values and source status from Delta data blob
99b4962d60bcd01f24713b662a05843150826c3b. It records that provenance and makes no
new availability claim. PortWatch figures and status are removed: only excluded
record IDs remain so the unchanged bundle can reproduce its exclusion notices.
This fixture is not connected to research studies or live collection.

New tests prove advancing data.json cannot change the retained rendering and
that the fixture does not re-publish PortWatch numerical records. Frozen issuer
research input, ring-evidence.js, convergence-research.html, scoreboard.json and
research protocols are unchanged from reviewed Delta.

## Activation controls and blockers

### Pages: unresolved publication decision — do not open a main PR yet

Settings > Pages was inspected directly: Source = Deploy from a branch;
branch = main; directory = / (root). GitHub's managed pages build and deployment
workflow publishes the site. Therefore a main merge can publish this candidate.
No source-code flag can safely be assumed to override that branch-publishing
setting. No Pages setting has been changed. Brent must authorize publication or a
separately reviewed publication-control change before any default-branch PR.
Environment approvals and external webhooks have not been certified as blockers.

### UCDP scheduling: removed in candidate

The UCDP cron trigger is removed from this preparation tree. Manual dispatch and
the existing dedicated collector-development-branch push trigger remain. There is
no automatic UCDP trigger matching prep/main-reconciliation or main. Restoring a
daily schedule requires a separate reviewed/authorized code change. The collector
display flag remains false, with no UI/bundle/map integration.

### Existing main refresh: unchanged, activation behavior must be accepted

refresh.yml is byte-unchanged from current main. It already has a daily 22:10 UTC
schedule and manual trigger; it also runs on main pushes affecting fetch/check/
alert/tests/workflow paths. This candidate includes tests, so a later main merge
can trigger fetching, data commit/push and alert.py. None of that was run here.
The prior instruction to preserve refresh.yml logic remains honored. Its effects
must be part of Brent's explicit eventual merge/deployment decision, or changed
in a separate authorized review before proceeding.

### Workflow inventory

The fifteen reviewed Delta workflows were read in full during preflight. Apart
from UCDP's removed schedule, existing triggers and source-collection behavior
are unchanged:

| Files | Trigger and effect |
| --- | --- |
| refresh.yml | Existing main schedule/manual/path-filtered push; collects, commits and can alert. |
| ucdp-dark-collector.yml | Manual or path-filtered push on feat/ucdp-dark-collector only; schedule removed here. |
| airline-daily-research.yml; airline-fuel-research.yml; airline-quarterly-research.yml | Manual or listed-path pushes on amalgam-event-foundation; historical source collection/research artifacts. Do not dispatch. |
| cross-domain-history-research.yml | Manual or listed-path foundation push; historical collection, descriptive/audit assembly and exact-commit guard. Do not dispatch. |
| energy-research.yml; historical-eia-research.yml; historical-treasury-research.yml; research-dataset.yml | Manual or listed-path foundation pushes; data-producing work, not validation-only. Do not dispatch. |
| source-diagnostics.yml | Manual or foundation workflow-path push; includes parked PortWatch/EIA probes. Do not dispatch. |
| amalgam-research-ci.yml; intelligence-checks.yml; research-browser-layout.yml; ring-engine-checks.yml | Existing synthetic/offline validation triggers (foundation pushes/manual; PR filters where configured). No research-outcome permission implied. |

One additional candidate-only workflow, release-candidate-checks.yml, runs on
pushes to prep/main-reconciliation or manual dispatch. It has contents:read only,
installs test dependencies and runs existing synthetic/offline Python, node and
isolated Playwright suites. It does not collect UCDP/market data, deploy, write
repository data, send alerts or execute research-outcome studies. It has no
schedule, main-push, workflow_run, pull_request_target or repository_dispatch
trigger. Browser fixtures use synthetic refreshed dates; external font requests
are stubbed by the existing suites. Fixture generation reads retained repo inputs.

## Validation and review handoff

Local combined-tree checks passed: 248 Python tests, 87 Delta context assertions,
journal core/regression/migration, ring engine, scoreboard and check_data.py.
git diff --check passed; current data blob matches main exactly. The extra two
Python tests address retained-context independence/quarantine.

The local runtime lacks Playwright, so no local browser rerun is claimed. CI run
43538297739 passed on 9614ea265e8af60fd5cbae5e3b283a2260179a7f: both jobs completed
successfully, with 248 Python tests, 87 context assertions and all 11 browser suites
passing. Job IDs are 132272563255 (Python) and 132272563720 (browser). Counts were
verified from Python logs and individual browser step results. A later browser
assertion repair replaces the pre-existing always-true source-host assertion with
five exact expected host checks; its new CI result must also be checked.
No deployment readiness or whole-diff approval is implied by passing CI.

Next: Claude reviews this isolated candidate and integration fixes. Brent decides
the Pages publication/refresh effects. Only after those decisions should a separate
default-branch PR be considered; no such PR is opened by this preparation.
