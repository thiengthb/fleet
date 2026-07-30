---
name: user-edits-files-concurrently
description: The user (or a PARALLEL Claude session on the same tree) edits files mid-session — re-check the working tree before assuming my edits are isolated or the build is green
metadata: 
  node_type: memory
  type: feedback
  originSessionId: b3e55123-14d7-4f5b-8542-6a81cf4c4eb2
  modified: 2026-07-30T11:33:27.358Z
---

The user frequently edits the codebase in their own editor WHILE I'm working the same session — new files, refactors, even reworking a feature I just built (e.g. 2026-07-14: they reworked the quiz from multiple-choice to fill-in-the-blank and removed the `mode` setting in parallel; their concurrent edit to `settings-schema.ts` removed an export another file imported and broke the build mid-task). Harness "file modified on disk" notes are the signal.

**Why:** their working tree is NOT just my changes. Assuming isolation leads to: committing their unfinished WIP under my message, clobbering their in-editor version, or reporting "build green" when their concurrent edit broke it.

**How to apply:** before building/committing, run `git status` + skim `git diff` — reconcile, don't assume. If a file changed under me and it conflicts (e.g. a removed export), STOP and surface it, don't auto-merge or fight their edit ([[check-prior-decisions-early]]). When committing, stage only MY files and leave their WIP unstaged unless they asked me to commit it ([[feature-atomic-commits]]). This is a normal working style for a solo operator, not a mistake to flag every time.

**When they ask for a change IN a file they're actively editing** (e.g. 2026-07-24: the groups-view card-description placeholder, while they were mid-refactoring `groups-view.tsx`): don't just defer it — MAKE the edit and leave it UNCOMMITTED so it merges into their working copy, and tell them to commit that file with their WIP. I commit only the files they're NOT touching (per-cluster, staged explicitly). Deferring a change they explicitly requested reads as stalling; editing-but-not-committing delivers it without committing their unfinished work under my name. Verified my isolated files first by diffing each (line counts matched my edits) before committing them.

**The "concurrent editor" is sometimes ANOTHER Claude session, not the human** (2026-07-24: I did the resources/detail UI polish while a PARALLEL session on the SAME working tree built the `ResourceAddDialog` unification; each of us saw the other's uncommitted files as "the operator's IDE edits", and both sessions independently rebuilt the container to the same image hash). Tells: files appear that match no request I received; a session-wrap log entry shows up in Claude's own voice describing work I didn't do; a `next build` lock is already held; a gate fails TRANSIENTLY because the other session is mid-saving a file (a re-run goes green). **How to apply:** same discipline as for the human — stage only MY fileset, never assume isolation — PLUS: before attributing a gate/build failure to my own change, re-run and re-check `git status` (it may be a mid-write race), and don't tell the user "you're refactoring X" when it may be a parallel agent — say the tree carries changes outside my fileset and let them place them. Watch for log/id collisions when two sessions wrap the same day (I had to bump my episodic id to avoid a duplicate).

**Two more things a parallel session does, both seen 2026-07-30 during a 6-hour pass.** (1) **It pushes.** My
`unpushed` count went from 7 to 1 without my running anything, because the other session pushed `main` and carried my
commits with it. So never report an unpushed/ahead number from memory — read it at report time, and do not treat a
drop as evidence that something of mine went missing. (2) **The id collision happens in the other direction too:** it
wrote `id: 2026-07-30-02` on top of the one I had already used, and a later block of theirs then referenced that id.
I did NOT renumber — a duplicate id is a conflict to surface, and rewriting another session's record (plus the
reference pointing into it) is not my call. Take the next free number, say which block your `related_ids` mean, and
report the ambiguity. Recall-by-id for that date stays ambiguous until the human picks the fix.
