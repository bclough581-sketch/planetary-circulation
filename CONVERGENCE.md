# Amalgam Convergence — experimental v1

This is a separate, **unpublished** development branch. The live GitHub Pages deployment on `main` is unchanged.

## Preview

Serve the repository locally and open `convergence.html`. It reads the existing `data.json` and uses `convergence.js` without a backend. Example: `python -m http.server 8000`, then visit `http://localhost:8000/convergence.html`.

## What works

- Displays source-dated shipping volume deviations, daily energy spot-price changes, and 10-year yield changes.
- Pairs below-baseline shipping with rising oil only if both observations pass freshness and source-health checks.
- Shows the original evidence, dates, sources, alternative checks, and failed/stale observations.
- Shows no convergence when there is no eligible evidence. This is **descriptive co-occurrence**, not proof of a causal connection or a forecast.

## Current constraints

- The latest data snapshot reports a failed IMF PortWatch refresh (API quota exceeded). Shipping is therefore excluded until the source recovers.
- IMF PortWatch commercial reuse requires written permission; this prototype is **not** cleared for paid distribution.
- There is no aviation feed, news feed, event taxonomy, geographic exposure graph, or tested investment edge yet.
- Source age thresholds are conservative presentation rules, not scientific validation.
- The current oil and shipping pairing is a hypothesis for review, not a verified causal mechanism.
- No existing index navigation or production data workflow was changed.

## Test

Run `node tests/test_convergence.cjs` (Node.js 18+). This test is separate from the existing Python suite.

## Next engineering milestones

1. Resolve PortWatch quota behavior and verify its baseline calculations.
2. Add a structured, timestamped event schema and evidence linking.
3. Add independently licensed, commercially usable feeds before enabling payment.
4. Conduct user tests on evidence chains and usefulness before making commercial claims.
