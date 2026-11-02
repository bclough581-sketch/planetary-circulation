# Data sources and license audit (Phase 0)

Rule: no number goes on the page without a source whose terms allow public display, shown with the attribution it asks for. Not legal advice; one paid lawyer hour is still on the launch checklist.

| Data on the page | Source | What the terms say (as read 2026-11-01) | Required on page | Status |
|---|---|---|---|---|
| EUR crosses (GBP, USD, CHF, JPY, CNY, INR, BRL, ZAR, AUD) | ECB euro foreign exchange reference rates | Free reuse including commercial, source acknowledged as "Source: ECB statistics."; one secondary summary adds that data should not be modified | "Source: ECB statistics." Ranges and moves are labeled our calculation | OK. Ask a lawyer whether derived 52-week ranges count as "modified" |
| US 10-year yield | U.S. Treasury daily par yield curve | U.S. government data, public domain | Credit to Treasury | OK |
| Brent and WTI spot | U.S. EIA open data | U.S. government data, public domain; EIA asks for an acknowledgment with a date | "Source: U.S. Energy Information Administration" | OK. Needs a free EIA API key as a repo secret |
| Chokepoint transits | IMF PortWatch | IMF special terms for data: reuse and publication allowed with attribution ("Source: International Monetary Fund, Database Name, link"); **any commercial reuse needs written permission (copyright@imf.org)** | IMF attribution and link; no IMF logo; say our calculations are ours | OK while free. **Do not turn on the $1 link until the IMF replies** |
| Foreign Treasury holdings | U.S. Treasury TIC | U.S. government data, public domain | Credit to Treasury TIC | OK. Refreshed automatically each month by the daily job (tic.json), with a safety check that keeps the old file if Treasury changes its format |
| Gold, Bitcoin, WTI/FX from FMP and Twelve Data | FMP, Twelve Data | FMP: public display needs a written Data Display agreement, free or not. Twelve Data: attribution required, redistribution terms unconfirmed | n/a | **REMOVED from the public app.** Fine for private use only |
| FX and oil via FRED | FRED API | API terms bar storing or passing on FRED content to third parties | n/a | **NOT USED** |
| Event wounds from trackers | straits.live, global-energy-flow.com | Unverified secondary sites | n/a | **REMOVED.** Replaced by measured chokepoint data |

## Gates the app enforces
1. Freshness: each series has a maximum age (FX 5 days, oil 12, yield 5, chokepoints 21, TIC 100). Older values grey out and drop out of heat.
2. Job health: if data.json is older than 48 hours the page says so. A source that fails keeps its last good values and shows a banner.
3. Claims: no forecasts, no buy/sell wording, no personalization, no performance claims. "Measured, not predicted."
4. Payments: the tip link is off (TIP_URL empty) until the IMF permission question is closed.
