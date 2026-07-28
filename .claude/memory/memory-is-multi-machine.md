---
name: memory-is-multi-machine
description: How the agent's own memory works — shared tier is the repo's .claude/memory/ wired as NATIVE auto-memory (enforced caps + timestamps), machine-local facts go in CLAUDE.local.md
metadata:
  node_type: memory
  type: reference
  originSessionId: ce0dce5a-3949-422b-8e31-e4a49dd05d35
---

The agent's memory is **two-tier** (set up 2026-06-14; re-platformed onto native rails 2026-07-28).

- **Shared (default)** → `.claude/memory/` IN THE REPO. Travels across machines with `git push/pull`. Holds facts true
  regardless of machine: who the user is, preferences, feedback, project intent, references.
- **Local** → **`CLAUDE.local.md`** at the repo root (gitignored, loaded in full every session). ONLY facts bound to
  this physical machine: a local path, hostname, a locally-installed tool quirk.

**Litmus:** "at a different computer tomorrow, still true and useful?" Yes → shared. No → `CLAUDE.local.md`.
One fact = one place; never duplicate across tiers.

**What changed on 2026-07-28 and why it matters.** The shared tier used to load via an `@.claude/memory/MEMORY.md`
import in `CLAUDE.md`, and the local tier was a second memory *directory* in the home dir. Both were replaced:

- The shared tier is now Claude Code's **native auto-memory**, pointed here by `autoMemoryDirectory` in each machine's
  gitignored `.claude/settings.local.json`. That converts three rules from convention into enforcement: `MEMORY.md` is
  capped at **200 lines / 25KB** (a write past it errors; content past it is silently dropped at load), every file gets
  an automatic `modified:` timestamp, and the index is prompted to merge/drop stale entries as it fills. The `@import`
  was removed — keeping both would double-load the index.
- The local tier moved to `CLAUDE.local.md` because **Claude Code supports exactly ONE auto-memory directory**. A second
  directory has no index and therefore never loads: a machine-local Docker note written 2026-07-24 was found on
  2026-07-28 to have never been read once. Memory that exists but is invisible is worse than no memory — it looks like
  the lesson landed.

**Consequence for a new machine:** `git pull` brings the memories but NOT the wiring (the path is absolute, so it can't
be committed). Create `.claude/settings.local.json` with `autoMemoryDirectory`. `.claude/hooks/memory-wiring-check.mjs`
warns at session start if it's missing — otherwise the failure is completely silent.

**Hygiene is measured, not remembered:** `node .claude/scripts/memory-audit.mjs` (report-only) shows per-session token
cost, index drift, orphans, near-duplicates, oversized files, staleness. Mechanical calls belong to the script;
"do these two mean the same thing?" belongs to the model; deleting belongs to the user.

Full mechanics: skill `/memory` and `## Agent memory` in `CLAUDE.md`. See [[extend-dont-rebuild]] — this was an
extension onto existing rails, not a parallel system, and [[enforce-rules-with-gates]] — the caps are now gates.
