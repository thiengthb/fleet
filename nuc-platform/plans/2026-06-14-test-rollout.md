---
title: Test infrastructure rollout (Vitest unit/integration) across web/mono apps
status: active # draft → active → done | abandoned
created: 2026-06-14
updated: 2026-06-14 # todo (template) done — 57 tests + CI gate; journal + yakudoku next
related:
  [
    .claude/skills/vitest-server-actions,
    .claude/skills/playwright-e2e-builder,
    todo/vitest.config.ts,
    nuc-platform/plans/2026-06-13-project-compliance-sync.md,
  ]
---

<!-- The deferred "test infrastructure" item from the compliance-sync plan, now its own effort. -->

## Goal

Every web/mono app has Vitest unit/integration tests (pure logic + server actions, mock Prisma + next/cache)
with a CI `test` job gating the image build. "Done" = `npm run test` green locally + the CI `test` job blocks
`build` on failure, for todo, journal, yakudoku-web.

## Context

Tests were explicitly deferred from the compliance-sync sweep (biggest token item). Starting with **todo** (the
web-app reference) establishes the exact pattern (config, mock technique, CI job) that journal + yakudoku copy.
Skill = `/vitest-server-actions`. Playwright E2E is a separate later phase.

## Approach & tradeoffs

- **Reference-first**: todo first (its lib/* pure functions + app/actions.ts server actions are the richest target),
  then copy the setup to journal + yakudoku-web.
- **ROI order** (per the skill): pure logic first (no mocks, highest value), then server actions (mock Prisma singleton
  + next/cache + stub the clock via a partial `@/lib/dates` mock), components/E2E later.
- Verify in CI (dev machine has Node but the build/lint truth is CI); `npx prisma generate` before tests (mocked
  `@/lib/db` still imports the generated PrismaClient type).

## Steps

- [x] 1 — **todo** (template): vitest deps + `vitest.config.ts`/`vitest.setup.ts` + scripts; tests for lib `dates`,
  `streak`, `priority`, `capacity`, `velocity` + `app/actions.ts` (addTask/toggleTask/deleteTask/setEmotion/setEstimate/
  saveNote/scheduleTaskAt/addTomorrowTask/createPlan); CI `test` job, `build needs: test`. **57 tests green.**
- [ ] 2 — **journal**: copy todo's config/setup; unit-test pure logic (e.g. `lib/jobs/suggestion` Jaccard dedup, trigger
  eval) + server actions (`app/actions.ts` createEntry/updateEntry/deleteEntry — mock prisma + the embedding fail-soft
  path); CI test job. Note: pgvector raw-SQL paths can't be unit-mocked meaningfully — test the guards/branches around them.
- [ ] 3 — **yakudoku-web**: copy config/setup; unit-test the MCP/practice glue that's pure; server actions if any.
  (core/bot already have `pytest` — out of scope here.)
- [ ] 4 — close: bump each project's decisions.md if a non-obvious test trap surfaced; flip plan → done.

## Out of scope

- **Playwright E2E** (separate phase — `/playwright-e2e-builder`, adapt Authentik forward-auth / no in-app login).
- yakudoku core/bot Python tests (already have `pytest core/tests`).
- Chasing a coverage %; testing framework internals or pure pass-through actions.

## Open questions / risks

- journal's heaviest logic is in cron jobs that call Gemini — test the deterministic parts (dedup, triggers, guards),
  mock the AI calls; don't test the LLM.
- yakudoku-web's testable pure surface may be thin (most logic is in `core/` Python) — keep step 3 proportionate.

## Decisions to distill

- The exact mock pattern (Prisma singleton + next/cache + partial `@/lib/dates` clock stub) — once proven across all
  three, distill the reusable bits into the `/vitest-server-actions` skill if they diverge from the template.
