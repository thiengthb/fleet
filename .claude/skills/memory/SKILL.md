---
name: memory
description: Read, write, and PRUNE the agent's persistent memory about the user. Two tiers — a git-synced shared tier (`.claude/memory/`, wired as Claude Code's native auto-memory) plus `CLAUDE.local.md` for machine-specific facts. Use when recording a user preference / feedback / identity fact, recalling what's known about the user, answering "where does memory live / is it synced / why don't I see it", maintaining the index, deciding what to forget or merge, or onboarding memory to a new machine. Project/code knowledge does NOT go here — that belongs in `docs/decisions.md`.
---

# Skill: Agent memory (two tiers, native rails, with forgetting)

The agent's long-term memory **of the user** — who they are, how they like to work, corrections they've given. Set up
2026-06-14; re-platformed onto native rails 2026-07-28. `CLAUDE.md §"Agent memory"` states the rule; this skill owns
the mechanics.

> **Not for project knowledge.** Facts about the code / a decision / a pitfall go to `docs/decisions.md`,
> `02-known-traps.md`, or the ledger (`/session-wrap`). Memory is only about the *user* and *how to work with them*.
> Role split: `05-documentation-standard.md §6`.

## The two tiers

| Tier | Location | Synced? | Loaded | Holds |
|---|---|---|---|---|
| **Shared** (default) | `.claude/memory/` in the repo | ✅ `git push/pull` | `MEMORY.md` index every session; topic files **on demand** | Facts true on *every* machine: identity, preferences, feedback, project intent, references |
| **Local** | `CLAUDE.local.md` at the repo root | ❌ gitignored | in full, every session | ONLY facts bound to *this physical machine*: a local path, hostname, a locally-installed tool quirk |

**The shared tier is Claude Code's native auto-memory**, pointed here by `autoMemoryDirectory` in each machine's
gitignored `.claude/settings.local.json`. That is not cosmetic — it hands three rules to the harness to enforce
instead of to the agent to remember:

1. **`MEMORY.md` is capped at 200 lines / 25KB.** Content past the cap is *silently dropped at load*. A write that
   exceeds it returns an error demanding the index be rewritten.
2. **Every memory file gets an automatic `modified:` ISO timestamp** in its frontmatter on each write — the freshness
   signal, recorded by the tool, never estimated by the model.
3. **As the index fills, the harness prompts to merge or drop stale entries** — the forgetting trigger arrives on its
   own rather than depending on anyone noticing.

> **There is exactly ONE auto-memory directory.** That is why the local tier is `CLAUDE.local.md` and not a second
> memory folder: a second folder has no index and never loads. On 2026-07-28 a machine-local memory written on
> 2026-07-24 was found to have never been read once, for exactly this reason.

## Pick the tier — one litmus

> **"If I sat at a different computer tomorrow, would this fact still be true and useful?"**
> **Yes → shared** (`.claude/memory/`). **No → `CLAUDE.local.md`.**

When unsure, prefer **shared** (a slightly-too-general fact is harmless; a lost preference is not).
**One fact = one place — never store the same fact in both.**

## Recall (reading)

The shared index is in context every session. To use a fact, read its file on demand — the index line points at it.
Recalled facts reflect what was true when written: if one names a file, flag, or path, **verify it still exists**
before acting on it. `modified:` tells you how old the claim is.

## Record (writing) — the procedure

1. **Does it belong in memory at all?** Is it about the *user / how to work with them*? If it's about the code or the
   project, stop — route it to the Knowledge OS instead.
2. **Check for an existing file first** (glob `.claude/memory/*.md`). Update that file rather than creating a near-copy.
   If a new fact *replaces* an old one, see "Forget" below — don't leave both.
3. **Pick the tier** with the litmus.
4. **Write** `.claude/memory/<short-kebab-slug>.md`:
   ```markdown
   ---
   name: <short-kebab-case-slug>
   description: <one line — this is what a cheap model sees when deciding whether to load the file. Make it specific.>
   metadata:
     node_type: memory
     type: user | feedback | project | reference
   # supersedes: <slug>   # only when this replaces an earlier memory
   ---

   <the fact. For feedback/project, follow with **Why:** and **How to apply:** lines.>
   ```
   - `modified:` is added by the harness — do not hand-write or hand-edit it.
   - `user` — who the user is. `feedback` — how to work with them (corrections **and** confirmed approaches; include
     the why). `project` — goals/constraints not derivable from code or git. `reference` — pointers to external
     resources or how a system works.
   - Link related memories with `[[other-slug]]`; a link to a file that doesn't exist yet just marks one worth writing.
5. **Add the index line** to `.claude/memory/MEMORY.md`: `- [Title](file.md) — short hook`. **Pointers only** — never
   fact content. Keep the whole index under 200 lines.
6. **Don't record what's already written.** If it's in `CLAUDE.md`, the docs, or git history, don't duplicate it. If
   asked to remember something obvious, ask what was non-obvious about it and save *that*.

## Forget — the part that keeps memory useful

Memory that only ever grows stops being memory and becomes noise. Forgetting is **deterministic where it can be, and
human-approved where it can't** — never a quiet judgement call by the agent.

**The split (this is the rule, not a preference):**

| Decision | Who | Why |
|---|---|---|
| Is this file duplicated / oversized / unindexed / past the cap? | **the script** (`memory-audit.mjs`) | mechanical and exactly checkable — paying model tokens to eyeball it is the waste this replaces |
| Which of two contradicting memories is current? | **the rule**: newest `modified` wins; a `supersedes:` field wins outright; the more specific beats the more general | freshness inferred by a model is unreliable — record it, don't estimate it |
| Do these two memories actually *mean* the same thing? | **the model**, proposing | genuinely semantic; the script can only measure text overlap |
| Delete it? | **the user** | a wrongly-forgotten preference is invisible until it is re-broken |

**Protected from forgetting regardless of age** — never propose dropping these just because they are old:
a safety or security rule · an architecture decision · a lesson from a production incident · anything the user has
stated **more than once**. These are exactly the memories that are rarely retrieved *and* expensive to lose.

**Never delete on suspicion of staleness.** Prefer, in order: (1) re-confirm it with the user, (2) write the corrected
version and set `supersedes:` on it, (3) delete only what is confirmed wrong. Nothing here auto-deletes.

**The workflow:**

```bash
node .claude/scripts/memory-audit.mjs          # report-only; nothing is changed
node .claude/scripts/memory-audit.mjs --json   # same, machine-readable
```

It reports: per-session token cost of the always-loaded set · index drift (orphan pointers, unindexed files, entries
past the load cut-off) · near-duplicate pairs (word-shingle Jaccard) · lines repeated across files · oversized files ·
days since last touched. **Run it at `/session-wrap` cadence, and always after adding several memories in one session.**
Then bring the findings to the user as a short list — merge / rewrite / keep / delete — and act only on the answers.

## Commit so it actually syncs

The shared tier reaches other machines only once pushed. Fold memory files into the session's commit — **only when the
user asks to commit** (platform rule).

## New machine

`git pull` brings the memories, but **not** the wiring: `autoMemoryDirectory` is an absolute path and cannot be
committed. Create `.claude/settings.local.json` (gitignored) with:

```json
{ "autoMemoryDirectory": "<absolute path to this repo>/.claude/memory" }
```

If it's missing, `.claude/hooks/memory-wiring-check.mjs` says so at session start — memory failing to load is otherwise
completely silent.

## Relationship to `/session-wrap`

`/session-wrap` Step 5 delegates here: at wrap time, if the user revealed a preference or working style, record it with
this procedure — and run the audit if several memories were added. Wrapping is *one* trigger; recording can happen any
time in a session, which is why this is its own skill.
