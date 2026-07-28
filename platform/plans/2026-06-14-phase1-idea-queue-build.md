---
title: Build — idea-queue + /idea skill (Phase 1, accepted)
status: done
created: 2026-06-14
updated: 2026-06-14
related:
  - platform/plans/2026-06-14-phase1-idea-queue-proposal.md
  - platform/registries/idea-queue.md
  - .claude/skills/idea/SKILL.md
---

> **CLOSED 2026-07-28.** Both remaining boxes were "dogfood it" and "optionally wire the cadence into `/session-wrap`".
> The first happened by use — the queue is the most-exercised skill on the platform (11 `/idea` references across the
> day-log, more than any other). The second was never requested and is still not; if it is ever wanted it is a
> one-line change, not a plan. Keeping a plan open to hold two optional items is how the plan clock loses meaning.


## Goal
The accepted Phase 1 idea-queue is live: a maintained `registries/idea-queue.md`, a working `/idea` skill, and CLAUDE.md pointers
— the autonomy Layer C front door, propose-don't-execute. Design/why lives in the proposal; this file is execution state only.

## Steps
- [x] Create `platform/registries/idea-queue.md` — header (rules: gate-first, RICE, 15% interest cap, WIP≤5, oracle, dedup, prune) + seeded with 8 real in-flight ideas.
- [x] Create `.claude/skills/idea/SKILL.md` — lean; subcommands add/gate/sort/analyze/pushback/outcome/defer/kill/revive; propose-don't-execute invariant; anti-overlap with 07/plans; scope-discipline counter-case.
- [x] CLAUDE.md pointers — `/idea` in Thinking & process flow; Layer-C front-door note in the Autonomy section.
- [x] Mark proposal `Decision: ACCEPTED`; update parent `2026-06-14-agent-os-evolution.md` (Phase 1 → shipped).
- [ ] (Next session) Dogfood: run `/idea sort` after the next big feature; confirm the cadence + pushback feel right; tune WIP cap / interest weight if needed.
- [ ] (Deferred) Optionally wire the `/idea sort` cadence into `/session-wrap` as a reminder — supervisor didn't request it; revisit after dogfooding.

## Out of scope
Phase 2 interest model (idea-0001), Phase 3 day-log (idea-0003), Phase 4 token-batching (idea-0005), RAG build (idea-0002) — all queued, not built here.

## Decisions to distill (→ decisions.md / ledger at session-wrap)
- The platform now has a 3-layer planning spine: `/idea` (candidate backlog) → `/brainstorming`+proposal (analyze top-1) → `/project-plan` (accepted roadmap). Don't conflate the three.
- `registries/idea-queue.md` is platform-native ideas; `registries/skill-candidates.md` stays external-skill verdicts. Separate axes.
- Self-critique on ideas MUST anchor to the supervisor's accept/reject oracle (Reflexion) — never a closed self-scoring loop (intrinsic self-correction degrades: Huang 2310.01798 / CRITIC / Reflexion).
- Interest is a capped (≤15%) Delighter-tier bonus applied AFTER the feasibility gate — never a primary sort key.
