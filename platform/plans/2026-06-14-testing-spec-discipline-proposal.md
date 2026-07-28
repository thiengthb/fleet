---
title: Testing & spec discipline — tiered SDD-lite + evidence-based selective TDD + contract testing (platform standard)
kind: system-change # feature | system-change — both REQUIRE prior-art before acceptance
status: accepted # accepted 2026-06-14 — Option A + fold idea-0006 (E2E top tier); graduates to a /project-plan build
created: 2026-06-14
updated: 2026-06-14
related:
  [
    platform/10-idea-queue.md (idea-0010 — the candidate this analyzes; the overdue exploration-floor wildcard),
    platform/10-idea-queue.md (idea-0006 — Playwright E2E, deferred; this standard positions it as the pyramid's top tier),
    .claude/skills/idea/SKILL.md (/idea → proposal → /project-plan = the proto-SDD spine this extends),
    .claude/skills/project-plan/templates/proposal.md (the "specify" artifact that will carry acceptance criteria),
    .claude/skills/vitest-server-actions/SKILL.md (existing test-ROI ladder + CI gate this builds on),
    .claude/skills/playwright-e2e-builder/SKILL.md (E2E top tier),
    .claude/skills/verification-before-completion/SKILL.md (the existing end-gate guardrail),
    platform/05-documentation-standard.md (where the spec/AC convention lands),
    platform/08-SHARED-ASSETS.md (cross-repo test templates + contract-test glue),
  ]
---

<!--
  RESEARCH-GROUNDED proposal (research-before-design / anti-bias). Produced by `/idea analyze` on idea-0010.
  Propose-don't-execute: queued for the HUMAN-ACCEPT gate (/idea → /project-plan). The agent does NOT self-accept;
  status stays `draft` until the supervisor records `outcome: accept`. Sources verified 2026-06-14.
-->

## Problem

A repo soát (2026-06-14) of the platform's actual process found a **lopsided** quality posture:

| Capability | State today | Evidence in-repo |
| --- | --- | --- |
| **Tests as an automated guardrail** | ✅ Solid | CI `build: needs: test` (a red test blocks deploy); `/verification-before-completion` Iron Law ("no completion claim without fresh test output"); 98 tests live (todo 57 + journal 21 + yakudoku 20), all CI-green |
| **TDD (test-FIRST, red→green)** | ❌ Effectively absent | No skill/rule mandates writing a failing test first. Practice is *test-alongside* + verify-before-done. The guard sits at the **end gate**, not at the **start of each unit** |
| **Spec-Driven Development (spec → tests → code)** | 🟡 Partial / implicit | The `/idea → proposal → /project-plan` spine is a *proto-SDD* (proposal ≈ "specify", plan ≈ "plan+tasks"), and web apps carry `01-product`/`02-technical`. But there is **no structured acceptance-criteria layer that maps 1:1 to tests** — plan steps carry a free-text `Test:` field, not a spec-anchored contract |
| **Cross-repo / multi-team correctness** | ❌ Unguarded | Independent repos already call each other over HTTP (todo↔core patterns, yakudoku web↔core, MCP servers). Nothing verifies the two sides still agree on the contract — today only a human notices a break |

**The external driver that changes the calculus:** the supervisor states the platform, skills, and patterns will be
**expanded to many people and many machines**. Until now the honest counter-case was "solo operator → skip ceremony"
(`user-profile` leans away from ceremony). A multi-user / multi-repo future *weakens that counter-case precisely where
TDD/SDD/contract-testing earn their keep* — many contributors not making conflicting assumptions, specs not drifting,
independent services not silently breaking each other. This proposal designs for that future **without** importing
ceremony that a 1-person-now team would resent.

## Prior art & sources — REQUIRED: ≥2 external URLs (research BEFORE designing; all VERIFIED 2026-06-14)

- [Nagappan, Maximilien, Bhat, Williams 2008, *Realizing quality improvement through TDD: results and experiences of
  four industrial teams*, Empirical Software Engineering 13(3) — ACM/Springer](https://dl.acm.org/doi/abs/10.1007/s10664-008-9062-z)
  ([Microsoft Research PDF](https://www.microsoft.com/en-us/research/wp-content/uploads/2009/10/Realizing-Quality-Improvement-Through-Test-Driven-Development-Results-and-Experiences-of-Four-Industrial-Teams-nagappan_tdd.pdf)).
  **Reuse:** the canonical industrial evidence — 3 Microsoft teams + 1 IBM team saw **pre-release defect density fall
  40–90%** vs comparable non-TDD teams, at a **15–35% increase in initial development time**. This is the load-bearing
  case for TDD *where defect cost is high*. **Avoid / honest caveat:** the time cost is real and the effect is biggest on
  logic-dense code; later meta-analyses (e.g. *Effects of TDD: A Comparative Analysis of Empirical Studies*,
  [Springer](https://link.springer.com/chapter/10.1007/978-3-319-03602-1_10)) caution that much of TDD's benefit may come
  from *writing more tests*, not the test-first ritual per se — so mandate test-first only where its ROI is clearest, not
  everywhere.
- [GitHub Spec Kit — *A Guide to Spec-Driven AI Development*, IntuitionLabs (Oct 2025)](https://intuitionlabs.ai/articles/spec-driven-development-spec-kit)
  (verified by fetch). **Reuse:** the **specify → plan → tasks → implement** loop, with the spec as a **version-controlled
  living source of truth** ("a clear spec aligns everyone; different developers might make conflicting assumptions") — the
  "specify" phase outputs *user stories + acceptance criteria + success metrics*. This is the agent-native shape of what
  our `/idea → proposal → /project-plan` spine already half-does. **Avoid:** Fowler's own caveat (quoted in the guide) —
  "SDD is best suited to larger features and greenfield projects; small bug fixes may not warrant the overhead." So gate
  the spec layer by change size, don't apply it to every fix.
- [Amazon Kiro — agentic IDE with native spec-driven workflow (Requirements → Design → Tasks before code), mid-2025](https://www.augmentcode.com/tools/best-spec-driven-development-tools).
  **Reuse:** independent industry validation that the *requirements-before-code, agent-executed* pattern is becoming the
  norm for AI-built software — directly relevant to a platform whose code is written by an agent (Claude Code) and will be
  by many agents/machines. **Avoid:** it's a whole new IDE/tool; we extend our spine instead of adopting a parallel tool.
- [*How to Write Effective Gherkin Acceptance Criteria* (TestQuality)](https://testquality.com/how-to-write-effective-gherkin-acceptance-criteria/)
  + [*When to Use Given-When-Then* (Ranorex)](https://www.ranorex.com/blog/given-when-then-tests/). **Reuse:** the
  **Given / When / Then** acceptance-criteria format — testable, implementation-agnostic, readable by non-coders, and it
  maps **1 AC → 1 test**. This is the missing bridge that turns a spec into the test suite (the SDD→TDD seam). **Avoid:**
  full Cucumber/Gherkin tooling is overkill — borrow the *format* as a convention in the proposal/plan, not a parser/runner.
- [*Contract Testing for Microservices* (Pactflow / Pact)](https://pactflow.io/blog/what-is-contract-testing/)
  + [*From Monoliths to Microservices: Rethinking the Test Pyramid* (DEV)](https://dev.to/rubemfsv/from-monoliths-to-microservices-rethinking-the-test-pyramid-441).
  **Reuse:** **consumer-driven contract testing** — the consumer declares what it expects of a provider's API; both sides
  test against the shared contract — is the standard guard for **independent repos / teams** that talk over HTTP, exactly
  our todo↔core / web↔core / MCP topology. It rebalances the test pyramid away from slow, brittle cross-service E2E.
  **Avoid:** a full Pact Broker is infra we don't need at N=1 team — start with plain consumer-side contract fixtures,
  add a broker only when ≥2 independent teams own the two sides.

## Options considered — REQUIRED: ≥2, with tradeoffs

Mark the recommended option with **`(khuyến nghị)`** right in the table.

| Option | How it works | Benefit | Drawback / cost |
| --- | --- | --- | --- |
| **A — Tiered SDD-lite + evidence-based selective TDD + contract testing, by EXTENDING the existing spine** *(khuyến nghị)* | (1) **Spec layer:** add a structured **acceptance-criteria (Given/When/Then)** block to the existing proposal/plan template — the proposal IS the "specify" phase; 1 AC → 1 test. (2) **Test discipline, tiered:** *test-first (TDD) REQUIRED only for pure-logic units* (`lib/*.ts` rule engines — no I/O, deterministic), where Nagappan's defect-↓ is biggest and the time-cost smallest; *test-alongside* (current practice) for server actions/components; *consumer-driven contract tests* for cross-repo HTTP seams; *Playwright E2E* sparse at the top (folds idea-0006). (3) **One platform standard** in `05-documentation-standard` + a thin `/testing-standard` skill; CI templates already exist (vitest + e2e), add an AC→test convention + a contract-test template to `08-SHARED-ASSETS`. | Reuses the spine + skills the platform already runs (extend-don't-rebuild). Evidence-calibrated: TDD where it pays, not a blanket tax. ACs give agents (the actual code authors, now & multi-machine) an unambiguous target — agent-native. Contract tests guard the real multi-team failure mode. Scales: a new person/repo inherits one documented standard + templates. | A new convention to keep coherent (AC↔test traceability); the "what counts as pure logic" line needs a crisp definition; contract testing is a genuinely new technique to learn (mitigated: start fixtures-only). |
| **B — Full Spec-Driven Development adoption (GitHub Spec-Kit / Kiro-style), formal specify/plan/tasks/implement via a dedicated tool** | Adopt Spec Kit (or equivalent) as a parallel, tool-enforced SDD workflow alongside the current spine. | Maximal rigor + the strongest agent-native spec→code traceability; industry-standard tooling; strongest for large greenfield. | **Parallel system → drift** vs the existing `/idea → proposal → /project-plan` spine (directly violates extend-don't-rebuild — the user's standing preference). Fowler's caveat: overhead not worth it for small changes; heavy for a team that is 1 person *today*. New external dependency + a second source of truth. |
| **C — Blanket TDD mandate (red-green for everything), no spec-layer change** | A single rule: every change writes a failing test first. Leave proposals/plans as-is; ignore cross-repo. | Simplest rule to state; uniform. | The 15–35% time cost applied to *everything* (incl. UI/glue where TDD's ROI is weakest); no spec→test traceability (doesn't address SDD at all); **does nothing for the actual multi-team risk** (cross-repo contract breaks). Weakest on the very axis — multi-user/multi-repo — the supervisor named. |

## Recommendation

**Adopt Option A** *(khuyến nghị)*.

In plain terms: **don't bolt on a second process or tax every change with test-first — instead grow the spine we already
have into a tiered standard that puts each kind of testing exactly where it earns its keep.** Acceptance criteria turn our
proposals into specs an agent (me, and the many agents/machines to come) can build against unambiguously; test-first is
required only for the deterministic logic where the evidence says it pays the most and costs the least; contract tests
guard the cross-repo seams that are *the* multi-team failure mode; E2E stays sparse at the top.

- **Why not B:** it stands up a parallel SDD tool beside the spine we already run — the exact "parallel system" drift the
  supervisor consistently rejects ([[extend-dont-rebuild]]), and Fowler himself warns the overhead isn't worth it below
  large/greenfield work. We get ~80% of B's value by extending the spine, with none of the second-source-of-truth cost.
- **Why not C:** a blanket red-green mandate spends the 15–35% time cost everywhere — including UI/glue where TDD's payoff
  is weakest — gives no spec→test traceability, and *ignores the cross-repo contract risk entirely*, which is precisely the
  failure mode a multi-user/multi-repo future introduces.
- **Multi-user calibration (the new signal):** the `user-profile` "lean away from ceremony (solo)" prior is **explicitly
  overridden by the supervisor's multi-user/multi-machine direction** for the parts that serve coordination (acceptance
  criteria, contract tests). A is the design that adds *only* that coordination value and refuses the rest of the ceremony.
- **Scope-coupling flags for the supervisor (surfaced, not silently merged):**
  - **idea-0006 (Playwright E2E)** is no longer a standalone idea — it becomes the **top tier of this standard's pyramid**.
    Recommend folding idea-0006 into this proposal's build (like the idea-0002→Phase-3 fold).
  - This idea is the **overdue exploration-floor wildcard** (the queue had drained to all-platform-internal ideas); it is
    orthogonal (quality engineering), so it is ranked on `base` only, interest term skipped — flagged per the rules.

## Pre-mortem — REQUIRED: ≥2 failure modes

- **Acceptance criteria rot into box-ticking nobody reads.** Mitigation: ACs live *inside the proposal/plan that already
  must exist* (no new doc), and the rule is **1 AC → 1 named test** — an AC with no test is a visible gap, not prose. If a
  change is too small to warrant a spec (Fowler's caveat), it's exempt (`kind: fix/chore`).
- **The "pure logic ⇒ TDD required" line is fuzzy and gets argued every time.** Mitigation: define it crisply in the
  standard — *pure logic = a function with no I/O, deterministic, output is a function of inputs only* (e.g.
  `lib/streak.ts`, `dates.ts`, `capacity.ts`, `priority.ts`). Touches DB/network/filesystem/UI ⇒ test-alongside, not TDD.
- **Contract testing infra (Pact Broker) is heavy and stalls adoption.** Mitigation: phase it — start with plain
  consumer-side contract *fixtures* checked into the consumer repo + a CI check; defer a broker until ≥2 independent teams
  own the two sides of a seam (revisit trigger, not now).
- **The standard is written but the agent/contributors don't follow it.** Mitigation: bind it to the gates that already
  fire — `verification-before-completion` already blocks "done" without test output; extend the `/project-plan` step
  convention so a step's `Test:` references its AC; the pre-commit hook already nudges on docs. No new enforcement engine.
- **TDD time-cost resentment from a solo operator now.** Mitigation: the mandate is scoped to pure logic only (smallest
  surface, lowest cost, highest defect-↓); everything else keeps today's lighter test-alongside.

## Counter-case

The cheapest honest version may be **"do almost nothing yet"**: the platform already has the end-gate guardrail (CI +
verification-before-completion) and 98 passing tests; the multi-user future is *stated, not present*. A YAGNI reading says
add **only** consumer-driven contract tests when a cross-repo break first actually bites, and introduce acceptance criteria
the day a second contributor joins — because a standard written for a team that doesn't exist yet is the very "ceremony for
a solo operator" the user-profile warns against, and it risks rotting unused before anyone needs it. (Option A answers this
by being *tiered and trigger-gated* — but the supervisor should weigh whether even A's spec/contract layer should wait for
the first real multi-user trigger rather than land now.)

## Decision (human) — the human-accept gate

> **This is the human-accept gate of `/idea` → `/project-plan` (propose-don't-execute).** The agent has stopped here and
> does NOT self-accept. Your call decides what happens next:
> - **accept** (which option) → it graduates to a `/project-plan` build roadmap (next session/step), and idea-0010 → `done`.
> - **reject** (reason) → idea-0010 → `dead`/`deferred`; the *why* becomes Reflexion signal that biases future proposals.
> - **defer** (until a trigger, e.g. "when the 2nd contributor joins") → idea-0010 → `deferred` with `revisit_when`.
>
> Also pending your call: should **idea-0006 (Playwright E2E)** be folded into this build as the pyramid's top tier?

**ACCEPTED 2026-06-14 — Option A** *(khuyến nghị)*. Supervisor: "theo những gì bạn khuyến nghị". **idea-0006 (Playwright
E2E) folded in** as the pyramid's top tier. Graduates → build plan `plans/2026-06-14-testing-spec-discipline-build.md`.
*Reflexion bias:* supervisor accepts the extend-the-spine, evidence-tiered shape over both a parallel SDD tool (B) and a
blanket-TDD mandate (C); the multi-user future overrides the solo anti-ceremony prior for coordination value (AC + contract tests).
