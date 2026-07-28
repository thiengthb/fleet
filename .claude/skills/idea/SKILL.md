---
name: idea
description: Manage the platform's living idea backlog in platform/registries/idea-queue.md — capture, gate+score+rank, re-sort after each big feature, deep-analyze the top idea into a proposal, push back on biased/infeasible/duplicate ideas, and prune the dead. Use when the user says "add an idea / what should we build next / re-sort the queue / analyze the top idea", after a feature ships, or when capturing something for later. Propose-don't-execute: a human accepts before an idea becomes a plan.
---

# Skill: Idea queue & lifecycle (idea)

The **intake half** of the Knowledge OS: `/brainstorming` explores one idea's solution space, `/project-plan` persists
an *accepted* plan — this skill owns everything *before* acceptance: the living backlog of platform-native ideas, their
ranking, and their lifecycle. It IS the autonomy roadmap's **Layer C "Proposer."** Source of truth:
`platform/registries/idea-queue.md` (the file's header carries the rules — read it first). Design + the *why*:
`plans/2026-06-14-phase1-idea-queue-proposal.md`. Contract: `standards/autonomy-contract.md` (propose-don't-execute).

> **Anti-overlap:** `registries/skill-candidates.md` = external community-skill verdicts (NOT here). `docs/plans/` = *accepted*
> forward roadmaps. This queue = *candidate* ideas not yet accepted. An idea graduates: queue → (human accept) → plan.

## The one invariant

**Propose, don't execute.** The agent may capture, gate, score, rank, push back, dedup, and prune **autonomously**
(T1/T2). Turning a `proposed` idea into a `/project-plan` requires the supervisor's explicit `outcome: accept` — and
**no-response is not approval**. `autonomy-gate.mjs` is the backstop.

**Name the gate (mandatory).** Whenever you put a `proposed` idea in front of the user for a yes/no, say it in plain
language: *"this is the **human-accept gate** of `/idea` → `/project-plan` (propose-don't-execute); accept ⇒ it becomes
a build plan, reject ⇒ deferred/dead."* Never silently write `outcome: accept` yourself — the user is the oracle; the
gate is theirs. (This is the rule the supervisor flagged: I had been self-accepting without naming the gate.)

## Subcommands (how to act)

Each edits `platform/registries/idea-queue.md`. Keep blocks in the file's schema; keep scores coarse (ordinal hints).

- **`/idea add "<title>"`** — capture to `state: inbox`. Immediately run the **dedup check** (title + semantic match vs
  every `active`/`deferred` block). Match → set `dedup_of: <id>`, leave `inbox`, and **flag the supervisor** to decide
  (re-analyze jointly vs drop) — never silently merge.
- **`/idea gate <id>`** (or run inline on add) — feasibility+fit gate FIRST: set `moscow:` + judge "does it fit the
  system / invariants?". `pass` → `active`. `wont`/no-fit-no-reshape → `deferred` (maybe-later) or `dead` (+ tombstone reason).
- **`/idea sort`** — the **post-feature cadence**: (1) **re-derive `interest`** for each `active` idea (see below) then
  re-score + re-rank (`rank = base×(1+0.15×interest)`, interest capped 15%, gate is absolute); (2) **surface ≥1 wildcard**
  (exploration floor — below); (3) enforce the WIP cap (`active` ≤ 5 → defer the lowest); (4) optionally run
  **gap-analysis (C1 Proposer):** propose new `inbox` ideas, but **ground each in an EXTERNAL standard** (INVENTORY drift,
  missing test coverage, a documented gap, prior-art) — NOT the agent's opinion (intrinsic self-assessment is unreliable;
  see proposal §Prior art). Surface new ideas to the supervisor; don't self-promote them past `inbox`. **"Nothing worth
  proposing" is a valid, first-class outcome** (anti-churn) — if no externally-grounded gap exists, say so and stop; never
  manufacture filler ideas to look productive.

  **Deriving `interest` (Phase 2 — never hand-type it):** compute `interest ∈ [0,1]` from human signals ONLY — (a) the
  supervisor's `outcome: accept/reject` history on *similar* past ideas (the Reflexion oracle), (b) explicit prefs in
  `.claude/memory/user-profile.md` §"Interest signals". **Confidence-weight** (Hu 2008): a single verdict nudges weakly,
  a consistent pattern more; coarse buckets (≈0.2/0.4/0.6/0.8), recency-decayed, re-derived every sort. **Forbidden:**
  deriving interest from the agent's own liking of an idea (closed-loop self-scoring degrades). Show the *why* per idea.

  **Exploration floor (anti-feedback-loop, Mansoury CIKM'20):** interest + gate compound toward the comfort zone and
  starve novel ideas across sorts — the 15% cap alone doesn't stop it. So **every sort surfaces ≥1 "wildcard"**: a
  novel / dissimilar / orthogonal-to-history idea ranked on `base` only (interest term skipped), explicitly flagged. None
  available ⇒ say so. Rationale + sources: `plans/2026-06-14-phase2-interest-model-proposal.md`.
- **`/idea analyze`** — deep-dive the **top-1** `active` idea only (not the whole queue — wasted tokens). Apply
  `/honest-critique` + the proposal template's Counter-case/Pre-mortem. Write `proposal.md` (via the proposal flow:
  brainstorm → `templates/proposal.md` with ≥2 external sources + ≥2 options). The Recommendation section **must mark the
  picked option `(khuyến nghị)`** in the options table + state why in plain language. Set the idea `state: proposed`,
  link `proposal:`, then present it at the **human-accept gate** (name it — see the invariant above); do NOT self-accept.
- **`/idea pushback <id>`** — when an idea is biased (rests on a misunderstanding of the system), infeasible, or doesn't
  fit: write `pushback:` with the reasoning **and propose a better-fit alternative idea**; surface both, let the
  supervisor choose. This is the core of "don't let the agent tự biên tự diễn" — challenge, don't comply blindly.
- **`/idea outcome <id> accept|reject "<why>"`** — record the supervisor's **oracle** signal in `outcome:`. On `accept`
  → hand to `/project-plan` (the idea graduates to a `docs/plans/` or `platform/plans/` roadmap), set `done` when shipped.
  On `reject` → `deferred` (with `revisit_when`) or `dead`. The `why` accumulates as Reflexion memory that biases future
  gap-analysis away from rejected patterns.

### Autonomous graduation (Phase 1 / S1.1 — the idea→plan bridge)

When the loop runs unattended, the scheduled wrapper detects an **accepted-but-ungraduated** idea (an `outcome: accept`
block still sitting ABOVE the `## Done` divider) and fires ONE bounded graduation batch. That batch graduates the idea
into a **`draft`** plan — it does **not** auto-execute it:

- Writes `platform/plans/<date>-<slug>.md` from `project-plan/templates/plan.md`, carrying Goal / Context / Approach /
  Prior-art forward from the proposal + the supervisor's chosen option (named in the `outcome:` line). Frontmatter is
  **`status: draft`** — a draft is a proposal, not a work order. Execution waits for the human to accept it and flip
  the plan to `active`. *(The old `auto_pilot:` flag and its signed enrol gate were removed 2026-07-28 with auto-pilot.)*
- Idempotent: if a draft/active plan already references the idea, it does not create a duplicate.
- Sets the idea **`graduated_plan: <plan path>`** and moves its block under `## Done` (so it isn't re-graduated).
- A genuine framing ambiguity (one the chosen option does not settle) is recorded in the plan's *Open questions* and
  asked directly (interactive: `AskUserQuestion` with explicit options). It never guesses, and asks at most ONE pending
  question per draft. Most accepted ideas name the chosen option and need no question. *(Before 2026-07-28 an unattended
  batch could ask via a signed Discord round-trip and park; that control plane was retired with auto-pilot.)*

This keeps **propose-don't-execute** intact through automation: an accept becomes a *draft* (proposal-grade) plan, never a
running one, until the supervisor approves enrol.
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
