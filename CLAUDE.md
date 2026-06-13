# MiniServer — Shared rules for every project in this folder

Every project in `D:\Projects\MiniServer\` deploys to the NUC `thienminiserver` via a fixed chain (built 2026-06-07):

```
git push main → GitHub Actions build → ghcr.io/thiengthb/<repo> (:latest + :<sha>)
→ Watchtower on the NUC auto-pulls (≤60s) → Traefik → Cloudflare Tunnel → *.thientnse.site
```

**`nuc-platform/INVENTORY.md` = the SINGLE source of truth** (every app/volume/domain/auth/monitor) — read it before any
project-lifecycle change; every add/remove-app skill MUST update it (anti-drift). Other docs: `01-architecture-and-operations.md`
(ops), `02-known-traps.md` (traps), `03-SETUP-FROM-SCRATCH.md` (rebuild). **NUC reset / needs rebuilding → follow
`04-agent-rebuild-runbook.md`.**

## Invariants — MUST NOT be violated in any project

1. **NUC only PULLs images** — no self-hosted runner, no SSH-deploy from CI, no build-on-NUC (except deliberate firefighting).
2. **One shared Docker network `edge`** — infra (`/opt/infra`) creates it; apps reference `external: true`, never publish
   ports to the host (only Traefik reaches apps over the network).
3. **Public = label** — Traefik `exposedbydefault=false`; an app is public **iff** it has the 4 `traefik.*` labels. A new
   subdomain needs no Cloudflare change (the wildcard `*.thientnse.site` already catches it).
4. **Secrets only in `.env`** (chmod 600, in `.gitignore`) — never hardcode a token/key in compose, Dockerfile, or code.
5. **Dual image tag `latest` + short git-SHA** — rollback = pin the SHA tag in the NUC compose, do NOT revert git.
6. **TLS by Cloudflare** — do not configure Let's Encrypt/certbot anywhere.
7. **Traefik ≥ v3.7; Watchtower needs `DOCKER_API_VERSION=1.44`** (Docker 29 dropped API < 1.40 — a violation fails
   silently, see doc 02).
8. **Auth = Authentik** (IdP `auth.thientnse.site`, `/opt/apps/authentik`) — never self-code login / password hashing /
   JWT / session minting. Protect an app = forward-auth (middleware `authentik@docker`); authorize = app reads the
   `X-authentik-*` headers; link users by **email**. **NEVER** forward-auth an endpoint a machine client calls
   automatically. Authentik = prebuilt image → NO Watchtower label (update manually, bump `AUTHENTIK_TAG`).

## Conventions

- Repo `thiengthb/<repo>`, deploy branch `main`. Each repo needs a `Dockerfile` (`EXPOSE` + `HEALTHCHECK` where possible)
  + `.github/workflows/deploy.yml` (copy from a living ghcr app — `nuc-monitor`/`todo`).
- On the NUC: `/opt/apps/<name>/` = `docker-compose.yml` + `.env` + `.gitignore` (any repo compose is local-dev ONLY).
  App data = a named volume (`<name>_data`), no bind-mount.
- SSH: `ssh thien25@thienminiserver` (key installed; user in the docker group).
- **Dev artifacts = English** (code, comments, `docs/*.md`, skills, specs, commit messages). End-user UI copy = the
  product's language (vi for `todo`); the in-app `/guide` page is the one exempt.
- **Agent ↔ user chat = Vietnamese, always** — every reply/explanation/summary/question/status written TO the user. Does
  NOT override the English dev-artifact rule above; technical tokens (paths, commands, identifiers) stay as-is.

## Coding — skill `/coding-convention` (MANDATORY before writing/editing code or committing)

Core rules (full checklist in the skill):
- **Conventional Commits in English** (`feat(scope): …`); commit/push only when the user asks.
- **Naming:** dirs/files kebab-case · React components PascalCase (named export, `<Name>Props`) · funcs/vars camelCase ·
  types PascalCase · constants/env UPPER_SNAKE · DB columns/API fields snake_case. **ESM, Node ≥ 22.**
- **Format = Prettier** (`semi:true`, singleQuote, printWidth 100, tabWidth 2, trailingComma all) from the skill's
  `templates/`; run `prettier --write` before committing.
- **Install the `commit-msg` + `pre-commit` hooks** from the skill's `hooks/` at repo-init (commit-msg enforces
  Conventional Commits + lowercase description; pre-commit reminds to update docs).

## Frontend — skill `/react-ui-craft` (MANDATORY for any React/Next UI)

The shared frontend engineering standard — complements `/coding-convention` (that owns naming/commits/Prettier; this owns
architecture/composition/state/motion/UX-states/security). `SKILL.md` + 5 refs (`architecture`/`components`/`motion`/`ux`/
`security`): read SKILL first, open a ref when needed.
- **Stack (running in `todo`):** React 19 (Server Components, Actions, `use`, `useActionState`, `useOptimistic`,
  ref-as-prop — **NO `forwardRef`**) + Next.js App Router *or* React+Vite + Tailwind v4 (tokens via `@theme`+OKLCH, **no
  `tailwind.config.js`**) + shadcn/ui (own the components, theme via CSS vars) + Motion v12 (`motion/react`) + TS. A
  different stack → keep the principles, don't force a rewrite.
- **7-step:** ① frame job+data → ② plan structure (boundaries, server/client) → ③ scaffold SYSTEM (tokens+primitives)
  before screens → ④ compose (small components, props-as-API, `cn()`) → ⑤ motion last → ⑥ handle EVERY state
  (loading/empty/error/optimistic) → ⑦ self-review vs the quality floor + security.
- **Quality floor (ship by default):** accessible (semantic HTML, labeled controls, `focus-visible`, contrast ≥4.5:1) ·
  responsive ≥360px · motion-safe (`prefers-reduced-motion`) · type-safe (no `any` at the boundary, parse with Zod) ·
  performant (animate only `transform`/`opacity`, lazy-load heavy) · secure.
- **Security (read `references/security.md` first):** no secret in the client bundle (only `NEXT_PUBLIC_*`/`VITE_*` reach
  the client = public); no unsanitized `dangerouslySetInnerHTML`; a Server Action/Route Handler MUST auth + Zod-validate
  server-side; the client gets only a minimal DTO; `npm audit` clean of high/critical; no stack trace in prod.
- **Mandatory UI:** shadcn/ui only (don't hand-roll) · dark/light via CSS vars, **no hardcoded colors** · toast via sonner ·
  icons via lucide · build the reusable thing ONCE (shared stock, don't duplicate).

## In-app user guide — skill `/user-guide` (MANDATORY for any app with a UI)

Ship an in-app `/guide` page, task-oriented. **One tab per machine-facing integration:** Discord bot/webhook → a Discord
tab (setup, command table, notification types, troubleshooting); MCP server → an MCP tab (endpoint+auth, how to connect,
tool table, safety). Keep tabs in sync with code (new command/tool ⇒ update the tab in the same change). Reference:
`todo/app/guide/page.tsx`.

## Code reuse across projects — skill `/code-reuse`

Independent repos (no monorepo) → reuse isn't free, but reinventing wastes tokens+time. **Before building a feature:** read
the catalog **`nuc-platform/08-SHARED-ASSETS.md`** + grep sibling projects for prior art first. **Rule of three:** 1× build
local · 2× log as DUPLICATED · 3× same-shape+stable ⇒ extract (earlier = premature coupling). **Hybrid share:** visual →
`ui-kit` copy-in; heavy+stable+security glue (e.g. the MCP OAuth shim, dup'd todo↔yakudoku) → a `@thiengthb/*` package
(baked at CI build); lighter → copy-in/template. Extract the **glue**, keep the **feature** local. Any reuse/extraction MUST
update `08-SHARED-ASSETS.md` in the same change.

## Documentation & Knowledge OS — skills `/project-docs` `/project-plan` `/session-wrap`

Full standard: **`nuc-platform/05-documentation-standard.md`**. Goal: understand a project in one cheap read; knowledge accumulates
across sessions instead of evaporating.
- **Context-loading path (3 tiers):** `INVENTORY §0` → `<project>/docs/00-map.md` (AI-primer, always read first on entry)
  → `docs/` + `docs/decisions.md` (only when the task needs it). **Keep each `CLAUDE.md` thin** (rules+invariants+pointers);
  heavy spec lives in `docs/` (it costs context every turn).
- **Two pillars per project:** `docs/00-map.md` (essence·modules·flows·invariants·secrets) + `docs/decisions.md`
  (append-only why-log). A web-app adds `01-product`/`02-technical`/`03-user-guide` (05 §3).
- **Multi-session work** (feature/refactor/migration/hard bug) → persist a plan via `/project-plan` in
  `docs/plans/YYYY-MM-DD-<slug>.md` (complements `/plan` mode; small same-session changes get no file).
- **Skills:** `/project-docs` scaffolds/audits the doc-set · `/project-plan` persists a multi-session plan · `/session-wrap`
  closes a session (write `decisions.md`, update `00-map`, distill finished plans, add a cross-project line to
  `06-knowledge-ledger.md`). Infra traps → `02-known-traps`.
- **Convention:** end of a substantial pass → `/session-wrap`; a non-obvious decision → `decisions.md` (same commit).
  The pre-commit hook reminds (non-blocking) when code changes but docs don't.

## Thinking & process

- **`/brainstorming`** — at the START of a non-trivial feature/design/refactor: frame the real problem, 2-3 distinct
  approaches + tradeoffs, recommend with reasoning. Diverge → converge into `/project-plan`.
- **`/honest-critique`** — at DECISION points (user proposes / asks "should I…" / you're about to agree): truth over
  comfort, lead with the counter-case, separate fact from preference, red-team your own output, concede fast. **No
  reflexive "You're absolutely right!"** — the user values honest pushback.
- **Before claiming done / committing:** `/lint-and-validate` (lint+types+audit, incl. Python) →
  `/verification-before-completion` (run it, read the output, THEN claim — evidence, not "should work").
- **Debugging:** `/systematic-debugging` — root cause before any fix; ≥3 failed fixes ⇒ question the architecture.

> **Reference skills (auto-fire by topic):** data → `/prisma-expert`+`/database-design` · React perf →
> `/react-best-practices` · Dockerfile → `/docker-expert` · MCP → `/mcp-builder` · external-API →
> `/api-integration-specialist` · Python async → `/async-python-patterns` · system decision → `/architecture` ·
> deps → `/dependabot-review`+`/supply-chain-guard` · testing →
> `/vitest-server-actions`+`/playwright-e2e-builder` · authoring a skill → `/skill-authoring`. Catalog + verdicts:
> `nuc-platform/07-SKILL-CANDIDATES.md`.

## Model routing — staff work by weight (token discipline)

Model choice is a **session-level** decision, NOT per-task. Do NOT make a habit of analyzing each task and asking to
switch model mid-conversation — switching re-reads the FULL history at the new model and **drops the prompt cache**
(thrashing *costs* tokens, doesn't save them), and the agent cannot switch its own model anyway (only the user can).
- **`/model` picker gotcha:** **Enter = persists to `~/.claude/settings.json` → new default for ALL future/other
  sessions** (easy to accidentally make a weak model the global default); press **`s`** to switch the current session
  ONLY. Concurrent sessions are independent until they relaunch.
- **Session rubric (set once, at start):** architectural / security / multi-file reasoning / ambiguous / UI-craft / a
  codebase a strong model already shaped → **Opus** (a weak model contaminates strong-model work — the risk is
  asymmetric, lean Opus when unsure). A whole session of well-specified bulk-mechanical work → Sonnet is fine.
- **The real token lever (no quality tradeoff):** keep **Opus as the main loop = orchestrator + reviewer**, and delegate
  heavy-but-mechanical work (wide reads, fan-out search, bulk transforms, migrations) to **subagents on a cheaper model**
  via the Agent tool's per-agent `model: 'sonnet'|'haiku'`. Subagent context is isolated (doesn't bloat the main thread —
  the real cost saving) and Opus **reviews the output before accepting it**, so the weak model works in a sandbox under
  review and never commits unreviewed. Set `model:` per delegation; do NOT flip `CLAUDE_CODE_SUBAGENT_MODEL` globally
  (that's a cross-session side-effect).
- **Only suggest the user switch** when the WHOLE session is clearly mismatched (e.g. a long bulk-mechanical run on
  Opus) — suggest once, and tell them to use **`s`** (session-only) so they don't overwrite their global default.

## Project lifecycle & ops — use the right skill, don't improvise

| When | Skill | Key points |
|------|-------|-----------|
| New project / onboard to NUC | **`/nuc-new-project`** | gather info → Dockerfile → workflow → push & verify image → create `/opt/apps/<name>` → acceptance |
| Remove / decommission | **`/nuc-remove-project`** | delete local code → tear down container+volume+image+dir → clean Authentik provider/group → verify the subdomain 404s → update `INVENTORY.md`+`auth-apps.md`; confirm data loss + no impact first |
| Health audit / cleanup | **`/nuc-health-audit`** | reconcile `INVENTORY.md` vs reality (drift, orphan volume/image, hanging provider), subdomains alive, Watchtower, disk/RAM, secret hygiene; **report only** — every destructive action asks the user |
| Protect an app (login/SSO/authz) | **`/nuc-protect-app`** | forward-auth gate / group policy / in-app authz via `X-authentik-*` (`headers()` in Next). Registry + traps: `authentik/docs/auth-apps.md` |
| Web is broken | debug by layer | DNS → tunnel → Traefik → app, symptom table in `01-architecture-and-operations §7`; pinpoint the failing layer before fixing |
