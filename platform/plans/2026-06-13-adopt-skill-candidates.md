---
title: Adopt the recommended community skills (adapted) + fold the borrow-ideas, without breaking invariants
status: done # draft → active → done | abandoned
created: 2026-06-13
updated: 2026-06-13 # W1–W7 done — all §1 ADOPT installed (adapted), §2 BORROW folded, §1b deferred
related:
  [
    platform/registries/skill-candidates.md,
    CLAUDE.md,
    .claude/skills/,
    platform/standards/documentation.md,
  ]
---

<!--
  Platform control-plane plan. This repo's doc-home is platform/, so plans live in platform/plans/
  (the platform-repo equivalent of <project>/docs/plans/). This plan executes the ledger registries/skill-candidates.md.
-->

## Goal

Every **§1 ADOPT** skill from the ledger is installed into `.claude/skills/`, adapted so it carries NO
platform-conflicting instruction; every **§2 BORROW** idea is folded into the existing skill that owns it — with zero
regressions to existing skills, invariants, or trigger behaviour. "Done" = ledger entries flipped to ADOPTED/folded, the
conflict grep-guard is clean, and CLAUDE.md + ledger reflect reality.

## Context

The ledger (`registries/skill-candidates.md`) evaluated the community catalog (`davila7/claude-code-templates`) and produced
adopt/borrow/skip verdicts. Already built this session: `/project-plan`, `/honest-critique`, `/brainstorming`,
`/vitest-server-actions`, `/playwright-e2e-builder`. This plan executes the *remaining* recommendations. The platform
values a **thin CLAUDE.md + cheap context + no clutter**, so adoption must be selective and each skill must be adapted,
not copied.

## Approach & tradeoffs

- **Waves by value × risk**, one commit per wave, each ending with the conflict grep-guard (below). Lowest-risk /
  highest-value first (data, process discipline), script-shipping skills only after a line-by-line read.
- **Adapt, don't copy** (the `/playwright-e2e-builder` precedent): every skill is read in full, platform-conflicting
  instructions stripped or annotated, dangling `superpowers:*` refs removed, description re-scoped to avoid
  trigger-collisions, attribution kept, body kept lean (depth → `references/`, progressive disclosure).
- **Defer §1b "situational" skills** (changelog-generator, k6-load-testing, bullmq-specialist, telegram-bot-builder,
  python-testing-patterns, domain-driven-design, test-driven-development, api-patterns…). Honest call: installing a skill
  before its triggering need exists is clutter and context cost — exactly the anti-pattern the platform guards against.
  They stay in the ledger as "adopt-when-the-need-appears". **Ruled out:** bulk-installing everything now.
- **`clean-code` is folded, not installed** — a standalone clean-code skill would trigger-collide with
  `/coding-convention`. Its design-smell rules go *into* coding-convention.

### Adoption procedure — applied to EVERY skill (the no-breakage gate)

1. Fetch `SKILL.md` + the dir listing via **raw.githubusercontent.com** (the API rate-limits unauthenticated; or use `gh`).
2. **If it ships scripts** (`.sh`/`.py`/`.js`): read every line. Reject `curl|bash`, destructive cmds, exfiltration,
   obfuscation. If the script isn't essential → **drop it, keep only the SKILL.md guidance**.
3. **Strip platform conflicts** (per-skill list in the tables below) — anything that contradicts a CLAUDE.md invariant.
4. Remove dangling `superpowers:*` / external sub-skill refs.
5. Re-scope the `description` narrowly (English) so it doesn't over-trigger or collide with an existing skill; add the
   "complements X / not for Y" boundary.
6. Add an **attribution** line (`Adapted from davila7/claude-code-templates`).
7. Keep `SKILL.md` lean; push detail into `references/`.
8. **Verify** (see below). 9. Flip the ledger entry to ADOPTED. 10. Commit (Conventional Commits).

### Verification per wave (how we "ensure no errors")

- **Frontmatter check:** every new `SKILL.md` has valid `name` + `description`.
- **Conflict grep-guard** over newly added/edited skills — must return nothing:
  `tailwind.config | forwardRef | React.FC | letsencrypt | certbot | Vault | docker-compose build | wrangler | vercel deploy | self-hosted runner`
  (these are the concrete tells of an invariant violation). A hit ⇒ adapt before committing.
- **Trigger sanity:** read each description against the existing 14 skills; confirm clear ownership (table column).
- **No runtime risk** for docs-only skills (skills are passive until invoked). Script-shipping skills: the line-by-line
  read in step 2 is the gate.

## Per-skill analysis

### Wave 1 — Data layer (docs-only, no conflict, highest value)

| Skill | Mode | Conflicts to STRIP | Trigger ownership | Risk |
|---|---|---|---|---|
| `prisma-expert` | docs | Drop serverless connection-pool framing (Vercel/Lambda) — our apps are long-lived containers; note SQLite is also in use (todo/yakudoku), not only Postgres. | Prisma *implementation* (schema/migrations/queries/tx). Defers DB *design choices* to `database-design`. | Low |
| `database-design` | docs | Keep the Prisma-vs-Drizzle framing as "we use Prisma" (don't present Drizzle as an option). | DB *design thinking* (when to model/index/relate). Defers Prisma how-to to `prisma-expert`. | Low |

### Wave 2 — Process discipline

| Skill | Mode | Conflicts to STRIP | Trigger ownership | Risk |
|---|---|---|---|---|
| `systematic-debugging` | docs | none expected | Root-cause investigation. Distinct from `/verify` (runs app) + `/code-review`. | Low |
| `verification-before-completion` | docs | none | "No 'done' claim without fresh evidence" gate. Complements `/verify`; scope to the *discipline*, not running the app. | Low |
| `lint-and-validate` | **scripts** | Read `lint_runner.py` / `type_coverage.py` line-by-line. Ensure it calls only project-local tooling (eslint/tsc/ruff/mypy) — no network, no global installs. Align to our tools (eslint+Prettier+tsc; ruff/mypy for Python). | Post-edit lint/typecheck/audit loop incl. Python. Complements `/coding-convention` (Prettier-only). | Med (scripts) |

### Wave 3 — Supply-chain & dependency hygiene

| Skill | Mode | Conflicts to STRIP | Trigger ownership | Risk |
|---|---|---|---|---|
| `supply-chain-guard` | **scripts** | Read all `scripts/` line-by-line (it scans deps/CI — confirm read-only, no exfiltration of the lockfile/tokens to a remote). | npm/PyPI/GH-Actions compromise + IOC scan. Distinct from `/security-review` (code) and `/host-audit` (infra). | **Med-High (scripts)** |
| `dependabot-review` | docs | Ensure auto-merge guidance respects "commit/push only when the user asks" — make merge a *suggestion*, not automatic. | Triage Dependabot PRs. | Med (auto-merge wording) |

### Wave 4 — Worker/bot + MCP

| Skill | Mode | Conflicts to STRIP | Trigger ownership | Risk |
|---|---|---|---|---|
| `api-integration-specialist` | docs | none expected | Building robust 3rd-party API clients (OAuth2/retries/webhooks) in workers/bots. | Low |
| `async-python-patterns` | docs | none | asyncio for Python workers/bots. | Low |
| `mcp-builder` | **scripts** | Read `scripts/` line-by-line. Cross-check against the `todo`/`yakudoku` MCP pattern (self-issued OAuth shim, forward-auth-exempt router) — don't let it contradict the platform's MCP-exempt-from-forward-auth invariant. | Building MCP servers. Complements `/user-guide` MCP tab. | Med (scripts) |

### Wave 5 — Architecture & containers

| Skill | Mode | Conflicts to STRIP | Trigger ownership | Risk |
|---|---|---|---|---|
| `architecture` | docs | Keep "start simple"; ensure it hands decisions to `docs/decisions.md` (don't reinvent an ADR log — that's the invariant). | Significant architecture/tradeoff decisions. Defers the *log* to decisions.md, *frontend* to react-ui-craft. | Low-Med (trigger overlap) |
| `docker-expert` | docs | **Strip/annotate hard:** ignore its `docker-compose build`, `target: production` build-on-host, multi-arch buildx, and Docker `secrets:` advice — the NUC only PULLs, CI builds, secrets are `.env` chmod 600. Keep only Dockerfile authoring (multi-stage, non-root, EXPOSE+HEALTHCHECK, layer cache). | Authoring/optimising a Dockerfile. Defers compose/deploy to `/app-onboard`. | **Med (invariant conflict in body)** |
| `saas-multi-tenant` | docs | Note auth is **Authentik**, not app-built; keep only the Prisma-middleware/RLS tenant-scoping patterns. | Multi-tenant data isolation. Adopt only if/when an app serves >1 tenant. | Low (defer-friendly) |

### Wave 6 — BORROW folds (edit existing skills, add NO new skill)

| Source idea | Into | What to add (surgically) | Risk |
|---|---|---|---|
| `create-plan` | `/project-plan` | "Open questions: **max 3**" discipline. | Low |
| `writing-plans` | `/project-plan` | Per-task exact file paths `Create/Modify: path:line · Test:`. | Low |
| `executing-plans` + `subagent-driven-development` | `/project-plan` | Execute in batches of ~3 + review checkpoint; critique-the-plan-before-starting; optional per-task review-gate. | Low |
| `shadcn` | `/react-ui-craft` | shadcn CLI workflow (`add --diff`/`--dry-run`/`docs`) + composition rule pointer. | Low |
| `zod-validation-expert` | `/react-ui-craft` | Concrete Zod-at-the-boundary how-to (FormData coercion, server-action parse). | Low |
| `react-useeffect` | `/react-ui-craft` | "You-might-not-need-an-effect" decision tree (1 bullet + link). | Low |
| `clean-code` | `/coding-convention` | Design-smell rules (god functions, magic numbers, deep nesting). | Low |
| `dependency-updater` | `/host-audit` | Tiered safe-update flow (patch/minor vs major) — Watchtower updates images, not pkg deps. | Low |
| `skill-creation-guide` + `writing-skills` | a thin authoring note (or `/coding-convention` appendix) | The adoption-procedure + "skill authoring is TDD" principle so future skill adds stay consistent. | Low |

### Wave 7 — Integrate & close

CLAUDE.md: add tight pointers ONLY where a skill changes default behaviour (data, debugging, lint gate); keep it thin.
Update the ledger to ADOPTED across the board. Run `/session-wrap` → distill into `decisions.md`.

## Steps

- [x] **W0** Confirm scope with the user (adopt §1+§2 now, defer §1b — confirmed 2026-06-13). Plan flipped to `active`.
- [x] **W1** Adopted `/prisma-expert` + `/database-design` (stripped serverless/ORM-choice framing; SQLite-aware). Grep-guard CLEAN. ✓
- [x] **W2** Adopted `/systematic-debugging` + `/verification-before-completion`; `/lint-and-validate` (read its scripts — benign — then dropped them, kept guidance). Grep-guard CLEAN. ✓
- [x] **W3** Adopted `/supply-chain-guard` (read scanners — benign — dropped them; kept hardening + live scan) + `/dependabot-review` (removed auto-merge). Grep-guard CLEAN. ✓
- [x] **W4** Adopted `/api-integration-specialist` (Express→Route Handler) + `/async-python-patterns` (self-contained) + `/mcp-builder` (self-contained, anchored to todo/yakudoku + forward-auth-exempt invariant; no scripts/refs vendored). Grep-guard CLEAN. ✓
- [x] **W5** Adopted `/architecture` (self-contained, ADR→decisions.md) + `/docker-expert` (**narrowed** to Dockerfile authoring; compose/secrets/build-on-host stripped into a NOT-this-skill box) + `/saas-multi-tenant` (Authentik+Prisma-extension+SQLite-no-RLS adapt; flagged speculative). Grep-guard CLEAN. ✓
- [x] **W6** Folded §2 ideas into `/project-plan` (3) + `/coding-convention` (smells) + `/react-ui-craft` (shadcn CLI + Zod) + `/host-audit` (group L deps). Created `/skill-authoring` (adoption procedure + grep-guard). `react-useeffect` already covered (skipped, no dup). Grep-guard CLEAN (react-ui-craft hits = pre-existing correct *prohibitions*). ✓
- [x] **W7** Caught + adopted the missed `/react-best-practices`; added thin CLAUDE.md disciplines + reference-skill index; distilled cross-project lessons into `registries/knowledge-ledger.md §A` (adoption procedure, no-pre-install, frozen-IOC); ledger all ADOPTED. Plan → `done`. ✓

## Out of scope

- **§1b situational skills** — deferred until a real triggering need (a Telegram bot joins → telegram-bot-builder; a
  Redis queue → bullmq-specialist; etc.). Installing pre-need = clutter. Listed in the ledger §1b.
- **§3/§4/§5 SKIP skills** — recorded as rejected (conflicts/redundant/stubs); not revisited.
- **Wiring tests into a real app** — `/vitest-server-actions` + `/playwright-e2e-builder` are the *skills*; actually
  adding tests to `todo`/`yakudoku` is separate per-app work.

## Open questions / risks

- **Context bloat:** +~10 skill descriptions ≈ +1.5–2k tokens (current: 28 skills ≈ 4k). Acceptable; mitigate with tight
  descriptions + `references/` depth. Re-check `/context` after W5.
- **Trigger collisions:** `architecture` vs decisions.md, `database-design` vs `prisma-expert`, `lint-and-validate` vs
  coding-convention — resolved by the ownership column; verify by re-reading descriptions together in W7.
- **Script safety (W2/W3/W4):** the line-by-line read is the gate; if any script is sketchy → drop it, keep guidance only.
- **GitHub API rate limit:** hit earlier — use raw URLs or `gh auth` for fetches.
- **docker-expert body conflict:** highest risk of teaching a wrong pattern (build-on-host) — annotate aggressively; if
  it can't be cleanly de-conflicted, downgrade to BORROW (fold only the Dockerfile-authoring bullets).

## Decisions to distill — DISTILLED ✓ (W7)

- The skill-adoption procedure + the conflict grep-guard → **`/skill-authoring`** (the durable home) + one line in
  `registries/knowledge-ledger.md §A`.
- Why §1b skills are deferred (pre-need install = clutter) → `registries/knowledge-ledger.md §A` + `registries/skill-candidates.md §1b`.
- Frozen-IOC-list = false confidence → `registries/knowledge-ledger.md §A` + `/supply-chain-guard`.
- Skill ownership boundaries (architecture↔decisions.md, database-design↔prisma-expert, react-best-practices↔react-ui-craft,
  docker-expert↔app-onboard) → encoded in each skill's description "complements/defers" line + `/skill-authoring`.
