# Planetary Circulation

A free, installable, open-data HUD of global money flows and shipping chokepoints. Information only; not investment advice.

- `index.html` + `land.json` + `tic.json` + `data.json`: the static site. No backend, no accounts, no tracking.
- `fetch_data.py`: daily job (stdlib Python) writing `data.json` from ECB, U.S. Treasury, EIA and IMF PortWatch.
- `.github/workflows/refresh.yml`: runs the job daily on GitHub and commits `data.json`.
- `LICENSES.md`: source-by-source license audit and the gates the app enforces.

Setup: add repo secret `EIA_API_KEY` (free at eia.gov/opendata), turn on GitHub Pages for the main branch, run the workflow once by hand.
Monthly: update `tic.json` from the Treasury TIC Major Foreign Holders table.
