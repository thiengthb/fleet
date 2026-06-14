---
name: idea
description: Manage the platform's living idea backlog in nuc-platform/10-idea-queue.md — capture, gate+score+rank (feasibility first, then a capped interest bonus), re-sort after each big feature, deep-analyze the top idea into a proposal, push back on biased/infeasible/duplicate ideas, defer the rejected-but-maybe, and prune the dead. The autonomy Layer C "Proposer" front door. Use when the user says "add an idea / what should we build next / re-sort the queue / analyze the top idea", after a feature ships, or when capturing something for later. Propose-don't-execute: a human accepts before an idea becomes a plan.
---

# Skill: Idea queue & lifecycle (idea)

The **intake half** of the Knowledge OS: `/brainstorming` explores one idea's solution space, `/project-plan` persists
an *accepted* plan — this skill owns everything *before* acceptance: the living backlog of platform-native ideas, their
ranking, and their lifecycle. It IS the autonomy roadmap's **Layer C "Proposer."** Source of truth:
`nuc-platform/10-idea-queue.md` (the file's header carries the rules — read it first). Design + the *why*:
`plans/2026-06-14-phase1-idea-queue-proposal.md`. Contract: `09-autonomy-contract.md` (propose-don't-execute).

> **Anti-overlap:** `07-SKILL-CANDIDATES.md` = external community-skill verdicts (NOT here). `docs/plans/` = *accepted*
> forward roadmaps. This queue = *candidate* ideas not yet accepted. An idea graduates: queue → (human accept) → plan.

## The one invariant

**Propose, don't execute.** The agent may capture, gate, score, rank, push back, dedup, and prune **autonomously**
(T1/T2). Turning a `proposed` idea into a `/project-plan` requires the supervisor's explicit `outcome: accept` — and
**no-response is not approval**. `autonomy-gate.mjs` is the backstop.

## Subcommands (how to act)

Each edits `nuc-platform/10-idea-queue.md`. Keep blocks in the file's schema; keep scores coarse (ordinal hints).

- **`/idea add "<title>"`** — capture to `state: inbox`. Immediately run the **dedup check** (title + semantic match vs
  every `active`/`deferred` block). Match → set `dedup_of: <id>`, leave `inbox`, and **flag the supervisor** to decide
  (re-analyze jointly vs drop) — never silently merge.
- **`/idea gate <id>`** (or run inline on add) — feasibility+fit gate FIRST: set `moscow:` + judge "does it fit the
  system / invariants?". `pass` → `active`. `wont`/no-fit-no-reshape → `deferred` (maybe-later) or `dead` (+ tombstone reason).
- **`/idea sort`** — the **post-feature cadence**: (1) re-score + re-rank the `active` set (`rank = base×(1+0.15×interest)`,
  interest capped 15%, gate is absolute); (2) enforce the WIP cap (`active` ≤ 5 → defer the lowest); (3) optionally run
  **gap-analysis (C1 Proposer):** propose new `inbox` ideas, but **ground each in an EXTERNAL standard** (INVENTORY drift,
  missing test coverage, a documented gap, prior-art) — NOT the agent's opinion (intrinsic self-assessment is unreliable;
  see proposal §Prior art). Surface new ideas to the supervisor; don't self-promote them past `inbox`.
- **`/idea analyze`** — deep-dive the **top-1** `active` idea only (not the whole queue — wasted tokens). Apply
  `/honest-critique` + the proposal template's Counter-case/Pre-mortem. Write `proposal.md` (via the proposal flow:
  brainstorm → `templates/proposal.md` with ≥2 external sources + ≥2 options). Set the idea `state: proposed`, link `proposal:`.
- **`/idea pushback <id>`** — when an idea is biased (rests on a misunderstanding of the system), infeasible, or doesn't
  fit: write `pushback:` with the reasoning **and propose a better-fit alternative idea**; surface both, let the
  supervisor choose. This is the core of "don't let the agent tự biên tự diễn" — challenge, don't comply blindly.
- **`/idea outcome <id> accept|reject "<why>"`** — record the supervisor's **oracle** signal in `outcome:`. On `accept`
  → hand to `/project-plan` (the idea graduates to a `docs/plans/` or `nuc-platform/plans/` roadmap), set `done` when shipped.
  On `reject` → `deferred` (with `revisit_when`) or `dead`. The `why` accumulates as Reflexion memory that biases future
  gap-analysis away from rejected patterns.
- **`/idea defer <id> [when]` · `/idea kill <id> "<reason>"` · `/idea revive <id>`** — lifecycle moves. `kill` = move the
  block to the **Tombstones** section with its reason (never delete — so we don't re-litigate). Prune to `dead` a
  `deferred` idea that has failed re-scoring twice or is fundamentally unfit.

## When to fire

- The supervisor raises an idea / asks "what next" / "re-sort" / "analyze the top one."
- **After a big feature ships** (e.g. at `/session-wrap`): run `/idea sort` — re-rank + a grounded gap-analysis pass, then
  surface the new top-1 for the supervisor to greenlight before deep analysis.
- Capturing something for later mid-task (so it isn't lost) → `/idea add`, stay `inbox`, move on.

## Scope discipline (the counter-case, honored)

For a solo operator the full machinery can become overhead. Keep this skill **thin**: coarse scores, short blocks, no
ceremony beyond what earns its keep. If the queue goes unused or the ritual costs more attention than the ideas are
worth, say so and cut it — don't let it rot into a graveyard (WIP cap + cadenced re-score + dead-pruning are the guards).
