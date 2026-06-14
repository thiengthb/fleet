---
title: <one line — what this proposes>
kind: feature # feature | system-change — both REQUIRE prior-art before acceptance
status: draft # draft → accepted → rejected | superseded
created: YYYY-MM-DD
---

<!--
  A RESEARCH-GROUNDED proposal — the "should we, and is it the best shape?" artifact that PRECEDES a plan
  (brainstorm → proposal → /project-plan). Enforces the platform's research-before-design rule (anti-bias):
  no Recommendation until Prior art (≥2 external sources) AND Options (≥2) are filled. Propose-don't-execute —
  this is queued for HUMAN approval and never self-enters the build pipeline.
  Contract: nuc-platform/09-autonomy-contract.md · CLAUDE.md §"Autonomous agent".
-->

## Problem

One paragraph: what hurts, and why now? Ground it in an EXTERNAL standard (INVENTORY, test coverage, a doc, a
benchmark, a real incident) — NOT the agent's opinion that "this would be nice". Pure self-assessed gaps are unreliable.

## Prior art & sources — REQUIRED: ≥2 external URLs (research BEFORE designing)

- [Source 1](url) — what it does · what we learn / can reuse · what to avoid
- [Source 2](url) — ...

## Options considered — REQUIRED: ≥2, with tradeoffs

Mark the recommended option with **`(khuyến nghị)`** right in the table so the supervisor sees the pick at a glance.

| Option | Benefit | Drawback / cost |
| --- | --- | --- |
| A — ... *(khuyến nghị)* |  |  |
| B — ... |  |  |

## Recommendation

Chosen option (`(khuyến nghị)`) + one **plain-language** sentence why + one line "why not the others". (Do NOT fill this
until Prior art + Options above are populated.)

## Pre-mortem — REQUIRED: ≥2 failure modes

- If X happens, this fails because…
- If Y is wrong, this fails because…

## Counter-case

One sentence arguing AGAINST the recommendation (red-team your own proposal before handing it over).

## Decision (human) — the human-accept gate

Filled by the supervisor ONLY (never self-accepted by the agent). When presenting this, name the gate in plain language:
"accept ⇒ becomes a `/project-plan` build · reject (reason) · deferred (until …)". The agent's job ends at *present +
wait*; the yes/no is the user's.
