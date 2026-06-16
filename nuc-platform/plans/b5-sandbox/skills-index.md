Total skills indexed: 36

# Skills Index (B5 loop-smoke)

| Skill | One-line description |
|-------|----------------------|
| api-integration-specialist | Build robust clients for third-party APIs from a worker/bot or app — OAuth2 / API-key auth, retry with backoff, client-side rate limiting, webhook signature verification, pagination, and typed error handling. |
| architecture | A decision framework for SYSTEM-level / architecture choices — frame requirements + constraints, weigh 2-3 options by trade-off, pick the simplest that works, and record the rationale in docs/decisions.md. |
| async-python-patterns | asyncio concurrency for Python workers/bots — tasks & TaskGroup, gather, bounded concurrency (Semaphore), timeouts, queues + backpressure, structured cancellation, and testing async code. |
| auto-pilot | Run ONE bounded, unattended batch of an already-approved plan in a FRESH context — read the plan from disk, advance the next few safe-zone steps on a dedicated branch, commit LOCALLY, then PARK at the first gate. |
| brainstorming | Explore the solution space before committing to a build — frame the real problem, generate 2-3 genuinely distinct approaches with tradeoffs, recommend one with reasoning, validate incrementally. |
| code-reuse | Before building a feature in any MiniServer project, check whether it already exists elsewhere and decide reuse-vs-rebuild — a piece built ≥3× becomes a shared asset, not reinvented. |
| coding-convention | Mandatory coding convention for every MiniServer project — naming, git commits (Conventional Commits, English), and the required frontend stack/UI. |
| database-design | Vendor-neutral database DESIGN judgment for a MiniServer app — choosing the database, schema/normalization, relationship modeling, indexing strategy, and avoiding N+1 before it's written. |
| dependabot-review | Triage open Dependabot PRs — classify by risk (patch/minor/major + security), check CI, and present a recommended action per PR. |
| docker-expert | Author and optimize a single app's Dockerfile — multi-stage builds, layer-cache ordering, small/secure base images, non-root user, EXPOSE + HEALTHCHECK, .dockerignore, BuildKit cache. |
| honest-critique | Replace reflexive agreement with honest evaluation — challenge the user's idea, red-team your own plan/answer before handing it off, name tradeoffs, and separate fact from preference. |
| idea | Manage the platform's living idea backlog in nuc-platform/10-idea-queue.md — capture, gate+score+rank, deep-analyze the top idea into a proposal, push back on biased/infeasible/duplicate ideas. |
| lint-and-validate | Run lint + typecheck + audit after a code change and fix the findings before claiming done — Node/TS (eslint, tsc, npm audit) and Python workers (ruff, mypy, bandit). |
| mcp-builder | Build a high-quality MCP (Model Context Protocol) server so an LLM can use a service's tools — design discoverable tools with typed input/output schemas + annotations. |
| memory | Read or write the agent's persistent memory about the user. |
| nuc-health-audit | Health-check & sync the NUC platform — reconcile INVENTORY.md against reality (container/volume/route/Authentik), find orphans, check subdomains alive, Watchtower scanning, disk/RAM, secret hygiene. |
| nuc-new-project | Bring a new project (or an existing one in MiniServer) onto the NUC platform along the standard trajectory - GitHub Actions build ghcr.io, Watchtower auto-pull, Traefik route, Cloudflare wildcard. |
| nuc-protect-app | Protect an app on the NUC platform with Authentik SSO (require login via forward-auth, restrict who can access by group, or authorize within the app). |
| nuc-remove-project | Remove/retire a project from the NUC completely & safely — delete local code, tear down container + volume + image + dir, clean Authentik config, verify the subdomain is dead. |
| nuc-scheduled-maintenance | Decide what recurring NUC-platform maintenance is worth automating and wire it via /schedule — periodic health-audit, Dependabot triage, dependency/secret-hygiene drift. |
| nuc-set-env | Securely push environment variables / secrets into a NUC app's `/opt/apps/<app>/.env` from a LOCAL mirror file over SSH — idempotent upsert, atomic, chmod 600 preserved. |
| playwright-e2e-builder | Plan & build Playwright E2E suites for a MiniServer web-app (Next.js App Router + Prisma + server actions) — Page Object Model, role-based locators, temp-SQLite DB seeded via Prisma. |
| prisma-expert | Prisma ORM depth for a MiniServer web-app — schema & relations design, migrations (dev vs deploy), N+1 / query optimization, and transactions. |
| project-docs | Generate & sync a project's standard doc set (00-map AI-primer, decisions log, + the 01/02/03 set for web-apps) per nuc-platform/05-documentation-standard.md. |
| project-plan | Capture a substantial multi-step plan (feature, refactor, migration, hard bug fix) as a persisted file under docs/plans/ so the roadmap survives across sessions. |
| react-best-practices | React/Next.js PERFORMANCE rule catalog (Vercel) — eliminating data waterfalls, bundle-size cuts, server-side caching, re-render and rendering optimization. |
| react-ui-craft | Engineering standard for React/Next.js (App Router) UIs — Tailwind v4 + shadcn/ui, well-composed components, Motion animations, UX states (loading/empty/error), maintainable architecture. |
| session-wrap | Wrap up a work session on a MiniServer project — distill non-obvious knowledge into docs/decisions.md, update docs/00-map.md if the module map changed, add a line to nuc-platform/06-knowledge-ledger.md. |
| skill-authoring | How to author a new skill, adopt a community skill, or fold an idea into an existing one — on this platform, without bloating context or violating invariants. |
| skill-proposer | Induce a DRAFT skill from a process the agent has repeated ≥3× and PROPOSE it for human review — never install it. |
| supply-chain-guard | Audit a project's dependencies + CI/CD for supply-chain compromise and harden against it — across npm/PyPI workers and the GitHub Actions → ghcr pipeline. |
| systematic-debugging | Use when encountering any bug, test failure, or unexpected behavior, before proposing fixes — find the root cause first instead of guessing. |
| testing-standard | Route a change to the right testing tier and spec discipline per the platform standard (nuc-platform/11-testing-standard.md). |
| user-guide | Build & maintain the in-app user guide for any MiniServer app with a UI — a /guide page walking through screens + actions; dedicated tabs for Discord/MCP integrations. |
| verification-before-completion | Use when about to claim work is complete, fixed, or passing — before committing, pushing, or reporting done. |
| vitest-server-actions | Set up & write Vitest tests for the MiniServer web stack (Next.js App Router + React 19 + Prisma + server actions) — unit-test pure logic, test server actions by mocking the Prisma singleton. |
