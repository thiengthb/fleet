---
title: <one line — what this plan delivers>
kind: feature # feature | system-change | fix | refactor | chore — feature/system-change REQUIRE Prior art before `active`
status: draft # draft → active → done | abandoned
created: YYYY-MM-DD
updated: YYYY-MM-DD
related: [] # file.ts · INVENTORY §n · docs/plans/<prior>.md
---

<!--
  A PERSISTED, multi-session plan. Forward-looking counterpart to docs/decisions.md.
  Standard: nuc-platform/05-documentation-standard.md §5.5. Maintained by the /project-plan skill.
  Keep it token-cheap (tables + bullets + checklist, not prose). Keep the checklist in sync as you execute.
-->

## Goal

One sentence: what "done" looks like (the observable outcome).

## Context

Why now, the constraints, what triggered it. 1–3 lines.

## Prior art & sources

<!-- kind: feature | system-change ⇒ REQUIRED before flipping status: active — ≥2 external URLs (research-before-design,
     anti-bias). Omit this section for fix/refactor/chore plans. The prior-art-check.mjs hook nudges if it's missing. -->

- [Source 1](url) — what we learn / can reuse · what to avoid
- [Source 2](url) — ...

## Approach & tradeoffs

The chosen approach + **≥2 options ruled out and why** (brief — the durable "why" is distilled to `decisions.md` at the end).

## Acceptance criteria (Given / When / Then)

<!-- The spec→test bridge (SDD-lite, standard 11). REQUIRED for kind: feature | system-change; omit for fix/chore/small
     same-session changes. Rule: 1 AC → 1 named test; each Step's `Test:` references the AC id it satisfies. Format is
     implementation-agnostic + observable. See nuc-platform/11-testing-standard.md §3. -->

- **AC-1** — Given `<context>`, When `<action>`, Then `<observable outcome>`.
- **AC-2** — ...

## Steps

- [ ] Step 1 — <action> · Files: Create/Modify `path:line` · Test: `AC-1 (<how verified>)`
- [ ] Step 2 — ... (one line each; check off as you go, across sessions)

## Out of scope

Explicit non-goals, so a later session doesn't scope-creep.

## Open questions / risks

Things still unknown or risky (cap at ~3). Strike through as they close.

## Decisions to distill

Non-obvious knowledge that should land in `docs/decisions.md` when this plan completes (handed off by `/session-wrap`):

- ...
