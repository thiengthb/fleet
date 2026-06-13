---
name: session-wrap
description: Wrap up a work session on a MiniServer project — distill non-obvious knowledge (decisions + pitfalls + reasoning) into docs/decisions.md, update docs/00-map.md if the module map changed, add a line to nuc-platform/06-SO-TRI-THUC.md for cross-project lessons, suggest personal memory. Use at the end of a significant editing pass or when the user says "wrap up" / "record what we learned" / "update the docs now we're done".
---

# Skill: Wrap up the session & accumulate knowledge (session-wrap)

This is the **compounding** mechanism: turn what was just done in the session into committed knowledge the next session
can read. The recording standard + where to record follow `nuc-platform/05-TAI-LIEU-CHUAN.md §5–§6`. Run at the END of a significant
work pass (not after every little edit).

Filtering principle: **only record the non-obvious** — the thing that, if the next session didn't know it, would lead to *repeating a mistake /
breaking an invariant / wasting effort re-deriving it*. What the code and `git log` already say (renames, typo fixes, adding an
obvious field) → do NOT record.

## Step 1 — Determine the session scope

- Which project (directory under `MiniServer/`)? Look up the `kind` in `INVENTORY §0`.
- What did this session do? Based on: the pending changes (`git status`/`git diff --stat`), the session's new
  commits, and the conversation thread. Silently summarize 3–6 bullets of "what changed".

## Step 2 — Extract decisions/pitfalls → `docs/decisions.md`

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
  `docs/decisions.md`** (the durable "why" migrates plan → decisions, per `05-TAI-LIEU-CHUAN.md §5.5`). Don't leave the
  knowledge living only in a closed plan.
- Did the work **partially** advance? → tick off completed steps + bump `updated:` (leave `status: active`).
- Was it **dropped**? → `status: abandoned` with a one-line reason.

No plan file for this work, but it was big/multi-session → consider creating one via `/project-plan` so the next session
inherits the roadmap.

## Step 4 — Cross-project lesson → `06-SO-TRI-THUC.md`

Does this knowledge apply to **≥2 projects** or to **the platform itself**? → add one line to section A of
`nuc-platform/06-SO-TRI-THUC.md` (date · one-line lesson · applies to · pointer to detail). If the project is creating its
`decisions.md` for the first time → add/edit the pointer in section B.

> An **infrastructure**-level pitfall (Docker/Traefik/Watchtower/Authentik) does NOT go in 06 — record it in
> `02-MO-XE-LOI-HE-THONG-CU.md`. App lifecycle (add/remove/change domain) → `INVENTORY.md`.

## Step 5 — Personal memory (only when it's the right kind)

If during the session the user revealed a **preference / way they want to work** (not knowledge about code) → consider
recording personal memory (`~/.claude/.../memory`) per the memory convention. Knowledge *about the project* does NOT go into
memory — it belongs in `decisions.md`. (Role split: see `05-TAI-LIEU-CHUAN.md §6`.)

## Step 6 — Report (do NOT commit/push automatically)

List concisely: which entry was added to `decisions.md`, what `00-map` changed, whether a `06` line was added, which memory
(if any). These doc changes should go **in the same commit as the session's code** (per the pre-commit hook's
suggestion) — but **only commit/push when the user asks**. If the user wants to commit, suggest folding the docs into the code commit.
