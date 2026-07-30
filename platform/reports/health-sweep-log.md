# health-sweep — run log

One row per DAY (the last run of that day wins). Written by `.claude/scripts/health-sweep.mjs` on every run —
**this is the evidence the standing-cadence reminder reads, so it is never edited by hand.** Two things live
here that a single sweep cannot tell you: *whether the weekly cadence is actually being kept*, and *which
direction the numbers are moving.*

| date | broken | drift | verdict |
| --- | --- | --- | --- |
| 2026-07-30 | 44 | 90 | 44 BROKEN |
| 2026-07-30 | 0 | 140 | clean |
| 2026-07-31 | 1 | 78 | 1 BROKEN |
