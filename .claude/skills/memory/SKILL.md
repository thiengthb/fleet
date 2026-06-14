---
name: memory
description: Read or write the agent's persistent memory about the user. Two-tier — a SHARED tier in the repo (`.claude/memory/`) that travels across machines via git, plus a LOCAL home-dir tier for machine-specific facts. Use when recording a user preference / feedback / identity fact, recalling what's known about the user, answering "where does memory live / is it synced across machines / why don't I see it", maintaining the memory index, or onboarding the memory to a new machine. Project/code knowledge does NOT go here — that belongs in `docs/decisions.md`.
---

# Skill: Agent memory (two-tier, multi-machine)

The agent's long-term memory **of the user** — who they are, how they like to work, corrections they've given. It is
**two-tier** so the shared part follows the user across machines via git, instead of being trapped on one box (the
native Claude Code memory lives in the home dir and never syncs). Set up 2026-06-14; the rule also lives in
`CLAUDE.md §"Agent memory"`. This skill owns the mechanics.

> **Not for project knowledge.** Facts about the code / a decision / a pitfall go to `docs/decisions.md`,
> `02-known-traps.md`, or `06-knowledge-ledger.md` (the Knowledge OS — see `/session-wrap`). Memory is only about the
> *user* and *how to work with them*. Role split: `05-documentation-standard.md §6`.

## The two tiers

| Tier | Location | Synced? | Holds |
|---|---|---|---|
| **Shared** (default) | `.claude/memory/` in the repo | ✅ via `git push/pull` | Facts true on *every* machine: user identity, preferences, feedback, project intent, references |
| **Local** | `~/.claude/projects/<path-hash>/memory/` (home dir) | ❌ never | ONLY facts bound to *this physical machine*: a local filesystem path, hostname, locally-installed tool version/quirk |

Both tiers auto-load each session: the shared index via the `@.claude/memory/MEMORY.md` import in `CLAUDE.md`; the
local index natively by the harness. Almost everything is shared — the local tier is usually empty.

> The local folder name (`C--project-miniserver-platform`) is the repo's **absolute path, hashed**. On another machine
> at a different path the hash differs → a *different* local dir. That's fine (it's per-machine by design), and it's
> exactly why the durable memory must be the in-repo shared tier, not the home dir.

## Pick the tier — one litmus

> **"If I sat at a different computer tomorrow, would this fact still be true and useful?"**
> **Yes → shared** (`.claude/memory/`). **No → local** (home dir).

A preference, a correction, who the user is, what a project is for → shared. A path like `D:\tools\x` that only exists
on this laptop, this machine's name → local. When unsure, prefer **shared** (a slightly-too-general fact is harmless;
a lost preference is not). **One fact = one file = one tier — never store the same fact in both** (that's the drift the
platform fights, ledger #36).

## Recall (reading)

The shared index (`.claude/memory/MEMORY.md`) is already in context every session via the import. To use a fact, read
its file on demand (the index line points to it). Recalled facts reflect what was true when written — if one names a
file/flag/path, verify it still exists before acting on it.

## Record (writing) — the procedure

1. **Decide it belongs in memory at all** — is it about the *user / how to work with them*? If it's about the
   code/project, stop: route it to the Knowledge OS instead.
2. **Check for an existing file** that already covers it (glob `.claude/memory/*.md` + the local dir). Update that file
   rather than creating a duplicate. Delete a memory that turns out to be wrong.
3. **Pick the tier** with the litmus above.
4. **Write the file** `<tier-dir>/<short-kebab-slug>.md` with frontmatter:
   ```markdown
   ---
   name: <short-kebab-case-slug>
   description: <one-line summary — used to judge relevance on recall>
   metadata:
     node_type: memory
     type: user | feedback | project | reference
   ---

   <the fact. For feedback/project, follow with **Why:** and **How to apply:** lines.>
   ```
   - `user` — who the user is (role, expertise, preferences).
   - `feedback` — guidance on how to work (corrections AND confirmed approaches); include the **why**.
   - `project` — ongoing work/goals/constraints not derivable from code or git history; convert relative dates to absolute.
   - `reference` — pointers to external resources or how a system works (URLs, dashboards, the memory system itself).
   - Link related memories in the body with `[[other-slug]]` — link liberally; a `[[slug]]` with no file yet just marks
     one worth writing later.
5. **Add the index line** to that tier's `MEMORY.md`: `- [Title](file.md) — short hook`. The index is pointers only —
   never put fact content in it. (Shared index: `.claude/memory/MEMORY.md`; local index: the home-dir `MEMORY.md`.)
6. **Don't record what's already written** — if it's in `CLAUDE.md`/docs/git, don't duplicate it (e.g. the
   Vietnamese-chat rule already lives in `CLAUDE.md` → not a memory). If asked to remember something obvious, ask what
   was non-obvious about it and save *that*.

## Commit so it actually syncs

The shared tier only reaches other machines once it's pushed. Memory files are part of the repo → fold them into the
session's commit (or commit on their own) and `git push` — **only when the user asks to commit** (platform rule). On a
new machine the user just does `git pull`; nothing else to set up.

## Relationship to `/session-wrap`

`/session-wrap` Step 5 delegates here: at wrap time, if the user revealed a preference / working style, record it with
this procedure. Wrapping is *one* trigger — recording can happen any time in a session, which is why this is its own skill.
