# Chain 1 spec v0.2: chokepoint -> crude -> airline fuel -> DAL margin (DRAFT, unmerged)

v0.2 amends v0.1 after ChatGPT's re-review (amalgam-stage1-2-rereview.md). No build, no data pull, no lock, no k count. Alignment of rings = evidence lined up, never a forecast.

## Links and what each may claim
| Link | Relation kind | May claim | Must not infer |
|---|---|---|---|
| L1 chokepoint transits -> crude | exposure / hypothesized_transmission | Physical channel, conditional on route, cargo mix, loaded tankers, diversions, inventories. Counts belong to their source and measurement date. | Fewer vessel transits != less crude supply or higher price; shared demand/geopolitical shocks affect both. |
| L2 crude -> airline fuel | exposure / hypothesized_transmission | Crude is a jet-fuel input. | A crude quote is not Delta's realized fuel price or fuel expense (jet spreads, geography, timing, hedging, volume, accounting basis). |
| L3 fuel expense -> DAL margin | accounting contribution (NEW kind; schema + validators must be versioned/extended, not an unsupported enum in the current importer) | Accounting bridge holding other items fixed, consolidated GAAP, consistent units. | Cheaper fuel != better total margin; no causality, no share-price claim; several figures from one release are not independent corroboration. |
`coincident` only for descriptive co-occurrence. `lead_lag` is never promoted to causal. Every empirical link carries publication/availability time, revisions, units, lag window, evidence refs, missing[].

## Placebo rules (replaces v0.1 "shuffled lag" wording)
- L1: predefine an economically relevant unaffected route/cargo comparison BEFORE seeing outcomes; account for global demand and rerouting.
- Temporal claims: preserve serial dependence and common-shock blocks (block bootstrap / circular shift). IID shuffling of daily rows is NOT an acceptable null. Include a future-disruption-vs-past-outcome falsification for leakage/direction.
- L3: reconcile the financial bridge and alternatives; no invented statistical placebo for an identity. A new predictive/causal claim needs its own preregistered MDE/power screen at the applicable global k.
- Full chain: separate chain-level target, controls, multiplicity. Three plausible links do not validate the chain.

## n rule (replaces "n<30 banner")
Display/planning label only, not a validity threshold. Count independent episodes/quarters/blocks, never vessel rows or daily prices. Retained data = 8 DAL quarters (annuals overlap them, so not 10 observations; dependence shrinks it further). n<30 labels "too few independent points to say"; it does not make a sourced fact false or justify a DEAD verdict. n>=30 grants no power and no validation badge.

## Data rights
Public access != redistribution permission. Before any transit pull: document exact dataset, licence/terms version, attribution, display/caching/derivative permissions, access limits. Existing PortWatch quarantine stays until the reuse question is resolved. Prefer EIA, ECB, Treasury for the other links. Issuer releases: transcribe numbers with link, no republishing text.

## Acceptance for a first build
Static JSON per link, offline, every number with source URL and as-of; Documented type impossible without a source; no bare correlation without n and independence note; placebo output displayed. Nothing merges or goes live without Brent.
