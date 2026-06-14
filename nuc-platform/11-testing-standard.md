# 11 — Testing & Spec Standard (platform-wide)

> The platform's **single testing & specification standard** — what to test, where, test-first or not, and how a spec
> becomes a test. Managed via skill **`/testing-standard`** (the router) + the existing `/vitest-server-actions`,
> `/playwright-e2e-builder`, `/coding-convention` skills. Design + evidence + ruled-out options:
> `plans/2026-06-14-testing-spec-discipline-proposal.md`. This doc is the *standard*; the skills are the *how-to*.
>
> **Why this exists:** the platform already had tests-as-a-guardrail (CI `build: needs: test` + `/verification-before-
> completion`), but no test-*first* discipline, no spec→test bridge, and nothing guarding cross-repo contracts. As the
> platform expands to **many people + many machines/repos**, those gaps become coordination failures. This standard adds
> *only* the coordination value (acceptance criteria + contract tests) and refuses blanket ceremony — it is **tiered and
> trigger-gated**, not "TDD everything".

## 0 — The one-paragraph version

Write **acceptance criteria** (Given/When/Then) for any non-trivial change *in the proposal/plan you already write*, one
criterion mapping to one test. Then test by **tier**: **test-first (TDD)** for pure logic, **test-alongside** for server
actions/components, **consumer-driven contract tests** for cross-repo HTTP seams, **Playwright E2E** sparingly at the top.
The CI test job and `/verification-before-completion` are the gates that make tests a guardrail, not a suggestion.

## 1 — The test pyramid (which tier for what)

Spend most effort at the base (cheap, fast, deterministic); least at the top (slow, brittle). Each tier names the
technique and the skill that owns its how-to.

| Tier (base→top) | What it covers | Test-first? | Technique / skill |
| --- | --- | --- | --- |
| **Pure logic** | Deterministic functions, no I/O (rule engines: `lib/streak.ts`, `dates.ts`, `capacity.ts`, `priority.ts`) | **YES — TDD required** | Vitest unit tests · `/vitest-server-actions` §1 |
| **Server actions / data layer** | Actions that validate + call Prisma + revalidate; Zod boundaries | No — test-alongside | Vitest + mocked Prisma/`next/cache` · `/vitest-server-actions` §2 |
| **Components** | UI behaviour a user observes (only where logic lives) | No — test-alongside | React Testing Library · `/vitest-server-actions` §3 |
| **Cross-repo HTTP seams** | One repo calling another's API (todo↔core, web↔core, MCP) | No — write the contract | **Consumer-driven contract tests** (§4) · `08-SHARED-ASSETS` template |
| **End-to-end (user flows)** | Critical multi-step journeys, sparse | No | Playwright · `/playwright-e2e-builder` (idea-0006 = this top tier) |

**Do NOT** chase a coverage %, test framework internals, or assert on a value you mocked yourself (carried from
`/vitest-server-actions`). A test worth keeping fails only when behaviour you meant to keep actually breaks.

## 2 — Test-first (TDD), but ONLY for pure logic

Evidence (Nagappan et al. 2008, 4 industrial teams): test-first cuts pre-release defect density **40–90%** but adds
**15–35%** to initial dev time — and the benefit concentrates in logic-dense code. So the platform mandates TDD **only
where the ROI is highest and the cost lowest**: pure logic.

**Pure logic = a function with NO I/O, deterministic, whose output is a function of its inputs only** (no DB, network,
filesystem, clock, randomness, UI). For these, write the failing test first → make it pass → refactor (red→green→refactor).

Anything that touches I/O (DB/network/fs/clock/UI) ⇒ **test-alongside** is enough (write the test in the same change, not
necessarily first). This is the platform's existing practice, kept.

> Retrofit rule: don't churn already-green code to add a test-first test. Apply TDD on the **next change** to a pure-logic
> unit, not as a backfill sweep.

## 3 — Acceptance criteria: the spec→test bridge (SDD-lite)

The platform's `/idea → proposal → /project-plan` spine is already a proto-spec. This standard adds the missing structured
layer **without a parallel tool** (no Spec-Kit/Kiro): write acceptance criteria *in the proposal/plan you already author*.

- **Format: Given / When / Then.** `Given <context>, When <action>, Then <observable outcome>`. Implementation-agnostic,
  readable by a non-coder, and each one is directly testable.
- **Rule: 1 acceptance criterion → 1 named test.** An AC with no test is a visible gap, not prose. A plan step's `Test:`
  field references the AC id it satisfies (e.g. `Test: AC-3 (streak grace day)`).
- **Gate by change size** (Fowler's caveat): a `feature`/`system-change` writes ACs; a `fix`/`chore`/small same-session
  change is exempt — don't spec a typo fix.
- ACs live in the proposal/plan templates (`/project-plan templates/`), so there is **no new artifact** to keep coherent.

## 4 — Cross-repo contract testing (the multi-team guard)

Independent repos already call each other over HTTP (todo↔core patterns, web↔core, MCP servers). Nothing today verifies the
two sides still agree — only a human notices a break. As repos/teams multiply this is *the* failure mode.

- **Consumer-driven contract testing:** the **consumer** declares what it expects of a provider's API (shape, fields,
  status codes) as a contract; both sides test against it. A provider change that breaks the contract fails CI, not prod.
- **Start fixtures-first (no broker):** a plain contract fixture checked into the consumer repo + a CI check that the
  provider honours it. This is enough for one team owning both sides.
- **Defer a Pact Broker** until **≥2 independent teams** own the two sides of a seam (revisit trigger — not now). Template
  + how-to: `08-SHARED-ASSETS.md` (contract-test template).

## 5 — The gates that make tests a guardrail (already in place — reused, not rebuilt)

- **CI test job before build:** `build: needs: test` in `deploy.yml` — a red test blocks the image build/deploy. The NUC
  still only PULLs (tests run in GitHub Actions). Template: `/vitest-server-actions` §CI.
- **`/verification-before-completion`:** no "done"/"passing" claim without fresh test output pasted. The Iron Law already
  enforces "evidence before claims".
- **`/project-plan` step `Test:` → AC id:** ties each executable step back to the spec it satisfies.
- **pre-commit hook:** nudges (non-blocking) when code changes without docs/tests.

## 6 — Scaling to many people + many machines/repos

- A new contributor inherits **one doc (this) + the templates + the skills** — no tribal knowledge.
- A new repo copies the CI test job (`/vitest-server-actions` §CI) + the contract-test template (`08`) on onboarding
  (`/nuc-new-project`).
- ACs make a change **legible across people**: a reviewer reads the Given/When/Then, not the author's assumptions
  (Spec-Kit's "a clear spec aligns everyone; different developers make conflicting assumptions").

## 7 — What is explicitly NOT required (anti-ceremony guards)

- No ACs for fixes/chores/small same-session changes.
- No test-first outside pure logic.
- No coverage-percentage target.
- No Pact Broker / heavy contract infra under one team.
- No backfill sweeps (retrofit on next touch).

> The litmus: this standard should make a multi-person/multi-repo platform *safer to change*, never make a solo change
> *slower for ceremony's sake*. If a rule here is costing more than it protects at the current scale, flag it (the same
> counter-case the proposal carries) — trigger-gate it, don't blanket it.
