# health-sweep — run log

One row per DAY **per MACHINE** (the last run of that day on that machine wins). Written by `.claude/scripts/health-sweep.mjs` on every run —
**this is the evidence the standing-cadence reminder reads, so it is never edited by hand.** Two things live
here that a single sweep cannot tell you: *whether the weekly cadence is actually being kept*, and *which
direction the numbers are moving.*

| date | machine | broken | drift | verdict |
| --- | --- | --- | --- | --- |
| 2026-07-30 | (pre-column) | 44 | 90 | 44 BROKEN |
| 2026-07-30 | (pre-column) | 0 | 140 | clean |
| 2026-07-31 | (pre-column) | 1 | 78 | 1 BROKEN |
| 2026-07-31 | (pre-column) | 0 | 140 | clean |

> Rows marked `(pre-column)` were written before the machine column existed (added 2026-07-31). Their
> machine is genuinely unknown and is NOT guessed — including the 2026-07-30 pair, where one box reported
> 44 BROKEN and another reported clean on the same day, which is why the column exists.
| 2026-07-31 | thien-ubuntu | 1 | 61 | 1 BROKEN |
| 2026-07-31 | TNT-Laptop | 1 | 75 | 1 BROKEN |
| 2026-08-01 | TNT-Laptop | 1 | 75 | 1 BROKEN |
