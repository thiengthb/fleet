# 07 — Skill candidates from the community catalog (evaluation ledger)

> A persisted evaluation of community Claude Code skills (from **`davila7/claude-code-templates`**, the repo behind
> `aitmpl.com`) against the MiniServer platform — so a future session has the verdicts as context and does **not**
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
| `development/prisma-expert` | HIGH | Schema/migration/N+1/transaction depth — our skills stop at "Prisma + server actions". | docs |
| `security/supply-chain-guard` | HIGH | Scans npm/PyPI/GH-Actions for compromised pkgs + IOC/C2 + CI/CD misconfig. Fits `push→GHA→ghcr` across many repos. | **scripts ⚠ read first** |
| `workflow-automation/dependabot-review` | HIGH | Triage + safe auto-merge of dep PRs. Watchtower auto-pulls on every merge → recurring chore. | docs |
| `development/mcp-builder` | HIGH | Anthropic guide to build MCP servers (Node/Py). Pairs with the `/user-guide` MCP tab. | **scripts ⚠ read first** |
| `development/react-best-practices` (Vercel) | HIGH | 45 concrete RSC/bundle/waterfall perf rules — depth `/react-ui-craft` doesn't have. Stack-aligned. | docs |
| `development/api-integration-specialist` | HIGH | Robust 3rd-party API clients (OAuth2, retries, circuit breakers, webhook-sig). The worker/bot use case. | docs |
| `development/async-python-patterns` | HIGH | asyncio concurrency for the standalone **Python workers/bots**. | docs |
| `development/systematic-debugging` | HIGH | "No fix without root-cause" 4-phase discipline. No debugging skill exists today. | docs |
| `development/verification-before-completion` | HIGH | Gate: no "done/passing" claim without fresh command output. Reinforces honest CI culture. | docs |
| `development/lint-and-validate` | HIGH | Post-edit lint/tsc/audit loop incl. **Python (ruff/mypy/bandit)** — our Prettier focus misses the worker side. | scripts (benign) |
| `development/architecture` | HIGH | Trade-off → ADR decision framework, "start simple". Good for a continuously-growing platform. | docs |
| `development/database-design` | HIGH | Prisma/Postgres-specific schema/index/ORM thinking. | docs |
| `development/docker-expert` | MED* | Lean/non-root/HEALTHCHECK Dockerfile authoring. **Guardrail:** ignore its compose/secrets/build-on-host advice — that violates "NUC only PULLs". | docs |
| `development/saas-multi-tenant` | MED | Postgres RLS + **Prisma-middleware** tenant scoping. Pays off the day any app is shared (note: auth is still Authentik). | docs |

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

| From skill | Idea to fold | Into |
|---|---|---|
| `development/create-plan` | "Open questions: **max 3**" discipline. | `/project-plan` |
| `development/writing-plans` | Exact file paths per task: `Create/Modify: path:line · Test:`. | `/project-plan` |
| `development/executing-plans` | Execute in **batches of ~3 + review checkpoint**; **critique the plan before starting**. | `/project-plan` |
| `web-development/shadcn` | The `shadcn` CLI workflow (`add --diff`/`--dry-run`/`docs`) + composition rule tables. Correctly Tailwind-v4 + radix-aware. | `/react-ui-craft` |
| `web-development/zod-validation-expert` | The concrete "how" of Zod parsing (FormData coercion, server-action integration) — our skill only says "parse with Zod". | `/react-ui-craft` |
| `development/react-useeffect` | "You-might-not-need-an-effect" decision tree. | `/react-ui-craft` |
| `development/clean-code` | Design-smell rules (god functions, magic numbers). | `/coding-convention` |
| `development/dependency-updater` | Tiered safe-update flow (patch/minor auto, major prompt) — Watchtower updates images, not package deps. | `/nuc-health-audit` |
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
| `development/playwright-e2e-builder` | **ADOPT HIGH** | Interview-driven Playwright E2E: POM, `storageState` auth reuse (its cookie/session path matches **Authentik forward-auth** = httpOnly cookies), GH-Actions sharding, dev-server config. Docs-as-skill done well, not a stub. |
| `development/webapp-testing` | BORROW MED | Anthropic's official "drive a local webapp" toolkit (screenshots/logs). Ships a **real** `scripts/with_server.py`. For ad-hoc UI debugging; complements `/verify`. |
| `development/test-detect` | BORROW MED | Lightweight runner that auto-detects Vitest/Jest/Playwright/pytest/Go — handy for polyglot repos. |
| `development/playwright-java` · `development/playwright` | SKIP | Java (no Java here) / Codex-ecosystem-pathed (`$CODEX_HOME`). |
| `tdd-orchestrator` · `tdd-workflow` · `javascript-testing-patterns` · `e2e-testing-patterns` · `testing-patterns` | SKIP | Auto-gen stubs (re-confirmed). |

> **MISSING — no catalog fit:** unit/integration testing for our **core path: Vitest + Next.js server actions** (mocking
> Prisma, asserting `revalidatePath`/returned DTO, Zod-boundary failures) + RTL component tests + a GH-Actions `test`
> job gating `deploy.yml`. Every JS-unit candidate was a stub. → **write a small custom skill** (`vitest-server-actions`)
> rather than settle. Not built yet — do it when the first app actually sets up tests, so it's grounded in real code.

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

> Together with the existing set this closes the thinking loop: **brainstorm → plan (`/project-plan`) → critique
> (`/honest-critique`) → execute → verify (`/verify` + `verification-before-completion`) → wrap (`/session-wrap`)**.

---

## 6. Suggested first wave (if/when we decide to install)

0. **Done this pass:** authored `/honest-critique` + `/brainstorming` (custom — catalog had no fit). Test them in use.
1. `prisma-expert` + `database-design` — the data layer has zero skill coverage today and is core to every web app.
2. `systematic-debugging` + `verification-before-completion` + `lint-and-validate` — process discipline, polyglot, cheap wins.
3. `supply-chain-guard` + `dependabot-review` — supply-chain + dep hygiene for the growing `push→GHA→ghcr` fleet (read `supply-chain-guard/scripts/` first).
4. `playwright-e2e-builder` (e2e, Authentik-aware) + author a custom `vitest-server-actions` (unit/integration — the missing core-path coverage).
5. Fold the §2 BORROW ideas into `/project-plan` and `/react-ui-craft` — no new skills, pure refinement.

> Re-run this evaluation when the catalog changes materially; update verdicts in place (this file is the memory).
