---
title: <one line — what this plan delivers>
kind: feature # feature | system-change | fix | refactor | chore — feature/system-change REQUIRE Prior art before `active`
status: draft # draft → active → done | abandoned
created: YYYY-MM-DD
updated: YYYY-MM-DD
related: [] # file.ts · INVENTORY §n · docs/plans/<prior>.md
# --- Time-gated plans ONLY (a step that can only be answered by letting time pass). Delete otherwise.
# checkin: YYYY-MM-DD   # the date the next human/agent action is DUE — reminds at session start
# checkin_every: 7d     # roll forward by this after each check-in, if the gate is still open
# checkin_owner: user   # user | agent — who actually performs the runbook
# Setting `checkin:` REQUIRES a "## Check-in runbook" section. Enforced by .claude/hooks/plan-checkin.mjs.
---

<!--
  A PERSISTED, multi-session plan. Forward-looking counterpart to docs/decisions.md.
  Standard: platform/standards/documentation.md §5.5. Maintained by the /project-plan skill.
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

<!-- The spec→test bridge (SDD-lite, `standards/testing`). REQUIRED for kind: feature | system-change; omit for fix/chore/small
     same-session changes. Rule: 1 AC → 1 named test; each Step's `Test:` references the AC id it satisfies. Format is
     implementation-agnostic + observable. See platform/standards/testing.md §3. -->

- **AC-1** — Given `<context>`, When `<action>`, Then `<observable outcome>`.
- **AC-2** — ...

## Steps

- [ ] Step 1 — <action> · Files: Create/Modify `path:line` · Test: `AC-1 (<how verified>)`
- [ ] Step 2 — ... (one line each; check off as you go, across sessions)

## Check-in runbook

<!-- REQUIRED if and only if the frontmatter sets `checkin:`. Delete this section otherwise.
     Write it for someone with NO memory of this conversation — including you, six weeks from now.
     The test: could the reader do it without asking a single question? If not, it is not a runbook. -->

**What this gate decides** — one sentence, including what a FAILING result forbids.

1. <exact command / query to run, with the flags>
2. <what to read off the output, and the number that means "done" vs "not yet">
3. <who judges what, if a human must>
4. **Close the loop** — write the outcome into this plan under a dated heading, then either tick the
   gated step and clear `checkin:`, or roll `checkin:` forward by `checkin_every` saying what is missing.

## Out of scope

Explicit non-goals, so a later session doesn't scope-creep.

## Open questions / risks

Things still unknown or risky (cap at ~3). Strike through as they close.

## Decisions to distill

Non-obvious knowledge that should land in `docs/decisions.md` when this plan completes (handed off by `/session-wrap`):

- ...
