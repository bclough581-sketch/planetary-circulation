# Amalgam (formerly Tributary, Planetary Circulation)

A free, installable, open-data HUD of global money flows and shipping chokepoints. Information only; not investment advice.

- `index.html`: entry; opens the Evidence Explorer (`ring-engine-lab.html`). `map.html` is the live money map, with `land.json` + `tic.json` + `data.json`: the static site. No backend, no accounts, no tracking.
- `fetch_data.py`: daily job (stdlib Python) writing `data.json` from ECB, U.S. Treasury, EIA and IMF PortWatch.
- `.github/workflows/refresh.yml`: runs the job daily on GitHub and commits `data.json`.
- `LICENSES.md`: source-by-source license audit and the gates the app enforces.

Setup: add repo secret `EIA_API_KEY` (free at eia.gov/opendata), turn on GitHub Pages for the main branch, run the workflow once by hand.
Monthly: update `tic.json` from the Treasury TIC Major Foreign Holders table.

## Development: source-linked ring explorer

Open `ring-engine-lab.html` in this development checkout. It now opens with a
retained public-source reference snapshot and a Delta Air Lines business case;
no JSON upload, external library or new data request is needed. The rings retain
their five viewing layers and show coverage across the nine intelligence domains.
Select fuel exposure, sector context or company evidence, compare annual or
quarterly figures, then inspect their original source links and provenance.

This is a development preview, not the production home page or a live feed.
The 2024–2025 issuer comparison and the dated reference snapshot are separate
contexts, not a time-aligned relationship or a stock-return forecast. PortWatch
records are excluded from the bundled starter while reuse permission is unresolved.

The approved blue/white/silver HUD, galaxy-textured rings, zero-based issuer
comparisons and Still/Drift/Flow controls are shared with the local preview.
The star field and ring motion are decorative; they do not encode evidence
strength. Ring selection works by pointer and keyboard; drag starts only after
movement crosses a threshold, so a tap remains a selection. Reduced-motion
preferences disable ambient and ring animation.

### Local decision journal and evidence transfer

Serve this checkout over loopback, for example:

```bash
python -m http.server 8767 --bind 127.0.0.1
```

Open `http://127.0.0.1:8767/ring-engine-lab.html`. The selected airline comparison
can be copied into an **unsaved** decision draft with its figures, period,
source links and historical-data limitations. The app does not write a thesis,
set a trade size, place an order or save the card automatically. A no-trade
decision can be recorded. Local evidence imports hide the bundled airline case
so source sets cannot be silently combined.

`decision-journal.html` saves original cards and dated amendments under the
existing `amalgam.decision-journal.v1` browser-storage key. No credentials,
broker connections, personal example records or backend are included. Records
stay in the browser for that origin; they are not encrypted or tamper-proof,
and browser clearing or moving to a different origin can make them unavailable.
Back up private notes outside the repository. Never commit an actual journal
export, account data or other personal trading records.

The pure `journal-core.js` validator is shared by save, restore and exports.
JSON backups retain amendments. Matching cards are recognized independently of
JSON field order; conflicting versions reject the entire import. Card, text,
amendment and UTF-8 backup limits are checked before a write. CSV exports quote
fields and neutralize leading spreadsheet formulas. Export text remains
selectable if a browser blocks the download.

Saves and deletions require Web Locks and compare the stored version before
writing. A stale tab must reload after the user copies unsaved notes. Browsers
without Web Locks fail closed with a message; use a current browser over HTTPS
or localhost. Failed saves preserve form contents. Invalid storage
is left untouched with a raw recovery download; normal exports cannot silently
replace it with an empty journal. Missing validation code disables writes.

Dependency-free record checks:

```bash
node tests/test_journal_core.cjs
```

The ring workflow also runs browser suites for journal recovery and concurrent
tabs, evidence transfer, exact comparison bars, actual ring-pointer/keyboard/drag
interactions, responsive layout, contrast and motion controls. New browser
suites start their own ephemeral loopback server via `tests/browser_preview.cjs`
and use synthetic records only. For local runs with system Chrome, set
`PLAYWRIGHT_CHANNEL=chrome`; CI uses its bundled Chromium. No test reads a real
browser profile or any user's journal.

### Older journal recovery

The build baseline for the migration fixes is `integration-draft-1` commit
`8e4ffcf6d9c96ac2fa08823a72cb468bfb2fc14e`, not the earlier local patch against
`journal-stage1` commit `09303170e4341b19a6ec107f557693f0231a994b`.

When `amalgam.journal.v1` exists, My decisions shows an older-journal notice
and an explicit copy button. `journal-legacy.js` accepts the original v1 array,
the v1 backup envelope and the reviewed v2 local envelope. It maps complete
supported cards without clipping; unsupported or oversized data remains
untouched with a recovery link. Legacy dates and plan labels are unverified:
copies are retrospective and retain the original labels/dates in their evidence.
Reported prices are carried as text, without calculating performance.

Format provenance: `journal-stage1` at `0930317` writes the legacy array under
`amalgam.journal.v1` and exports `{app, version: 1, exported, entries}`. It does
**not** write a version-2 envelope or an `amalgam.journal.v1.previous` key.
Those two formats were introduced by ChatGPT's earlier, unpublished local
integrity prototype, delivered as `journal-integrity-fixes.patch` against that
stage-1 baseline. Its `commitStore()` writes
`{app, version: 2, journalId, revision, entries}` and saves the prior raw text
under the `.previous` key before replacement. That prototype was not pushed,
merged or deployed by ChatGPT; no actual user records in that format have been
verified. This integration build accepts that envelope and can export that
optional recovery key as compatibility support only. It creates neither.

Content-derived copy IDs make repeat copies idempotent, preserve duplicate old
IDs and treat later old-card edits as distinct retrospective versions. Copying
again preserves amendments already added in My decisions. Original conflicts
are rejected, never resolved using timestamps. The full copy must validate and
fit the 500-card / 5 MB export limits before any write. No legacy key is written
or deleted, including when deleting the new journal's records.
An edited old card therefore adds a second version rather than updating the
first copy. This preserves the earlier original and its amendments; the copy
notice explicitly states this behavior. These versions are diary records, not
independent decisions or statistical observations.

Already-open old pages cannot be retroactively stopped by a new build. Close
them before copying. Changes to the old key trigger a visible notice, and a
changed source snapshot during conversion refuses the copy. Later writes to
that key remain recoverable and can be copied again. This is not a cross-key
atomic migration or a promise that older tabs cannot write.

`journal.html` remains a read-only recovery address with exact raw-text export
and a previous-copy selector. It and the migration module are precached for
offline recovery after a successful shell update. Normal JSON restore still
rejects legacy formats: conversion is explicit, not an implicit reinterpretation.

Run all journal and integration checks with Playwright installed:

```bash
node tests/run_journal_checks.cjs
```

All browser suites in this runner start and stop their own loopback servers.
For system Chrome, set `PLAYWRIGHT_CHANNEL=chrome`. The retired
`journal-stage1` Python `e2e/check_journal_ui.py` needs its own local server;
it is not the browser runner for this integration branch.
Optional local imports replace the starter view; Clear removes them and Restore
reopens the retained evidence. Neither action uploads or stores a local file.

Rebuild the offline starter after reviewing changes to its retained inputs:

```bash
python -m scripts.build_ring_evidence
python -m unittest discover -s tests -p test_ring_starter.py
node tests/test_ring_engine.cjs
```

`ring-evidence.js` must reproduce exactly from `data.json` and
`intelligence/data/delta-quarterly-curated.json`. Browser checks cover the
no-import startup, numeric/source comparisons, import isolation, missing-bundle
fallback and desktop/mobile layouts. No paid/private price dataset is bundled.

## Data refresh wiring (verified 2026-11-12)

- `.github/workflows/refresh.yml` runs daily and commits `data.json` / `tic.json` to **main only**. It does not rebuild `ring-evidence.js` and does not touch the integration or development branches.
- `ring-evidence.js` (the Explorer's bundled snapshot) is generated by `python -m scripts.build_ring_evidence` and is only as current as its last manual rebuild. The Explorer's 72-hour review window is separate from the map's per-series limits.
- The Delta workflow therefore fetches same-origin `data.json` in the browser (on load, every 15 minutes, on tab focus and via "Refresh now"). On failure it keeps the last successful copy from this browser, else the bundled snapshot, and labels every series Fresh / Stale / Unavailable by its measurement date. On a branch whose `data.json` is not updated, series will correctly read Stale.
- Offline responses now carry an explicit fallback marker from the service worker. The Delta loader labels them as retained site-cache data, marks context stale even when its measurement date is recent, and does not advance the last successful network-load time. PortWatch stays excluded. The historical bundle's 72-hour window and current context's per-series limits remain separate, disclosed policies.

## Product company evidence and the frozen research case

Product update baseline: `delta-what-changed` at
`7d6f5477be6a9ff02cfeee6acc954e01b5c0e8f1`.

`product-data/delta-company-evidence.json` is the sole company-figure input to
the Delta workflow. Its generated offline module is `delta-company-evidence.js`:

```bash
python -m scripts.build_delta_product_evidence
python -m unittest discover -s tests -p test_delta_product_evidence.py
node tests/test_delta_context.cjs
```

The separate `intelligence/data/delta-quarterly-curated.json`, research viewer
and `ring-evidence.js` historical comparison remain unchanged. Tests pin their
newline-normalized contents and reproduce the product bundle independently.
Do not update the shared research file or rebuild the historical bundle just
to make the product current. Research inputs need their own governed change.

The product data includes issuer-release GAAP figures for 2026Q1–Q3 and their
2025 same-quarter comparatives. The fuel measure is **aircraft fuel and related
taxes**, not adjusted fuel expense or crude/jet spot prices. Consolidated revenue
and fuel-share-of-revenue are descriptive, not causal or stock-return signals.
Quarter-end, source publication date, exact retrieval time and captured-source
SHA-256 are separate. Sources were retrieved and statement lines checked on
November 12, 2026, America/Chicago (November 13 UTC); this does not establish
their historical first availability. Raw source captures remain outside Git.

The 45-day assumed publication deadline has been removed. A known source release
without a loaded quarter says **published quarter missing**. Otherwise a
publication check older than seven days says **source check overdue** and retains
the figures; it does not assert a new quarter has been published. A recent check
means only the latest confirmed quarter is loaded, not continuous live coverage.
Seven days is an explicit review policy, not a provider publication schedule.
Future review clocks, invalid data or a missing product module fail unavailable;
they never fall back to the research numbers. Missing adjacent quarters are not
silently replaced by nonadjacent comparisons.

Company releases are reviewed/transcribed inputs, not an automatic earnings
collector. Current market context still refreshes from this site's `data.json`.
Both product data and its module are precached. Historical, company and market
evidence remain separately labeled in the unsaved decision/no-trade draft.

Browser checks use synthetic refreshed market context and isolated profiles;
no live price pulls or research studies are executed. Screenshot market-context
fixtures are demonstrations, not a live data capture. Use Playwright and
`PLAYWRIGHT_CHANNEL=chrome` for system Chrome, then run:

```bash
node tests/test_delta_workflow_browser.cjs
node tests/test_offline_entry.cjs
node tests/test_evidence_handoff.cjs
```
