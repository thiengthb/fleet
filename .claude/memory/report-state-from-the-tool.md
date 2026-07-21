---
name: report-state-from-the-tool
description: "When reporting quantitative state (commit counts, coverage, what's done, unpushed N), read it from the tool AT REPORT TIME — don't recite a remembered number; I stated wrong commit counts twice in one session and the user caught it"
metadata:
  type: feedback
---

When I report a **number that describes current state** — commits ahead/unpushed, coverage (X/Y),
"N items left", how many files changed — I must read it from the tool (`git`, a query) **at the
moment I report it**, not recite a figure I carried in my head from earlier in the session.

**Why:** 2026-07-21, in one long multi-restart session I told the user "19 unpushed", then later "35",
then "6" — all from memory, all wrong; git said 3. The user surfaced it by asking *"hiện giờ bạn đã làm
được gì"* / *"push đi"*, and the discrepancy only showed because I finally ran `git log
origin/main..HEAD`. Remembered counts drift especially across pushes, commits, and session restarts —
exactly when a long autonomous stretch makes me most likely to recite instead of check. The user
works in long hands-off stretches (see [[route-questions-via-discord-not-blocking]],
[[execute-over-handoff]]) and audits my status summaries for accuracy.

**How to apply:** before writing any state-number into a summary, run the one cheap command that
produces it (`git log origin/main..HEAD | wc -l`, a `count(*)`), and quote THAT. If I catch myself
about to type a figure without having just observed it, that is the tell — stop and check. Narrower
than [[verify-end-state-not-upload]] (which is about not claiming *done* from an intermediate step):
this is about not reciting a stale *count*. Same root: assert from evidence, not from memory.
