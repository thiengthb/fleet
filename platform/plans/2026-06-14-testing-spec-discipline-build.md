---
title: Build — testing & spec discipline (tiered SDD-lite + selective TDD + contract testing) platform standard
kind: system-change # feature | system-change | fix | refactor | chore
status: done # draft → active → done | abandoned — all 7 steps shipped 2026-06-14 (supervised); idea-0006 folded as top tier
created: 2026-06-14
updated: 2026-06-14
related:
  [
    platform/plans/2026-06-14-testing-spec-discipline-proposal.md (accepted RFC — design + sources + the why),
    platform/registries/idea-queue.md (idea-0010 done; idea-0006 folded as the top tier),
    platform/standards/documentation.md (the doc-set this plugs the testing standard into),
    .claude/skills/project-plan/templates/proposal.md (gets an acceptance-criteria block),
    .claude/skills/project-plan/templates/plan.md (gets an acceptance-criteria block + Test:→AC link),
    .claude/skills/vitest-server-actions/SKILL.md (the unit/action tier this standard routes to),
    .claude/skills/playwright-e2e-builder/SKILL.md (the E2E top tier — idea-0006),
    .claude/skills/verification-before-completion/SKILL.md (the end-gate this binds AC to),
    platform/registries/shared-assets.md (gets a consumer-driven contract-test template entry),
    CLAUDE.md (gets a thin testing-standard pointer),
  ]
---

## Goal

A single, documented **testing & spec standard** any contributor/repo inherits: acceptance criteria (Given/When/Then,
1 AC → 1 test) on the existing proposal/plan spine; **selective** test-first (TDD required only for pure logic);
consumer-driven **contract tests** for cross-repo HTTP seams; Playwright E2E sparse at the top. "Done" = the standard doc
exists, the templates carry an AC block, a thin `/testing-standard` skill routes a change to the right tier, a
contract-test template is catalogued, and CLAUDE.md points to it — all coherent with the existing CI gate +
verification-before-completion, with NO parallel tool (extend-don't-rebuild).

## Prior art & sources

Full research + the ≥2-options tradeoff live in the accepted proposal `2026-06-14-testing-spec-discipline-proposal.md`
(all sources verified 2026-06-14). Load-bearing:

- [Nagappan et al. 2008, *Realizing quality improvement through TDD* (Microsoft/IBM), EMSE 13(3)](https://dl.acm.org/doi/abs/10.1007/s10664-008-9062-z)
  — defect density ↓40–90% at +15–35% dev time ⇒ mandate test-first only where ROI is highest (pure logic).
- [GitHub Spec Kit — spec-driven development guide (IntuitionLabs, 2025)](https://intuitionlabs.ai/articles/spec-driven-development-spec-kit)
  — specify→plan→tasks→implement, spec as living source of truth; Fowler caveat: gate the spec layer by change size.
- [Given-When-Then acceptance criteria (Ranorex)](https://www.ranorex.com/blog/given-when-then-tests/) — the AC→test bridge format.
- [Contract testing for microservices (Pactflow)](https://pactflow.io/blog/what-is-contract-testing/) — consumer-driven
  contract tests as the multi-repo/multi-team guard; start fixtures-only, defer a broker.

## Approach & tradeoffs

Chosen: **Option A** — extend the `/idea→proposal→/project-plan` spine + the existing vitest/playwright skills into one
tiered standard. Ruled out: **B** a parallel SDD tool (Spec-Kit/Kiro) → drift vs the spine (extend-don't-rebuild); **C** a
blanket TDD mandate → 15–35% cost everywhere + ignores the cross-repo risk. The standard is **trigger-gated and tiered** so
it adds only the coordination value (AC + contract tests) the multi-user future needs, not blanket ceremony.

## Steps

**Batch 1 — the spine of the standard** ✅ done 2026-06-14
- [x] B1 — Write `platform/standards/testing.md`: the test pyramid + which tier for what; the crisp **"pure logic ⇒
  TDD required"** definition (no I/O, deterministic, output=f(inputs)); the **AC convention** (Given/When/Then, 1 AC→1
  named test); consumer-driven **contract testing** (fixtures-first, broker deferred to ≥2 teams); how it binds to the CI
  gate + `/verification-before-completion`; multi-user/multi-repo scaling notes. · Test: doc exists, lints, ≤ doc-set norms.
- [x] B2 — Added the **`## Acceptance criteria (Given/When/Then)`** block to `templates/plan.md` (full testable list +
  Step `Test:`→AC id) + a thin pointer in `templates/proposal.md` (decide *whether* there; spec *what* in the plan — no
  duplication). Done.

**Batch 2 — routing skill + cross-repo template** ✅ done 2026-06-14
- [x] B3 — Thin **`/testing-standard` skill** (`.claude/skills/testing-standard/SKILL.md`): a router (AC-first → tier table
  → gates), points to doc 11 + defers per-tier how-to to `/vitest-server-actions` / `/playwright-e2e-builder`. Done.
- [x] B4 — **Consumer-driven contract-test template** `.claude/skills/testing-standard/templates/contract-test.example.ts`
  (Zod-contract + consumer fixture + provider real-response verify, fixtures-first, no broker) + catalogued in `registries/shared-assets.md`. Done.

**Batch 3 — wire-in + close** ✅ done 2026-06-14
- [x] B5 — **CLAUDE.md** reference-skills line now routes testing → `/testing-standard` (+ doc 11) → vitest/playwright. Done.
- [x] B6 — idea-0006 (Playwright E2E) positioned as the documented top tier in `standards/testing` §1; suite build stays deferred to its trigger. Done.
- [x] B7 — Ledger **#57** added (tiered + spec-anchored testing); plan marked `done`. (Platform-level → ledger, not a per-project decisions.md.) Done.

## Out of scope

- Building the actual Playwright E2E suite now (idea-0006 stays deferred to its regression-risk trigger — the standard only positions it).
- Standing up a Pact Broker (deferred until ≥2 independent teams own a seam).
- Backfilling AC onto already-shipped features (the standard applies going forward; retrofit only when a feature is next touched).
- Retrofitting TDD onto existing pure-logic libs (apply on next change, don't churn green code).

## Open questions / risks

- Doc 11 vs folding into 05 — chose a new numbered doc (matches 09/10 convention; 05 stays the doc-set meta-standard). Revisit if it feels redundant.
- The `/testing-standard` skill must not duplicate vitest/playwright skills — it ROUTES, it doesn't re-teach. Watch for overlap at B3.

## Decisions to distill (at completion → ledger / decisions.md)

- The platform's testing model = a tiered pyramid: TDD for pure logic (evidence-gated), test-alongside for actions/UI, contract tests for cross-repo, E2E sparse.
- Acceptance criteria (Given/When/Then, 1 AC→1 test) live ON the existing proposal/plan spine — SDD-lite without a parallel tool.
- Contract testing chosen as the multi-repo/multi-team guard; fixtures-first, broker deferred (YAGNI under one team).
- The whole standard is trigger-gated/tiered so the multi-user future is served without blanket ceremony on a solo-now operator.
