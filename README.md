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
