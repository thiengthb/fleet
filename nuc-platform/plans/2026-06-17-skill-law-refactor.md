---
title: Refactor heavy skills — split LAW into references/, keep SKILL.md as procedure only
kind: refactor
status: active
created: 2026-06-17
updated: 2026-06-17 # human-accepted Option B; Phase 1 audit running
related:
  - .claude/skills/coding-convention/SKILL.md
  - .claude/skills/react-ui-craft/SKILL.md
  - .claude/skills/testing-standard/SKILL.md
  - .claude/skills/skill-authoring/SKILL.md
  - CLAUDE.md
  - nuc-platform/05-documentation-standard.md
---

<!--
  Plan output of the user's request: improve "Tier 2 — .claude/rules/*.md (conditional load)".
  After honest-critique, reframed: the real problem is heavy skills carrying LAW that always
  loads when the skill auto-fires — not "missing rule tier". Solution: SKILL.md = procedure,
  references/<domain>.md = LAW (if/then). Native trigger via skill description; references
  loaded on-demand.
-->

## Goal

Every heavy skill auto-fires with a thin SKILL.md (≤ 100 lines, procedure only); LAW (if/then rules) lives in `references/<domain>.md` and is read only when the procedure step needs it. Token cost of an auto-fire drops ≥ 40 % on average without losing any rule.

## Context

The user proposed adding a new `.claude/rules/*.md` tier with conditional loading. Audit shows the actual bottleneck is different: skill `coding-convention/SKILL.md` is 9 KB, `react-ui-craft/SKILL.md` carries 5 references but the skill body still mixes LAW with workflow, and `testing-standard` has no `references/` at all. Adding a new tier without a native loader would create a third surface to drift against. Reusing the existing `references/` pattern (already proven in `react-ui-craft`) gives the same conditional-load behaviour with zero new mechanism.

## Prior art & sources

<!-- refactor → prior art recommended but not gating; we still cite the in-repo precedents. -->

- `.claude/skills/react-ui-craft/references/` — the working precedent: 5 reference files, SKILL trims to procedure + pointers
- `nuc-platform/05-documentation-standard.md §3` — three-tier context loading (INVENTORY → 00-map → docs); same shape applies inside a skill (SKILL.md → references/)
- `nuc-platform/09-autonomy-contract.md §3` — propose-don't-execute for governance; this plan honours it (Phase 5 = diff for user to commit)

## Approach & tradeoffs

**Chosen — Option B: split LAW into `references/<domain>.md` inside each heavy skill.**

Pattern:
- `SKILL.md` keeps the trigger (frontmatter `description`), the procedure (numbered steps), and pointers `→ references/<x>.md` at the step that needs that rule
- `references/<domain>.md` holds LAW only, format: bullet list of `IF <condition> → <action>` (no prose)
- Same harness behaviour the user wanted (description-triggered, file-on-demand) without inventing a new tier

**Ruled out — Option A: new `.claude/rules/*.md` tier.** Claude Code has no native loader for `.claude/rules/`; the agent would have to be told (in `CLAUDE.md`) when to read each rule, which inflates `CLAUDE.md` and creates a third drift surface vs skills. Rejected.

**Ruled out — Option C: only slim `CLAUDE.md`.** Doesn't solve the auto-fire bloat at the skill layer; the heavy skills keep loading their full LAW body every time. Useful as a *follow-up* but not the fix.

## Acceptance criteria (Given / When / Then)

<!-- kind: refactor — ACs optional but kept here because the win is measurable. -->

- **AC-1** — Given `coding-convention/SKILL.md` has been refactored, When measured, Then SKILL.md ≤ 100 lines and ≤ 40 % of its current bytes; the deleted content lives verbatim (semantically) in `references/{naming, git-commit, typescript-style, ui-rules, react-rules}.md`.
- **AC-2** — Given the refactor is complete, When the agent auto-fires `coding-convention` for a naming task, Then it reads `references/naming.md` (and only that reference) on demand; the procedure step explicitly cites the file path.
- **AC-3** — Given `testing-standard` has been refactored, When measured, Then `references/{tier-routing, acceptance-criteria}.md` exist and SKILL.md no longer duplicates their content.
- **AC-4** — Given `/skill-authoring` has been updated, When a new skill is authored with ≥ 3 LAW-shaped sections, Then the skill MUST split them into `references/`; the rule is written in `/skill-authoring/SKILL.md` and tested by re-reading the skill.
- **AC-5** — Given Phase 5 governance diffs are produced, When the user reviews them, Then no agent commit touches `CLAUDE.md`, `.claude/skills/**`, or `nuc-platform/05-*` outside the user-approved diff (autonomy contract §3).

## Steps

### Phase 1 — Audit (T1, read-only)

- [ ] Step 1.1 — Run size audit (bytes + line count) for every SKILL.md · Files: produce table in this plan under `## Audit results` · Test: AC-1 (baseline numbers exist)
- [ ] Step 1.2 — Section-classify the top 3 heaviest (coding-convention, react-ui-craft, testing-standard): tag each section LAW or PROC · Files: append to `## Audit results` · Test: AC-1 (classification ready)

### Phase 2 — Schema (T2, local edits in `/skill-authoring` only)

- [ ] Step 2.1 — Create `templates/reference-rule.md` in `/skill-authoring` with the standard frontmatter (`rule_domain`, `applies_when`, `load_priority`) and the if/then body format · Files: Create `.claude/skills/skill-authoring/templates/reference-rule.md` · Test: AC-4 (template exists, format documented)
- [ ] Step 2.2 — Update `/skill-authoring/SKILL.md`: add the rule "≥ 3 LAW-shaped sections ⇒ split into references/", add the `SKILL = procedure / references/ = LAW` mantra · Files: Modify `.claude/skills/skill-authoring/SKILL.md` · Test: AC-4 (rule present)

### Phase 3 — Refactor `/coding-convention` (T2, branch only — heaviest skill first)

- [ ] Step 3.1 — Extract `references/naming.md` from current §2 + relevant §7 (const, ===, early-return) as if/then bullets · Files: Create `.claude/skills/coding-convention/references/naming.md` · Test: AC-1 (file ≤ 80 lines, LAW only)
- [ ] Step 3.2 — Extract `references/git-commit.md` from current §1 + §8 commit-msg hook part · Files: Create `.claude/skills/coding-convention/references/git-commit.md` · Test: AC-1 (file ≤ 60 lines)
- [ ] Step 3.3 — Extract `references/typescript-style.md` from current §3 + TS bits of §7 · Files: Create `.claude/skills/coding-convention/references/typescript-style.md` · Test: AC-1 (file ≤ 50 lines)
- [ ] Step 3.4 — Extract `references/ui-rules.md` from current §5 + §4 stack table · Files: Create `.claude/skills/coding-convention/references/ui-rules.md` · Test: AC-1 (file ≤ 80 lines)
- [ ] Step 3.5 — Extract `references/react-rules.md` from current §6 · Files: Create `.claude/skills/coding-convention/references/react-rules.md` · Test: AC-1 (file ≤ 80 lines)
- [ ] Step 3.6 — Slim `coding-convention/SKILL.md` to procedure: keep description, §8 setup procedure, §10 checklist, replace each LAW section with a one-line pointer to its reference · Files: Modify `.claude/skills/coding-convention/SKILL.md` · Test: AC-1 (≤ 100 lines, ≤ 40 % bytes), AC-2 (pointers cite the file path)

### Phase 4 — Refactor `/react-ui-craft` and `/testing-standard`

- [ ] Step 4.1 — Diff `react-ui-craft/references/{architecture,components,motion,ux,security}.md` against the new `coding-convention/references/{ui-rules, react-rules}.md`; dedupe (one fact, one file) · Files: Modify whichever owns the duplicate · Test: AC-2 (no fact in two places)
- [ ] Step 4.2 — Create `testing-standard/references/tier-routing.md` (if/then: pure logic → tier 1; server action → tier 2; user flow → tier 3) · Files: Create `.claude/skills/testing-standard/references/tier-routing.md` · Test: AC-3 (file exists, if/then format)
- [ ] Step 4.3 — Create `testing-standard/references/acceptance-criteria.md` (Given/When/Then format spec) · Files: Create `.claude/skills/testing-standard/references/acceptance-criteria.md` · Test: AC-3 (file exists)
- [ ] Step 4.4 — Slim `testing-standard/SKILL.md` accordingly · Files: Modify `.claude/skills/testing-standard/SKILL.md` · Test: AC-3 (no duplication, pointers in place)

### Phase 5 — Governance updates (T3 — propose-by-diff, user commits)

- [ ] Step 5.1 — Produce a diff for `CLAUDE.md`: drop the inline naming detail (line 54-55), drop the inline UI mandatory (line 79-80), point both at the corresponding skill+reference · Files: propose diff for `CLAUDE.md` · Test: AC-5 (agent does NOT commit CLAUDE.md; user reviews)
- [ ] Step 5.2 — Produce a diff for `nuc-platform/05-documentation-standard.md`: add a section "Skill structure: SKILL.md = procedure; references/<domain>.md = LAW (if/then)" · Files: propose diff for `nuc-platform/05-documentation-standard.md` · Test: AC-5 (user reviews)
- [ ] Step 5.3 — Print all proposed diffs in chat, ask the user to commit Phase 5 in one go · Test: AC-5 (autonomy gate honoured)

### Phase 6 — Verify

- [ ] Step 6.1 — Re-measure: build a `## Audit results — after` table (SKILL.md bytes before/after, references/ total bytes, % drop on auto-fire) · Files: append to this plan · Test: AC-1 (≥ 40 % drop demonstrated)
- [ ] Step 6.2 — Smoke test: run a real "rename `getUserName` → `getUsername`" against the slimmed skill, confirm the agent reads `references/naming.md` only when the step calls for it · Test: AC-2 (on-demand load works)
- [ ] Step 6.3 — `/session-wrap`: write `decisions.md` entry "skills split LAW into references/ — why and the size win", add a one-liner to `nuc-platform/06-knowledge-ledger.md` · Test: knowledge persisted

## Out of scope

- Adding a new `.claude/rules/*.md` tier (rejected during planning — keep mechanism count low)
- Refactoring lighter skills that don't carry LAW (e.g. `/honest-critique`, `/brainstorming`, `/idea`) — they're already procedure-shaped
- Rewriting any rule's content — this is structural only; rule wording stays as-is unless it's contradicted across files (then dedupe wins)
- Touching the autonomy contract or hooks
- Adding `references/` to skills that don't trigger often or are short already (`docker-expert`, `mcp-builder`) — defer to a follow-up

## Open questions / risks

1. **Net token win unproven until Phase 6.1.** If agents *always* end up reading every reference, total cost is unchanged. Mitigation: each reference is small + topic-narrow so a single task pulls 1, not all. Decision: ship the refactor; if Phase 6.1 shows < 20 % win, file an `/idea` to revisit.
2. **Duplication risk between `coding-convention/references/ui-rules.md` and `react-ui-craft/references/components.md`.** Mitigation: Step 4.1 explicit dedupe; one canonical home per fact (UI engineering rules → react-ui-craft; basic UI mandates → coding-convention).
3. **Governance gate friction (Phase 5).** User has to manually commit `CLAUDE.md` + `05-documentation-standard.md` diffs. Mitigation: keep the diffs small and clearly annotated; print them all at once.

## Decisions to distill

To land in `docs/decisions.md` at `/session-wrap`:

- Pattern: **SKILL.md = procedure (auto-loaded); `references/<domain>.md` = LAW (on-demand).** Reason: native conditional load via existing harness, no third tier needed.
- Rejected: a separate `.claude/rules/*.md` tier — would need a rule-load catalog inside `CLAUDE.md` (inflates the always-loaded surface) and creates drift between skill and rule.
- Heuristic for new skills: ≥ 3 LAW-shaped sections ⇒ split into `references/`. Codified in `/skill-authoring`.
- Measurement: report SKILL.md bytes before/after on every refactor; target ≥ 40 % drop on auto-fire path.

---

## Audit results — before (Phase 1, 2026-06-17)

### 1.1 Skill size baseline

Top 10 SKILL.md by bytes (full table on disk via `Get-ChildItem`):

| Rank | Skill | Bytes | Lines | Has `references/`? | Kind |
|---:|---|---:|---:|:---:|---|
| 1 | `coding-convention` | 16 960 | 261 | NO | mixed (LAW-heavy) |
| 2 | `nuc-new-project` | 10 604 | 184 | NO | procedure (out of scope) |
| 3 | `nuc-protect-app` | 9 731 | 145 | NO | procedure (out of scope) |
| 4 | `nuc-remove-project` | 9 679 | 160 | NO | procedure (out of scope) |
| 5 | `auto-pilot` | 9 317 | 120 | NO | procedure (out of scope) |
| 6 | `react-ui-craft` | 8 117 | 85 | **YES (5 refs)** | already-correct shape |
| 7 | `nuc-health-audit` | 8 057 | 160 | NO | procedure (out of scope) |
| 8 | `session-wrap` | 7 598 | 107 | NO | procedure |
| 9 | `idea` | 7 561 | 83 | NO | procedure |
| 10 | `project-plan` | 7 473 | 126 | NO | procedure |
| … | `testing-standard` | 3 477 | 47 | NO | router (already thin) |

**Finding:** `coding-convention` is the **only** skill that's both heavy AND LAW-dominant. `react-ui-craft` already has the target shape (5 refs); `testing-standard` is 47-line router — refactor would be padding. **Plan scope downscaled accordingly** (see Step adjustments below).

### 1.2 Section classification — the 3 plan targets

**`coding-convention/SKILL.md` (261 lines, 16.9 KB)**

| § | Title | Tag | Notes |
|---|---|---|---|
| 1 | Git — commit & push | LAW | Conventional Commits format → references/git-commit.md |
| 2 | Naming convention | LAW | The big table → references/naming.md |
| 3 | JS/TS | LAW | ESM, TS, Prettier requirement → references/typescript-style.md |
| 4 | Frontend mandatory stack | LAW (table) | Stack table → references/ui-rules.md (or merge into react-ui-craft refs) |
| 5 | Frontend UI rules | LAW | 5 rules, no hardcoded color etc. → references/ui-rules.md |
| 6 | React best practices | LAW | server/client, hooks, state → references/react-rules.md |
| 7 | General style guides | LAW | const/===/early-return → merge into references/typescript-style.md |
| 8 | Per-repo setup (Prettier + hook) | **PROC** | KEEP in SKILL.md — actual procedure (`cp …`, `npm i …`) |
| 9 | Backend (route handlers) | LAW | NO separate Express, Prisma singleton → references/backend-rules.md |
| 10 | Final checklist | PROC | KEEP in SKILL.md — pre-commit checklist |

**Estimated split:** SKILL.md → ~80 lines (intro + §8 + §10 + pointers); 6 references/ files totalling ~250 lines (vs 240 LAW lines today). Net = roughly the same disk bytes, but only ~80 lines auto-load instead of 261 — that is the win.

**`react-ui-craft/SKILL.md` (85 lines, 8.1 KB)** — already the target shape: SKILL = decision/workflow + pointers to 5 refs. **No restructure needed.** Phase 4.1 reduces to a dedupe pass against the new `coding-convention/references/ui-rules.md` and `react-rules.md` (one fact, one home).

**`testing-standard/SKILL.md` (47 lines, 3.5 KB)** — already a router; the LAW (full standard) lives at `nuc-platform/11-testing-standard.md`. Adding `references/tier-routing.md` would just copy lines from §2 of the SKILL itself — **net negative**. Phase 4.2-4.4 **deferred unless growth forces it**; mark plan steps accordingly.

### Scope adjustment after audit

- **Phase 3 stays:** the real win.
- **Phase 4 reduced to a single dedupe step (4.1)** — drop 4.2-4.4 from this plan.
- **Phase 5 (CLAUDE.md slim) remains** — independent of the testing-standard decision.
- **Plan's AC-3 (testing-standard) marked "deferred"** — re-open if testing-standard SKILL.md grows past ~80 lines.

Plan checklist updated in the Steps section accordingly in the next batch (a step's intent change is itself a small T2 edit).

---

## Audit results — after (Phase 6.1, 2026-06-17)

### `coding-convention` — auto-fire path

| File | Before | After | Δ |
|---|---:|---:|---:|
| **SKILL.md (auto-loads)** | **16 960 B / 261 L** | **5 232 B / 93 L** | **−69.2 % bytes / −64.4 % lines** |
| references/naming.md | — | 2 853 B / 52 L | new |
| references/git-commit.md | — | 2 678 B / 61 L | new |
| references/typescript-style.md | — | 2 809 B / 81 L | new |
| references/ui-rules.md | — | 3 578 B / 53 L | new |
| references/react-rules.md | — | 3 422 B / 57 L | new |
| references/backend-rules.md | — | 2 376 B / 47 L | new |
| TOTAL on disk | 16 960 B | 22 948 B | +35.3 % (paid only on demand) |

**Conclusion:** AC-1 met (SKILL.md ≤ 40 % of baseline; we hit 30.8 %). On-disk grew because each reference adds frontmatter + cross-links + `IF/THEN` framing — that cost only materialises when the reference is actually pulled in.

### `skill-authoring` — pattern documentation

| File | Before | After | Δ |
|---|---:|---:|---:|
| SKILL.md | 4 394 B / 61 L | 5 561 B / 71 L | +26.5 % (one new principle + checklist item) |
| templates/reference-rule.md | — | new template | adds the `IF/THEN` schema |

### Grep-guard

`grep -rniE "tailwind\.config\|forwardRef\|React\.FC\|letsencrypt\|certbot\|Vault\|wrangler\|vercel deploy\|self-hosted runner" coding-convention/` → **clean**.

### Phase 4 verdict (dedupe)

`react-ui-craft/references/components.md` discusses shadcn/sonner at the engineering-craft level (compound components, RHF + Zod, focus traps). New `coding-convention/references/ui-rules.md` states the mandatory-stack LAW. **Zero literal overlap.** Correct split: `ui-rules` = LAW; `components.md` = craft. No edit needed; AC-2 dedupe risk closed.

### Steps closed by this batch

- Phase 2.1, 2.2 — done.
- Phase 3.1 → 3.7 — done (one extra reference: `backend-rules.md` for §9 of the old SKILL).
- Phase 4.1 — closed by dedupe analysis (no edit needed).
- Phase 6.1 — measurement above.
- Phase 4.2-4.4 — **deferred** per scope adjustment (audit showed `testing-standard` is already a 47-line router; splitting would be padding).
- Phase 5 — pending (next batch / next session): the diffs for `CLAUDE.md` + `nuc-platform/05-documentation-standard.md` are T3 governance; agent proposes, user commits.
