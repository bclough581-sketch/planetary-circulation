# Chain 1 spec v0.3 (DRAFT, unmerged): chokepoint -> crude -> airline fuel -> DAL fuel contribution

Supersedes v0.2 after ChatGPT's point-by-point review. Descriptive first build only. No source pull, lock, trial, k increment, merge or deployment is authorized by this spec. Validating the software/schema does not validate the economic hypothesis.

## 1. Scope
Ring geometry and motion are decorative. Link cards state the evidence, relationship type and limitations separately; neither alignment nor coverage establishes causality or predictive value. Exposure, hypothesized channel and accounting contribution are not three independent confirmations.

## 2. L1 chokepoint transits -> crude (exposure / hypothesized_transmission)
Before any source is integrated, the input contract names the quantity: all-vessel count, loaded crude-tanker count, tonnage, or capacity; crude vs products vs other cargo; route, direction, interval, baseline, unit. A vessel-count decline is never relabeled as a crude-supply decline. If distinctions are unavailable, show the count with a limited hypothesis, filling nothing silently. A blocked/unlicensed source leaves L1 visibly unavailable/quarantined; L2 and L3 still render. Common-shock caveat stays.

## 3. L2 crude -> airline fuel (exposure)
Endpoints are explicit and distinct: dated crude benchmark, jet-fuel benchmark, realized fuel price per unit, total reported fuel expense. No raw correlation of crude vs total fuel expense is presented as pass-through. Any future empirical version predefines target, lag, volume, spread and hedging treatment, and its control is justified separately from L1.

## 4. L3 fuel expense -> DAL (accounting_contribution, graph schema v2)
- Machine enum `accounting_contribution`; explicit graph schema version 2. Constructors/exporter, browser validator, rendering and tests define required fields consistently. V1 inputs stay V1: the v1 importer must keep REJECTING the new kind (test).
- Chosen formula (explicit fixed-revenue counterfactual): contribution_pp = -100 * (F1 - F0) / R0, F = reported fuel expense, R0 = stated positive reference-period revenue. Holds revenue and other expense fixed; it is NOT the observed contribution to actual margin change. Unexplained residual is never presented as a measured cause.
- Required: consistent periods, consolidated GAAP scope, units, input refs, exact formula and baseline. R0 <= 0 or non-finite -> status invalid, no number.
- Retained-input illustration (arithmetic only, verified): annual fuel 10,566 -> 9,819, R0 61,643 gives +1.2118 pp; reported operating margin 5,995/61,643 vs 5,822/63,364 changes -0.5372 pp. Both true; neither is evidence of a stock-return effect.

## 5. Common link metadata
Separate fields: measurement period, source publication time, first-availability time, revision history. Any may be explicitly `unknown` with precision and verification status; never fabricate a midnight timestamp. Unknown availability blocks lead/lag and predictive claims and any temporal-validation badge, not display of a historical reported fact. Source/period ids and input versions make revisions traceable. Newer reference snapshots and 2024-2025 issuer periods are never shown as time-aligned corroboration.

## 6. Placebo / null (future protocol, not part of first build)
- L1 control: choose before outcomes; an unaffected route is not automatically valid (rerouting spillover, common demand). Record rationale; if no defensible control, causal test = unassessed.
- Reject IID daily shuffling. Block resampling is NOT a sufficient null by itself (it quantifies uncertainty; it does not impose independence). A time-shift test needs its own assumptions and boundary treatment. Future protocol must name target statistic, lag range, block/episode definition, shift eligibility and boundary exclusions, seasonality/regime assumptions, common-shock handling, multiplicity policy, all before outcomes; no wrapping across incompatible periods or sealed-data boundaries.
- Future-disruption vs past-outcome check = falsification only; passing it proves nothing causal.
- L3: no invented placebo for an identity; validate arithmetic with synthetic fixtures.
- Full chain: separate chain-level target, controls, multiplicity. Link evidence != end-to-end effect or tradable edge.

## 7. Sample-size language
Store separately: observed-period count, analysis-block/episode count, dependence assumptions. Effective independent n may be `unknown`; never set n = rows. Annuals overlap the 8 quarters. Label: "Limited sample for this statistical claim. Eight reported quarters; independence not established. Descriptive figures remain available." Not a validity threshold; crossing 30 grants no power or badge; insufficient information is not a DEAD verdict. Any trading premise uses its own preregistered effect size, k, costs and blocks.

## 8. Data rights
Dataset-specific: exact series, licence/terms version, attribution, display/caching/derivative permissions. Naming EIA/ECB/Treasury is not clearance. PortWatch quarantine stays. Issuer-number transcription with link is a first-build restriction, not blanket permission. Include a source only if it serves a defined link or calculation.

## 9. First-build acceptance
Offline, descriptive, approved retained inputs only. Every observation and derived number exposes source inputs, units, period, provenance limits, calculation method. L1/L2 remain hypotheses/exposures. L3 is a versioned, explicitly defined accounting calculation with no causal or predictive status. Test state is `not_run`, `not_applicable` (with reason) or an independently reviewed reported result; no empirical output is required or fabricated. Unknown times and quarantined sources stay explicit. "Documented" is NOT a schema state: use distinct labels sourced_observation / proposed_link / reconciled_calculation / empirically_evaluated_claim. No live fetch, no numeric convergence score.
Tests (synthetic fixtures + retained inputs): v1 rejects new kind; missing/quarantined source; R0 zero/invalid; mixed periods/units; arithmetic; honest n labels; no automatic status promotion; unknown availability blocks temporal badge. Preserve approved HUD and source-to-journal transfer. Brent alone decides merge/deployment.
