# 07 — Skill candidates from the community catalog (evaluation ledger)

> A persisted evaluation of community Claude Code skills (from **`davila7/claude-code-templates`**, the repo behind
> `aitmpl.com`) against the fleet platform — so a future session has the verdicts as context and does **not**
> re-evaluate from scratch. Reviewed 2026-06-13.
>
> **This is a backlog/reference, NOT an install record.** Nothing here is installed yet. "ADOPT" = worth copying into
> `.claude/skills/` *and adapting* to our conventions; "BORROW" = don't install, fold one idea into an existing skill;
> "SKIP" = recorded so we don't reconsider it. Tier HIGH/MED = relative value to this platform.

## How these were judged (method)

- **Source path:** `cli-tool/components/skills/<category>/<skill>/` in `davila7/claude-code-templates`. Raw file:
  `https://raw.githubusercontent.com/davila7/claude-code-templates/main/<path>`.
- **Safety:** every reviewed skill's directory was listed; any shipped script (`.sh`/`.py`/`.js`) was inspected. No
  malicious code was found in anything reviewed (no `curl|bash`, destructive commands, exfiltration, or obfuscation).
  **Two HIGH picks ship real scripts NOT yet read line-by-line** — `supply-chain-guard` and `mcp-builder`. **Read their
  `scripts/` before running.** `lint-and-validate` and `performance-profiling` ship real, benign scripts.
- **Catalog quality is uneven.** Many community skills are **auto-generated stubs** — the tell is a SKILL.md that just
  says *"Working on X tasks… Clarify goals, constraints… apply best practices… open implementation-playbook.md"*, and
  "toolkit" skills whose advertised Python scripts are empty `print("Running…")` skeletons. These are demoted to SKIP.
- **Dangling refs:** some skills (`writing-plans`, `executing-plans`) `@`-reference external `superpowers:*` sub-skills
  that do **not** exist in this repo — they would break if installed standalone.

---

## 1. ADOPT — net-new, substantive, on-stack, no conflict

Copy into `.claude/skills/`, then **adapt** to our conventions (strip serverless/cloud assumptions + dangling refs).

| Skill | Tier | Fills which gap | Ships |
|---|:--:|---|:--:|
| `development/prisma-expert` | **ADOPTED ✓** | Schema/migration/N+1/transaction depth. Installed `/prisma-expert` (W1, adapted: dropped non-existent-specialist routing + serverless conn-pooling; noted SQLite + the singleton). | docs |
| `security/supply-chain-guard` | **ADOPTED ✓** | Installed `/supply-chain-guard` (W3). Read its bash scanners (benign) but **dropped them** — frozen IOC db (2026-03-31) = false confidence; kept the hardening checklist + a **live** scan procedure (advisories + npm/pip audit). | docs (scripts dropped) |
| `workflow-automation/dependabot-review` | **ADOPTED ✓** | Installed `/dependabot-review` (W3, adapted: **removed auto-merge** — recommends + waits for user go-ahead, per the merge-ships-via-Watchtower rule). | docs |
| `development/mcp-builder` | **ADOPTED ✓** | Installed `/mcp-builder` (W4, rewritten self-contained: live MCP/SDK URLs, anchored to todo/yakudoku MCP pattern + forward-auth-exempt invariant; no reference files/scripts vendored). | docs (none vendored) |
| `development/react-best-practices` (Vercel) | **ADOPTED ✓** | Installed `/react-best-practices` (W7 — was missed in W1-W5 planning, caught by the done-check). Self-contained 45-rule perf catalog; per-rule files not vendored (live upstream); scoped to perf vs `/react-ui-craft`. | docs |
| `development/api-integration-specialist` | **ADOPTED ✓** | Installed `/api-integration-specialist` (W4, adapted: Express webhook → Next.js Route Handler; kebab name; trimmed vendor snippets). | docs |
| `development/async-python-patterns` | **ADOPTED ✓** | Installed `/async-python-patterns` (W4, rewritten self-contained — no dangling playbook ref). | docs |
| `development/systematic-debugging` | **ADOPTED ✓** | "No fix without root-cause" 4-phase. Installed `/systematic-debugging` (W2, adapted: dangling sub-skill refs → our skills; debug-by-layer tie-in). | docs |
| `development/verification-before-completion` | **ADOPTED ✓** | Evidence-before-claims gate. Installed `/verification-before-completion` (W2, tied to /honest-critique + /verify). | docs |
| `development/lint-and-validate` | **ADOPTED ✓** | Installed `/lint-and-validate` (W2). Read its scripts (benign) but **dropped them** — kept the guidance only, aligned to eslint/tsc/Prettier + ruff/mypy/bandit. | docs (scripts dropped) |
| `development/architecture` | **ADOPTED ✓** | Installed `/architecture` (W5, self-contained; ADR→`decisions.md` invariant; scoped system-level vs `/brainstorming`). | docs |
| `development/database-design` | **ADOPTED ✓** | DB design judgment. Installed `/database-design` (W1, adapted: dropped ORM-selection — Prisma is fixed; SQLite-first framing). | docs |
| `development/docker-expert` | **ADOPTED ✓ (narrowed)** | Installed `/docker-expert` (W5) **scoped to Dockerfile authoring ONLY**; stripped compose/networks/secrets/build-on-host/multi-arch (platform invariants) into an explicit "NOT this skill" box; base→node:22. | docs |
| `development/saas-multi-tenant` | **REMOVED 2026-06-13** | Adopted in W5 but **removed** — speculative, no multi-tenant app exists; it was a standing context tax (description loaded every session) for zero use. Re-adopt from this catalog entry if a multi-tenant app is ever built. (Lesson: don't keep a skill with no triggering need — see `registries/knowledge-ledger §A`.) | — |

## 1b. ADOPT-when-the-need-appears (situational, substantive)

| Skill | When |
|---|---|
| `development/changelog-generator` | Conventional-Commits → release notes (we already mandate CC). Pairs with `/guide` pages. |
| `development/k6-load-testing` | Smoke/load-test an API behind Traefik before exposing it. |
| `development/bullmq-specialist` | If a worker becomes Redis-queue-driven. |
| `development/telegram-bot-builder` | If a Telegram bot joins the fleet (complements Discord/MCP `/user-guide` tabs). |
| `development/python-testing-patterns` | First Python worker that needs a test discipline (pytest/fixtures/async). |
| `development/domain-driven-design` | Only a genuinely complex domain — it is viability-gated ("don't over-engineer CRUD"). |
| `development/test-driven-development` | If we decide to impose TDD platform-wide (strong opinion — opt-in). |

---

## 2. BORROW — don't install; fold one idea into an existing skill

> **ALL FOLDED ✓ (W6).** `/project-plan` ← max-3-open-Qs + per-task file paths + critique-before-execute + batched
> execution. `/coding-convention` ← design-smell bullets. `/react-ui-craft` ← shadcn CLI workflow + Zod-at-boundary.
> `/host-audit` ← group L dependency-freshness (tiered). `react-useeffect` was **already** in coding-convention §6
> (skipped, no dup). `skill-creation-guide` + `writing-skills` → the new **`/skill-authoring`** meta-skill (adoption
> procedure + grep-guard). The clean-code/zod folds were kept minimal (mostly already covered).

| From skill | Idea to fold | Into |
|---|---|---|
| `development/create-plan` | "Open questions: **max 3**" discipline. | `/project-plan` |
| `development/writing-plans` | Exact file paths per task: `Create/Modify: path:line · Test:`. | `/project-plan` |
| `development/executing-plans` | Execute in **batches of ~3 + review checkpoint**; **critique the plan before starting**. | `/project-plan` |
| `web-development/shadcn` | The `shadcn` CLI workflow (`add --diff`/`--dry-run`/`docs`) + composition rule tables. Correctly Tailwind-v4 + radix-aware. | `/react-ui-craft` |
| `web-development/zod-validation-expert` | The concrete "how" of Zod parsing (FormData coercion, server-action integration) — our skill only says "parse with Zod". | `/react-ui-craft` |
| `development/react-useeffect` | "You-might-not-need-an-effect" decision tree. | `/react-ui-craft` |
| `development/clean-code` | Design-smell rules (god functions, magic numbers). | `/coding-convention` |
| `development/dependency-updater` | Tiered safe-update flow (patch/minor auto, major prompt) — Watchtower updates images, not package deps. | `/host-audit` |
| `web-development/tanstack-query-expert` · `core-web-vitals` · `react-component-performance` · `accessibility` · `development/api-patterns` · `api-design-principles` · `performance-profiling` · `architecture-patterns` | Keep as deeper-reference material if/when the matching need is real. | — |

---

## 3. SKIP — CONFLICTS with our invariants (recorded so we don't reconsider)

| Skill | Conflicts with |
|---|---|
| `web-development/tailwind-design-system` | Teaches `tailwind.config.ts`, HSL tokens, v3 `@tailwind` directives, `forwardRef`+`displayName` — vs our Tailwind v4 `@theme`/OKLCH, no config file, React 19 ref-as-prop. |
| `development/frontend-dev-guidelines` | Built on MUI v7, `React.FC`, TanStack Router — vs shadcn/radix-nova + App Router + `@/`. |
| `development/cloudflare-deploy` | Deploys app code to CF Workers/Pages (`wrangler`) — vs NUC-hosted Docker; we use CF only for Tunnel+DNS+TLS. |
| `development/nestjs-expert` | Heavyweight DI/decorator framework — vs plain ESM workers + Next server actions. |
| `web-development/drizzle-orm-expert` | Drizzle — vs our standardized Prisma (stack drift). |
| `web-development/hono` | Edge/serverless framing — vs long-running containers behind Traefik. |
| `development/backend-dev-guidelines` · `backend-architect` · `senior-backend` | Express/layered-controller/microservices — vs "no separate Express, Next server actions". |
| `web-development/zustand-store-ts` · `development/react-state-management` | Push client-global-state architecture — vs our server-actions-first default. |
| `development/github-actions-creator` | Could generate Vercel/SSH/CF deploy jobs that undercut the standardized `deploy.yml` — keep the single golden template. |
| `security/secrets-management` | Pitches Vault/AWS Secrets Manager — vs `.env` chmod 600. |
| `development/server-management` | PM2/systemd — vs Docker+Traefik+Watchtower+nuc-monitor. |

## 4. SKIP — REDUNDANT (already covered by what we own)

- `workflow-automation/planning-with-files`, `git/git-context-controller` → `/project-plan` + `docs/plans/` + real git.
- `development/architecture-decision-records` → `docs/decisions.md` knowledge log.
- `development/code-reviewer`, `production-code-audit`, `code-review-checklist`, `best-practices` → built-in `/code-review`, `/security-review`, `/react-ui-craft` security.
- `development/error-resolver` → superseded by the stronger `systematic-debugging`.
- `development/nextjs-app-router-patterns`, `react-patterns`, `react-ui-patterns`, `react-dev`, `nextjs-best-practices` → `/react-ui-craft` + the mandated stack.
- `development/python-pro`, `typescript-pro`, `typescript-expert`, `javascript-pro`, `javascript-mastery` → generic personas, `/coding-convention`.
- `development/software-architecture` → `architecture` + `/coding-convention`.

## 5. SKIP — STUBS (auto-generated, low signal) & WRONG-SIZED

- **Stubs** (boilerplate SKILL.md and/or empty `print("Running…")` scripts): `senior-frontend`, `senior-fullstack`,
  `senior-architect`, `senior-backend`, `code-reviewer`(toolkit), `fastapi-pro`, `graphql-architect`,
  `nodejs-backend-patterns`, `api-documentation-generator`, `tdd-orchestrator`, `tdd-workflow`,
  `javascript-testing-patterns`, `e2e-testing-patterns`, `testing-patterns`, `performance`, and the monitoring stubs
  `prometheus-configuration`/`grafana-dashboards`/`observability-engineer`/`incident-responder` (too thin despite
  matching `nuc-monitor` — write our own thin skill instead if we want monitoring help).
- **Wrong-sized for a single-NUC polyrepo** (would invite over-engineering): `event-sourcing-architect`,
  `microservices-patterns`, `monorepo-architect`, `kubernetes-architect`, `helm-chart-scaffolding`,
  `terraform-specialist`, `gitops-workflow`, and all cloud-vendor lock-in (`aws-serverless`, `azure-functions`,
  `gcp-cloud-run`, `gke-basics`, `vercel-deploy`, `netlify-deploy`, `render-deploy`, `railway`).
- **Out of scope:** the `security/` category is ~80% offensive pentest (metasploit/sqlmap/burp/privilege-escalation/
  red-team) — excluded entirely; only `supply-chain-guard` (§1) is in-scope.

---

## 5c. Pass 2026-06-13 (b) — testing + agent thinking/process

### Testing (the platform had NO testing skill)
| Skill | Verdict | Note |
|---|:--:|---|
| `development/playwright-e2e-builder` | **ADOPTED ✓ (adapted)** | Installed as `/playwright-e2e-builder`. Kept the bones (interview-driven planning, POM, role-based locators, sharding); **rewrote auth/seeding/CI** for this platform: Authentik forward-auth ⇒ NO in-app login form (apps open at app layer locally; header-injection for `X-authentik-*` authz), seed via **Prisma not REST**, **temp SQLite** test DB not Postgres, Node 22. Templates incl. config/seed/global-setup/fixtures/POM/e2e.yml. |
| `development/webapp-testing` | BORROW MED | Anthropic's official "drive a local webapp" toolkit (screenshots/logs). Ships a **real** `scripts/with_server.py`. For ad-hoc UI debugging; complements `/verify`. |
| `development/test-detect` | BORROW MED | Lightweight runner that auto-detects Vitest/Jest/Playwright/pytest/Go — handy for polyglot repos. |
| `development/playwright-java` · `development/playwright` | SKIP | Java (no Java here) / Codex-ecosystem-pathed (`$CODEX_HOME`). |
| `tdd-orchestrator` · `tdd-workflow` · `javascript-testing-patterns` · `e2e-testing-patterns` · `testing-patterns` | SKIP | Auto-gen stubs (re-confirmed). |

> **MISSING — no catalog fit → BUILT CUSTOM:** unit/integration testing for our **core path: Vitest + Next.js server
> actions** (mock the Prisma singleton + `next/cache`, assert guards + `revalidatePath`), pure-logic units, RTL
> components, and a GH-Actions `test` job gating `deploy.yml`. Every JS-unit candidate was a stub →
> **`/vitest-server-actions`** authored (grounded in `projects/todo/app/actions.ts` + `lib/db.ts`), with templates
> (vitest.config/setup, actions.test.ts, ci-test-job.yml). `.claude/skills/vitest-server-actions/`.

### Agent thinking / process (what the user asked to improve)
| Skill | Verdict | Note |
|---|:--:|---|
| `development/receiving-code-review` | source-only | Best catalog match for **anti-sycophancy** (forbidden-phrase table: no reflexive "You're absolutely right!"). Reactive (about receiving review), not proactive critique. Its tone rules were **lifted into the custom `/honest-critique`**. |
| `development/brainstorming` | source-only | Decent: one-question-at-a-time, recommend-with-reasoning, YAGNI, writes to `docs/plans/`. Ideas folded into the custom **`/brainstorming`** (tailored to our Knowledge OS + `/project-plan` hand-off). |
| `development/skill-creation-guide` | BORROW MED | Anthropic's official skill-authoring principles (concise, progressive disclosure). Worth a thin authoring note since we keep building skills. |
| `development/writing-skills` | BORROW MED | "Skill authoring IS TDD" framing (baseline-fail → write → pressure-test). |
| `development/subagent-driven-development` | BORROW MED | Ships real implementer/spec-reviewer/quality-reviewer prompt templates; the **review-gate-after-each-task** idea is worth folding into `/project-plan` execution. |
| `dispatching-parallel-agents` · `requesting-code-review` · `feature-design-assistant` | SKIP | Covered by built-in Agent-tool guidance / `/code-review` / the new `/brainstorming` respectively. |
| `using-superpowers` | SKIP (anti-pattern) | Coercive ALL-CAPS "check a skill before ANY response, even 1%" — would over-trigger and fights our thin-CLAUDE.md philosophy. |
| `command-creator` · `command-development` · `hook-development` · `agent-development` · `agent-md-refactor` | reference-only | Useful when authoring those artifacts; not "thinking quality". Don't install; consult upstream if needed. |
| `cc-skill-strategic-compact` · `cc-skill-continuous-learning` · `cc-skill-coding-standards` | SKIP | Auto-gen stubs (body literally "Development skill skill."). Note: there is **no** real prompt-engineering / `senior-prompt-engineer` skill in the catalog (404/empty). |

### Custom skills authored this pass (catalog had no good fit)
- **`/honest-critique`** — anti-sycophancy + red-team-your-own-plan. Seeded with `receiving-code-review`'s forbidden-phrase
  table; tailored to the user's stated value (truth over comfort). `.claude/skills/honest-critique/`.
- **`/brainstorming`** — diverge → 2-3 distinct approaches + tradeoffs → recommend-with-reasoning → hand off to
  `/project-plan`. `.claude/skills/brainstorming/`.
- **`/code-reuse`** (2026-06-13, user-requested) — DRY across the **independent repos**: check prior art before building,
  rule-of-three gate, hybrid share model (commons copy-in / `@thiengthb/*` package / template), owns the catalog
  `registries/shared-assets.md`. Catalog had no fit (community DRY skills assume a monorepo). Seeded from the proven duplication
  (MCP OAuth shim built twice in todo↔yakudoku). `.claude/skills/code-reuse/`.

- **`/ui-ux-review`** (2026-07-28, user-requested) — review a **RUNNING** UI, which nothing on the platform did: every
  UI gate we had checked the *code*. Two disjoint layers — a deterministic `scripts/ui-audit.mjs` (axe-core over WCAG
  2.2 AA tags, real-`Tab` focus walk, target size, overflow, console, CLS/LCP, 4 viewport×scheme passes) then a bounded
  judgment pass in Claude-in-Chrome. Standard: `platform/standards/uiux-review.md`.
  **Catalog verdict:** community design-review skills exist (mcpmarket `design-review` / `ui-design-reviewer`,
  [OneRedOak](https://github.com/OneRedOak/claude-code-workflows/tree/main/design-review)) but all are *model-only* —
  they hand a screenshot to an LLM with no deterministic floor, which is the exact failure the user named ("lan man,
  không đúng trọng tâm"). **BORROWED** from OneRedOak: the 7-phase spine + the Blocker/High/Medium/Nitpick taxonomy.
  **REJECTED:** its Playwright-MCP dependency (we drive Playwright from a script — cheaper and repeatable) and its
  "world-class design standards" framing (replaced by *project law outranks generic taste*: `docs/ui-patterns.json` →
  project `CLAUDE.md` → `standards/ui-layout` → the generic floor).
  Anthropic's [`webapp-testing`](https://github.com/anthropics/skills/tree/main/skills/webapp-testing) contributed the
  reconnaissance-then-action + `networkidle`-before-inspect pattern; its `with_server.py` is not vendored (our e2e
  harness already owns server lifecycle). `.claude/skills/ui-ux-review/`.

> Together with the existing set this closes the thinking loop: **brainstorm → plan (`/project-plan`) → critique
> (`/honest-critique`) → execute → verify (`/verify` + `verification-before-completion`) → wrap (`/session-wrap`)**.

---

## 5d. Pass 2026-06-13 (c) — `anthropics/skills` official repo (the one big source 5a–5c missed)

> Passes 1–5c vetted `davila7/claude-code-templates` (+ ideas from `obra/superpowers`). The only other large source is
> Anthropic's official **`anthropics/skills`** (≈149k★, the basis of the open `agentskills.io` standard since Dec 2025).
> Evaluated 2026-06-13 (c). The community "awesome-*" lists (BehiSecc / travisvn / hesreallyhim / Composio) are just
> indexes pointing back at these same repos — no net-new depth.

| Skill group | Net-new vs what we own | Verdict |
|---|---|---|
| **Document generation** (`docx` · `pdf` · `pptx` · `xlsx`) | ✅ Yes — server-side Office/PDF authoring; davila7 had no equivalent | **ADOPT-when-the-need-appears** — NO current app exports documents. Installing now repeats the `saas-multi-tenant` mistake (a context tax with zero triggering need, see `registries/knowledge-ledger §A`). Re-adopt from here if e.g. journal/an app gains a "export to PDF/report" feature. |
| `mcp-builder` | Already adopted (§1, our self-contained rewrite) | SKIP (have it) |
| `webapp-testing` | Already logged (§5c, BORROW MED) | SKIP (logged) |
| `artifacts-builder` | For claude.ai artifacts, not a dev-platform task | SKIP (out of scope) |
| Creative (art/music/design) · Enterprise (brand/comms) | Off the dev-platform scope | SKIP (out of scope) |

> **Net result of pass (c): install nothing now.** The community well is tapped — the davila7 catalog is harvested and
> the only fresh capability (doc-generation) is situational. Recorded here so a future session doesn't re-scan
> `anthropics/skills` from scratch.

### Custom skill authored this pass (no catalog fit)
- **`/host-maintenance`** (2026-06-13 (c), user-requested) — the platform had no skill for *which* NUC upkeep is
  worth a cron heartbeat + how to wire it **report-only**. Generic community "cron" skills just reteach the scheduling
  mechanism (which `/schedule` + the Cron* tools already own) and carry no platform knowledge. Owns the what/when/safe-
  wiring lane; hard report-only rule (no destructive action by an unattended agent); defers mechanism→`/schedule`,
  audit→`/host-audit`, liveness→`nuc-monitor`. `.claude/skills/host-maintenance/`.

> **Decided NOT to build:** a "web-browse" skill/agent — fully covered by the built-in `WebSearch`/`WebFetch` tools +
> `/deep-research`; would be 100% reinvention. A cron *agent* — cron is a mechanism, not a tool-restricted/context-
> isolated role (the only thing that justifies a custom agent).

## 5e. Pass 2026-06-13 (d) — the MECHANISM axis (hooks / plugins / SDD), not more skills

> Prior passes scanned the *content* axis (skills) and concluded it's tapped — more skills = context tax. This pass
> stepped back to the **mechanism** axis after researching the 2026 ecosystem (skills 349+, Superpowers 40.9k★, Spec Kit
> 80k★, plugins now the official distribution format, hooks = the "deterministic control layer"). The asymmetry we'd
> never named: we invested heavily in *writing* rules (8 invariants, knowledge OS) but *enforcement* was still 100%
> model-discretion.

| Mechanism | Verdict | Why |
|---|---|---|
| **Hooks** (`PreToolUse`/`PostToolUse`) | **ADOPTED this pass** | Turns prose invariants into code that can't be skipped. Highest leverage, ~zero context tax (hooks don't load into context like skills). See below. |
| **Plugins / private marketplace** | **DEFER (design-ready)** | The packaging/distribution format (bundles skills+agents+hooks+MCP). Marginal today (one machine, `.claude` already in git); worth it only when expanding to multiple machines / onboarding. Hooks were written package-ready (`${CLAUDE_PROJECT_DIR}` paths, self-contained Node) so the future bundle is cheap. |
| **Spec-driven dev** (Spec Kit / Kiro / BMAD) | **SKIP (redundant)** | `/brainstorming` + `/project-plan` + `decisions.md` already reproduce the spec→plan→tasks→implement discipline. Importing Spec Kit would be heavier and duplicative. |

### Hooks authored this pass (`.claude/hooks/`, wired in `.claude/settings.json`)
- **`secret-guard.mjs`** (PreToolUse, **blocks**) — hardcoded secret into a non-`.env` file → exit 2. Invariant #4.
- **`invariant-warn.mjs`** (PostToolUse, advisory) — certbot/letsencrypt/acme in config (#6), self-hosted runner in CI
  (#1), host port-publish in an app compose (#2). Never blocks (legit local-dev exceptions exist).
- **`prettier-on-edit.mjs`** (PostToolUse, best-effort) — local prettier `--write`; silent no-op if none installed.
- All Node ESM (Windows-safe, no shell branching). Tested standalone (block/allow/placeholder cases) before wiring.

> **Decided NOT to automate:** the `/skill-authoring` conflict grep-guard as a hook — its regex contains the very tokens
> it forbids, so it false-fires on the rule-documenting skills; stays a human-judgment manual step. **Decided NOT to add:**
> an `edit-without-read` hook — the harness already enforces read-before-edit natively.

---

## 5f. Pass 2026-06-13 (e) — model routing: thin rule, NOT a switch-per-task skill

> User idea: a skill that analyzes every task's weight, proposes a model switch, and waits for approval before working —
> to save tokens and stop a weak model "contaminating" strong-model code. Concern is valid (the contamination risk is
> real and asymmetric); the **mechanism was rejected** after honest-critique.

| Option | Verdict | Why |
|---|---|---|
| **Switch-per-task skill** (analyze → propose → approve → `/model`) | **REJECT** | 4 flaws: (1) the agent can't switch its own model — only the user can, so it can only ever *suggest*; (2) the analysis runs on the expensive model already loaded — for a light task the cost of asking exceeds the saving; (3) switching mid-session re-reads the FULL history at the new model and **drops the prompt cache** → thrashing *costs* tokens; (4) wrong granularity — model is session-level (shared context, code consistency), not task-level. A "fire before every task" skill is also exactly the context-tax we keep cutting. |
| **Thin rule in `CLAUDE.md`** (session rubric + `/model` Enter-vs-`s` gotcha + delegate-to-cheaper-subagent) | **ADOPTED** | Always present, ~zero recurring cost, no fire-per-turn. Captures the one durable behavior. |
| Flip `CLAUDE_CODE_SUBAGENT_MODEL` globally | **NOT DONE** | Cross-session side-effect; prefer per-delegation `model:` so each call is a deliberate choice. |

**Verified Claude Code mechanics (basis for the rule):** `/model` + **Enter persists to `~/.claude/settings.json` =
global default for all future sessions**; press **`s`** for session-only. Switching mid-session re-sends full context
and loses prompt cache. Subagents accept a per-agent `model:` override (and `CLAUDE_CODE_SUBAGENT_MODEL` global) — so
the real token lever is **Opus main = orchestrator+reviewer, cheaper subagents do isolated bulk work under review**
(isolated context = the real saving; review = no contamination). Rule lives in `CLAUDE.md` §"Model routing".

---

## 6. Suggested first wave (if/when we decide to install)

0. **Done this pass:** authored `/honest-critique` + `/brainstorming` (custom — catalog had no fit). Test them in use.
1. `prisma-expert` + `database-design` — the data layer has zero skill coverage today and is core to every web app.
2. `systematic-debugging` + `verification-before-completion` + `lint-and-validate` — process discipline, polyglot, cheap wins.
3. `supply-chain-guard` + `dependabot-review` — supply-chain + dep hygiene for the growing `push→GHA→ghcr` fleet (read `supply-chain-guard/scripts/` first).
4. ✓ DONE — `/playwright-e2e-builder` (e2e, platform-adapted) + `/vitest-server-actions` (unit/integration) now cover the full testing pyramid.
5. Fold the §2 BORROW ideas into `/project-plan` and `/react-ui-craft` — no new skills, pure refinement.

> Re-run this evaluation when the catalog changes materially; update verdicts in place (this file is the memory).
