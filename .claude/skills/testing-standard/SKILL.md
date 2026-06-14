---
name: testing-standard
description: Route a change to the right testing tier and spec discipline per the platform standard (nuc-platform/11-testing-standard.md). Use when deciding how to test a change, writing acceptance criteria, adding tests to a feature, or verifying cross-repo API calls. Decides test-first vs test-alongside, and which skill owns the how-to. Complements /coding-convention (naming/commits) + /vitest-server-actions + /playwright-e2e-builder (the how-to per tier).
---

# Skill: Testing & spec standard — the router

This skill is the **decision layer**: given a change, it routes you to the right *tier*, says whether to write the test
**first**, and points to the skill that owns the how-to. The *why* + the full standard live in
`nuc-platform/11-testing-standard.md` (read it once); the per-tier mechanics live in `/vitest-server-actions` and
`/playwright-e2e-builder`. This skill does **not** re-teach those — it routes.

## Step 1 — Write acceptance criteria first (for a feature / system-change)

Before testing, the change should already carry **acceptance criteria** in its `/project-plan` (or proposal): each one
`Given <context>, When <action>, Then <observable outcome>`, and **1 AC → 1 named test**. A plan step's `Test:` field
references the AC id. Small fix/chore/same-session change ⇒ skip ACs (standard §3, gate-by-size). No spec → no clear test target.

## Step 2 — Route the change to its tier

| The change is… | Tier | Test-first? | How-to |
| --- | --- | --- | --- |
| A **pure-logic** function (no I/O, deterministic, output=f(inputs)) | Pure logic | **YES — TDD: red→green→refactor** | `/vitest-server-actions` §1 |
| A **server action** / data-layer call (validate → Prisma → revalidate) | Server actions | No — test-alongside | `/vitest-server-actions` §2 |
| A **component** with user-observable behaviour | Components | No — test-alongside | `/vitest-server-actions` §3 |
| One repo **calling another repo's HTTP API** (todo↔core, web↔core, MCP) | Cross-repo seam | No — write the **contract** | Contract-test template → `templates/contract-test.example.ts` + `08-SHARED-ASSETS.md` |
| A **critical end-to-end user flow** | E2E (sparse) | No | `/playwright-e2e-builder` |

> The only **test-first mandate is pure logic** — that's where the evidence (Nagappan: defect ↓40–90%) and the lowest cost
> coincide. Everything else is test-alongside (write it in the same change). Don't chase coverage %; don't test mocks/framework internals.

## Step 3 — Confirm the gates carry it

- CI: the `test` job gates `build` (`build: needs: test`) — a red test blocks deploy.
- `/verification-before-completion`: no "done/passing" claim without fresh pasted test output.
- Cross-repo: the consumer's contract fixture is checked in + verified in CI; defer a Pact Broker until ≥2 teams own a seam.

## When to fire

- Deciding *how* to test a change / "should this be TDD?" / writing acceptance criteria.
- Adding or reviewing tests; onboarding a new repo's CI test job (`/nuc-new-project`).
- A change crosses a repo boundary over HTTP (→ contract test, the multi-team guard).

## Scope discipline

Stay a **router**, not a second copy of the how-to. If you're explaining *how* to mock Prisma or write a Playwright page
object, you're in the wrong skill — defer to `/vitest-server-actions` / `/playwright-e2e-builder`. Keep this thin.
