# Amalgam intelligence foundation — development branch

This module defines **observations** and **relationships** across nine domains:
weather, geopolitics, maritime, aviation, energy, commodities, economics,
markets and corporate.

## Guarantees at this stage
- Each observation has an explicit source and timezone-aware timestamp.
- Unknown evidence is represented explicitly; no automatic confidence score is invented.
- Relationships are **hypotheses**, not claims of causation or trading edge.
- Relationship records include evidence references, counterarguments, missing data,
  and `predictive_advantage: not_established`.
- Graph validation rejects dangling evidence references.
- No production data, refresh workflow, UI, or homepage has been changed.

## What is not implemented
This is the shared record format, **not** a live ingestion pipeline, pattern-discovery
algorithm, forecasting model, or independent validation engine. A source URL in a
record is attribution, not proof that a feed was successfully queried.

## Test locally
`python -m unittest tests.test_intelligence -v`

## Next
Verify existing feed health and map current data into this structure; add NOAA
weather ingestion and a real weather-to-energy evidence path on this branch,
with tests and license review before considering a merge.
