---
name: git-fetch-before-work
description: Always git fetch/pull before reading multi-session state — local can be days behind another machine
metadata:
  type: feedback
---

# Git fetch before starting work (anti-duplicate)

The repo travels across machines. **Always `git fetch` (or `git pull`) before reading the current state of a
multi-session task** — local can be days behind remote, and the open threads / sandbox / plans on remote may already
have been resolved by another machine.

## Why

2026-06-17 session: I read `66f93d1` local state ("3 sandbox fixes pending install"), spent the session re-doing fixes
#1 + #2 from `platform/plans/b4b3-fixes-sandbox/` — only to find on push that `origin/main` was 12 commits ahead
and `d8c0383` (2026-06-15) had ALREADY installed those exact fixes + done the doc-sync. Wasted work; the local
commit had to be reset. The "open threads" I planned to fix were already closed.

## The rule

Before reading inventory / plans / open-thread state on entry to a session:

```bash
git fetch && git status   # is local behind?
git pull --ff-only        # if behind and clean, sync
```

Especially before:
- Reading `platform/plans/*-sandbox/` (sandbox dirs are deleted once installed — local stale = phantom work).
- Reading the day-log / `06-knowledge-ledger.md` (other machines log here too).
- Re-deriving "what's left to do" from `INVENTORY.md` / plan checkboxes.

## Litmus

If the task is "tell me / pick up open threads / continue from where we left off" → **always fetch first**. Only skip
the fetch when the task is local-scoped and self-contained (e.g. "run the linter on this file").
