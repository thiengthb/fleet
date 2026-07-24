---
name: user-edits-files-concurrently
description: The user edits files in their own IDE mid-session — re-check the working tree before assuming my edits are isolated or the build is green
metadata:
  type: feedback
---

The user frequently edits the codebase in their own editor WHILE I'm working the same session — new files, refactors, even reworking a feature I just built (e.g. 2026-07-14: they reworked the quiz from multiple-choice to fill-in-the-blank and removed the `mode` setting in parallel; their concurrent edit to `settings-schema.ts` removed an export another file imported and broke the build mid-task). Harness "file modified on disk" notes are the signal.

**Why:** their working tree is NOT just my changes. Assuming isolation leads to: committing their unfinished WIP under my message, clobbering their in-editor version, or reporting "build green" when their concurrent edit broke it.

**How to apply:** before building/committing, run `git status` + skim `git diff` — reconcile, don't assume. If a file changed under me and it conflicts (e.g. a removed export), STOP and surface it, don't auto-merge or fight their edit ([[check-prior-decisions-early]]). When committing, stage only MY files and leave their WIP unstaged unless they asked me to commit it ([[feature-atomic-commits]]). This is a normal working style for a solo operator, not a mistake to flag every time.

**When they ask for a change IN a file they're actively editing** (e.g. 2026-07-24: the groups-view card-description placeholder, while they were mid-refactoring `groups-view.tsx`): don't just defer it — MAKE the edit and leave it UNCOMMITTED so it merges into their working copy, and tell them to commit that file with their WIP. I commit only the files they're NOT touching (per-cluster, staged explicitly). Deferring a change they explicitly requested reads as stalling; editing-but-not-committing delivers it without committing their unfinished work under my name. Verified my isolated files first by diffing each (line counts matched my edits) before committing them.
