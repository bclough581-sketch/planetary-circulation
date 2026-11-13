# Delta source confirmation for PR #3

The product panel and its unsaved journal draft now explicitly disclose:

> GAAP revenue includes refinery sales; fuel share uses GAAP revenue, not Delta's headline adjusted revenue.

## URL, hash and receipt check

The Q3 source is the official Delta investor-relations release:
https://ir.delta.com/news/news-details/2026/Delta-Air-Lines-Announces-September-Quarter-2026-Financial-Results/default.aspx

The page is reachable and identifies the September-quarter release dated
October 9, 2026. The source's GAAP and adjusted revenue presentations differ;
the product uses consolidated GAAP total operating revenue consistently for
both the margin and fuel-share denominators.

All three saved HTML captures were rehashed locally and compared with their
original capture receipts and the product's source metadata. Hashes, byte counts,
requested URLs and retrieval timestamps match. Full values are in
`product-data/delta-source-capture-receipts.json`.

| Period | Captured receipt retrieval time (UTC) | SHA-256 prefix |
| --- | --- | --- |
| 2026Q1 | 2026-11-13 02:43:24.105301 | 895e51432906 |
| 2026Q2 | 2026-11-13 02:43:24.400518 | 61884a91f0e5 |
| 2026Q3 | 2026-11-13 02:43:24.703228 | b100857c9565 |

Raw HTML is retained locally outside Git. To verify an available copy, run:

```bash
python scripts/verify_delta_source_captures.py --capture-directory PATH_TO_ORIGINAL_CAPTURES
```

This is a byte-integrity and metadata consistency check. The timestamps were
recorded by the local capture process; they are not independently authenticated
server timestamps or proof of historical first availability. A fresh download
may hash differently because the surrounding website can change. It must not
replace the original capture or inherit its old timestamp. A reviewer without
the original captures cannot independently reproduce the raw-byte comparison
from the manifest alone.

No company figures, research inputs, counters or historical-case data changed.
The original publication-review clock was not reset by this disclosure or
receipt confirmation. Quarterly checking remains manual; there is no automatic
Q4 watch. No merge or deployment is included.
