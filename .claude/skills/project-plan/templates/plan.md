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

## The ask, verbatim

<!-- REQUIRED. Paste what the user actually asked, in their words — the sentence(s) that started this, not a
     tidied summary. Quote it; translate nothing.

     WHY. Every other section below is the agent's INTERPRETATION. If the interpretation drifted at the start,
     the plan closes by checking the work against the drift and passes — the one error the whole doc set
     cannot catch. The raw ask is the only fixed point. (Transcripts already store every prompt forever, so
     this is not storage; it is the LINK between the prompt and the artefact it produced.)
     Scope that changes later goes under "Scope changes" at the bottom — never edit this block. -->

> (paste the request here)

## Goal

One sentence: what "done" looks like (the observable outcome). This is the agent's reading of the ask above —
if it says anything the ask does not, that is a scope decision and belongs in the section below.

## Context

Why now, the constraints, what triggered it. 1–3 lines.

## Prior art & sources

<!-- kind: feature | system-change ⇒ REQUIRED before flipping status: active — ≥2 external URLs (research-before-design,
     anti-bias). Omit this section for fix/refactor/chore plans. `plan-audit.mjs` reports it if it's missing. -->

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

## Before executing a batch

<!-- REQUIRED while `status: active` and any step is still unticked. Read it at the START of every working
     session on this plan — not once, when the plan was written.

     WHY IT EXISTS. fleet had rich discipline for AUTHORING a plan and none for executing one, so execution
     was improvised every time. Three independent parties ship the execute half: Superpowers ships
     `writing-plans` AND `executing-plans`; the community `agent-handoff` skill uses a strict
     plan → execute → verify handoff; `agentsatlas` an eight-command init→plan→execute→…→complete workflow.
     Source rows: `platform/plans/2026-07-31-community-harness-mining.md` C1/C2.

     WHY IT IS A BLOCK IN THIS FILE AND NOT A SKILL. The plan is the artefact the executor actually opens.
     A rule filed in a skill that nobody opens at execution time reads as coverage (ledger 2026-07-30, "A
     rule enforced at the wrong trigger reads as coverage"), and fleet already has 38 skills of which 17
     have never been invoked. Same mechanism as `## Check-in runbook` below: prose that fires on being read,
     with `plan-audit` responsible only for the section being present. -->

1. **Is the premise of this batch still true?** Re-read the step you are about to build and check it against
   the repo AS IT IS TODAY, not as the plan described it. A plan is a snapshot; the repo moved.
2. **Has it already been built?** Grep for it, and read `INVENTORY`, the project's `decisions.md` and
   `platform/proposals/` before writing anything. Researching a solved problem is the most expensive error
   available here, because nothing downstream re-tests a premise.
3. **Is every number this batch promises derived, or guessed?** If a step names a target, say where the
   number came from. A target invented one step before the measurement it demands is the same defect, one
   step earlier.
4. **Write the answers into this plan, dated — including "unchanged".** A batch that recorded nothing cannot
   later be told apart from a batch that skipped this.

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

## Scope changes

<!-- Append-only, dated. Anything this plan now does that "The ask, verbatim" did not ask for, or anything
     it asked for that we are NOT doing — with who decided and why. Leave empty if the plan still matches
     the ask; an empty section is a finding, not an oversight.

     This is what makes the closing check honest: at `/session-wrap` the plan is compared against the raw
     ask PLUS this list, so "we did something else, and here is when it was agreed" is a pass and "we did
     something else" alone is not. -->

- YYYY-MM-DD — <what changed> · decided by <user | agent> · why

## Open questions / risks

Things still unknown or risky (cap at ~3). Strike through as they close.

## Decisions to distill

Non-obvious knowledge that should land in `docs/decisions.md` when this plan completes (handed off by `/session-wrap`):

- ...
