# Amalgam (formerly Tributary, Planetary Circulation)

A free, installable, open-data HUD of global money flows and shipping chokepoints. Information only; not investment advice.

- `index.html` + `land.json` + `tic.json` + `data.json`: the static site. No backend, no accounts, no tracking.
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

Saves and deletions use Web Locks when supported and compare the stored version
before writing. A stale tab must reload after the user copies unsaved notes;
without Web Locks, changed-storage checks still apply but concurrent writes
are not guaranteed atomic. Failed saves preserve form contents. Invalid storage
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
