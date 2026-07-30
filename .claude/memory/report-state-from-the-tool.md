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

**The same root, in the shell (2026-07-28):** I ran `./scripts/rebuild-and-verify.sh 2>&1 | tail -22`
and the harness reported **exit code 0** while the script had actually printed `FAIL compose build/up`
and exited 1 — Docker Desktop had died mid-build. A pipeline's exit status is the LAST command's, so
`| tail` (or `| head`, `| grep`) silently launders any failure into success. **Never pipe a command
whose exit code I intend to trust; capture output to a file, or check `${PIPESTATUS[0]}`, or run it
bare.** This is the pipe-shaped version of the same mistake: reading a green that was never measuring
the thing.

**Third instance, and it was not a number (2026-07-30):** an unticked step in a plan marked `status: done`
said *"the GitHub repo is still `thiengthb/miniserver-platform`"*. I repeated that to the user as current
state and built it into the options I asked them to choose from. `gh repo view` said `fleet` — renamed the
day before, already recorded in INVENTORY with its date, with `origin` already pointing at the new URL. **A
document's claim about the world is a remembered number wearing prose**, and a closed plan is the most
convincing form of it, because "done" reads as settled. Widen the litmus from *numbers* to *any assertion
about present state that a one-line command could check*: repo/remote names, whether a file exists, whether
a service is up, whether a step was really taken. Now also caught mechanically by `recurrence-check` D5.

**How to apply:** before writing any state-number into a summary, run the one cheap command that
produces it (`git log origin/main..HEAD | wc -l`, a `count(*)`), and quote THAT. If I catch myself
about to type a figure without having just observed it, that is the tell — stop and check. Narrower
than [[verify-end-state-not-upload]] (which is about not claiming *done* from an intermediate step):
this is about not reciting a stale *count*. Same root: assert from evidence, not from memory.
