---
name: session-wrap
description: Wrap up a work session on a MiniServer project — distill non-obvious knowledge (decisions + pitfalls + reasoning) into docs/decisions.md, update docs/00-map.md if the module map changed, add a line to platform/06-knowledge-ledger.md for cross-project lessons, suggest personal memory. Use at the end of a significant editing pass or when the user says "wrap up" / "record what we learned" / "update the docs now we're done".
---

# Skill: Wrap up the session & accumulate knowledge (session-wrap)

This is the **compounding** mechanism: turn what was just done in the session into committed knowledge the next session
can read. The recording standard + where to record follow `platform/05-documentation-standard.md §5–§6`. Run at the END of a significant
work pass (not after every little edit).

Filtering principle: **only record the non-obvious** — the thing that, if the next session didn't know it, would lead to *repeating a mistake /
breaking an invariant / wasting effort re-deriving it*. What the code and `git log` already say (renames, typo fixes, adding an
obvious field) → do NOT record.

## Step 1 — Determine the session scope

- Which project (directory under `MiniServer/`)? Look up the `kind` in `INVENTORY §0`.
- What did this session do? Based on: the pending changes (`git status`/`git diff --stat`), the session's new
  commits, and the conversation thread. Silently summarize 3–6 bullets of "what changed".

## Step 1.5 — Write the recall digest → `platform/log/YYYY-MM-DD.md` (the temporal tier)

Before distilling the *why* (Steps 2–4), persist the *what* as a dated **recall** entry — so "what happened around when /
at milestone X" is answerable later. Append today's digest to `platform/log/YYYY-MM-DD.md` (create from
`log/_TEMPLATE.md` if today's file doesn't exist; schema + tier rules in `log/README.md`):

- One `type: episodic` block with frontmatter (`id`, `created`, `importance` 1–10, `milestone_id`, `related_ids`,
  `embedding: null`) + **What happened** (raw bullets) · **Decisions made** (pointers to the Step-2 `decisions.md` entries,
  not copies) · **Open threads**.
- Shipped/finished a milestone this session? → also add (or update) a `type: reflection` anchor entry and point this
  session's episodic `milestone_id` at it (the FK that recall walks around).
- **This is the recall tier → it is the RAW record, and it is NEVER auto-loaded.** Steps 2–4 below distill its durable
  lessons *upward* into `decisions.md`/ledger (archival). Don't duplicate content across the two — link.
- Skip only for a trivial pass with nothing worth a dated record (same bar as Step 2).

## Step 2 — Extract decisions/pitfalls → `docs/decisions.md` (distil UPWARD from the recall digest)

For each non-obvious thing in the session, ask 4 questions then write one entry (newest ON TOP, following the §5 skeleton):

- **Context** — why was the decision needed?
- **Decision / Pitfall** — what was chosen / what is the pitfall?
- **Why** — the reasoning + the options ruled out (the most valuable part).
- **Related** — `file:line`, `[[other-entry]]`, `INVENTORY §n`.

If the project has no `docs/decisions.md` yet → create it from `project-docs/templates/decisions.md` first (or run
`/project-docs scaffold`). If nothing in the session was non-obvious → say clearly "this session produced no new knowledge
worth recording" and skip it, do NOT fabricate an entry for the sake of it.

## Step 3 — Update `docs/00-map.md` if needed

Did the session add/remove/change a module role, route, model, or main flow, or change an invariant/secret? → update
the corresponding section of `00-map` (§3 module map, §4 flows, §6 invariants, §7 secrets). The map must match the code
after the session. No structural change → leave it as is.

## Step 3.5 — Close any finished plan in `docs/plans/`

If this session worked off a persisted plan (`docs/plans/*.md`, `status: active`):

- Did the work **finish**? → flip its `status:` to `done` and **distill its _Decisions to distill_ bullets into
  `docs/decisions.md`** (the durable "why" migrates plan → decisions, per `05-documentation-standard.md §5.5`). Don't leave the
  knowledge living only in a closed plan.
- Did the work **partially** advance? → tick off completed steps + bump `updated:` (leave `status: active`).
- Was it **dropped**? → `status: abandoned` with a one-line reason.
- Does it hold a **time-gated** step (something only answerable by letting time pass)? → make sure the
  plan carries `checkin: YYYY-MM-DD` **and** a `## Check-in runbook`, so the session-start hook reminds
  the user on the day with the steps already written (`/project-plan` Step 3.5). If a check-in happened
  this session, roll `checkin:` forward or clear it — a stale date is a reminder that has stopped meaning
  anything.

No plan file for this work, but it was big/multi-session → consider creating one via `/project-plan` so the next session
inherits the roadmap.

## Step 4 — Cross-project lesson → the ledger (index + detail are SEPARATE files)

Does this knowledge apply to **≥2 projects** or to **the platform itself**? Then it is **two writes, not one**:

1. **Detail** → append the full entry to `platform/ledger/YYYY-MM.md` (current month; create the file from the
   header of the previous month's if it's a new month):
   ```markdown
   ### 2026-07-28 — <headline, the same text you'll put in the index>

   <a id="2026-07-28-headline-slugified-lowercase-hyphens"></a>

   **<headline>** — full reasoning, the failure it came from, what to do instead. As long as it needs to be.
   ```
2. **Index** → add ONE row to section A of `platform/06-knowledge-ledger.md`:
   ```markdown
   | 2026-07-28 | <headline, ≤120 chars, no detail> | [→](ledger/2026-07.md#2026-07-28-headline-slugified) |
   ```

> **Do NOT paste the detail into the index table.** That rule existed from day one and eroded anyway: by 2026-07-28 the
> index had reached 421KB (~105K tokens) with single rows over 2500 characters, and had to be split mechanically
> (`.claude/scripts/ledger-split.mjs`). The index is for scanning "have we tripped on anything like this?" — it is only
> useful while it stays scannable. Run `node .claude/scripts/memory-audit.mjs` if unsure whether it is drifting again.

If the project is creating its `decisions.md` for the first time → add/edit the pointer in section B.

> An **infrastructure**-level pitfall (Docker/Traefik/Watchtower/Authentik) does NOT go in 06 — record it in
> `02-known-traps.md`. App lifecycle (add/remove/change domain) → `INVENTORY.md`.

## Step 5 — Personal memory (only when it's the right kind)

If during the session the user revealed a **preference / way they want to work** (not knowledge about code) → record it
via skill **`/memory`** (which owns the two-tier mechanics: shared in-repo `.claude/memory/` that syncs across machines,
vs the local home-dir tier — pick with its litmus). Knowledge *about the project* does NOT go into memory — it belongs in
`decisions.md`. (Role split: see `05-documentation-standard.md §6`.)

## Step 5.5 — Skill-induction scan (cadence — like `/idea sort`)

Did a **multi-step process recur** this session (and in the day-log/git ≥3× total)? → run **`/skill-proposer`**: it drafts
a candidate skill into `platform/skill-proposals/` for a human to review + install — it never installs. **"Nothing
worth proposing" is the normal outcome** (anti-sprawl — the platform already has many skills); only propose on a real
rule-of-three. This is the SKILLS sibling of the `/idea sort` cadence (which re-ranks FEATURE ideas). Skip if nothing recurred.

## Step 6 — Report (do NOT commit/push automatically)

List concisely: which entry was added to `decisions.md`, what `00-map` changed, whether a `06` line was added, which memory
(if any). These doc changes should go **in the same commit as the session's code** (per the pre-commit hook's
suggestion) — but **only commit/push when the user asks**. If the user wants to commit, suggest folding the docs into the code commit.

## Step 7 — Model-routing carry-forward (see `CLAUDE.md` §"Model routing")

Two quick checks at wrap-time — both are *reminders to the user*, not auto-actions:

- **Did the model get switched this session?** If so, flag whether the **global default was left changed** — the `/model`
  picker's **Enter persists to `~/.claude/settings.json`** (affects all future sessions); only **`s`** is session-only.
  If a weak model may have become the global default, tell the user to reset it.
- **Did the session expose a chunk of bulk-mechanical work** (wide reads, fan-out, bulk transforms)? Note in
  `decisions.md` that it's a candidate to **delegate to a cheaper subagent under Opus review** next time — so the
  knowledge that "this part is safe to staff cheaply" doesn't evaporate.
