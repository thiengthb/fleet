---
name: playwright-e2e-builder
description: Plan and build Playwright end-to-end test suites for a MiniServer web-app (Next.js App Router + Prisma + server actions) — interview-driven planning, Page Object Model, role-based locators, a temp-SQLite test DB seeded via Prisma, and a sharded GitHub Actions e2e workflow. Adapted to this platform's auth model (Authentik forward-auth, NO in-app login form). Use when adding E2E tests, testing critical user flows end-to-end, or when the user says "set up Playwright / write e2e tests". Complements /vitest-server-actions (unit/integration).
---

# Skill: Playwright E2E builder (platform-adapted)

E2E = drive the app in a real browser through critical user flows. Pairs with `/vitest-server-actions` (which mocks
Prisma for fast unit/integration tests); use E2E for the few high-value flows that are worth the slowness. Living
reference app: `todo` (web-app). Mirror its real routes/components, not invented ones.

> **Adapted from** the community skill `development/playwright-e2e-builder` (`davila7/claude-code-templates`). The bones
> (interview-driven planning, POM, role-based locators, storageState, sharding) are kept; the **auth model, test-data
> seeding, and CI are rewritten for this platform** — see the three boxes below. That generic skill assumes an in-app
> login form, REST CRUD endpoints, and Postgres; none of those match here.

## Three platform corrections (do NOT use the generic patterns)

1. **Auth = Authentik forward-auth, NOT an in-app login form.** Protected apps (e.g. `todo`, group `todo-access`) are
   gated by Traefik at the edge; **the app has no `/login` page** and does not mint sessions. Locally and in CI there is
   no Traefik, so the app runs **open at the app layer** → most E2E tests need **no auth setup at all**. The generic
   "UI login → storageState" dance does not apply. *Only* if an app does in-app authorization by reading `X-authentik-*`
   headers (no living example yet) do you simulate a user — inject those headers via a Playwright project's
   `extraHTTPHeaders` (see `templates/playwright.config.ts`), never by scripting Authentik's login UI.
2. **Seed test data via Prisma, NOT a REST API client.** The apps use **server actions**, not REST CRUD endpoints, so
   there's no `/api/resources` to POST to. Seed and reset directly through the Prisma client against the test DB
   (`templates/seed.ts`), exposed as a fixture (`templates/fixtures.ts`).
3. **Test DB = a temp SQLite file, NOT Postgres.** The data layer is SQLite (`provider = "sqlite"`, `env("DATABASE_URL")`).
   Point `DATABASE_URL` at a throwaway file, `prisma migrate deploy` + seed before the run — no Postgres service container.

## Phase 1 — Explore (plan mode)

Enter plan mode. Read the real project: stack + whether Playwright is already installed; the actual routes
(`app/**/page.tsx`); the real components + any `data-testid`; the dev command/port (`next dev`, 3000); the Prisma schema
(provider, models to seed); existing `.github/workflows/`. Do NOT assume the generic skill's routes (`/login`,
`/dashboard`, `/resources`) — use what's there.

## Phase 2 — Interview (AskUserQuestion)

Clarify before writing. Ask in rounds — but skip questions the platform already answers:

- **Critical flows** (multiSelect): which real user journeys matter (for `todo`: add task → mark done → score emotion →
  streak updates). This is the one question that always matters.
- **App auth at the app layer**: "open (forward-auth handles access; app is open locally)" [default for current apps]
  vs "reads `X-authentik-*` headers for in-app authz" → if the latter, plan an injected-headers project.
- **Visual regression**: usually "no, functional only". Yes only if a layout is worth pixel-locking.
- **Skip** the generic skill's "auth type / test-auth / test-data-via-API / environment" rounds — the platform fixes
  those (forward-auth, Prisma seeding, local dev server + temp SQLite).

## Phase 3 — Plan (ExitPlanMode)

Concrete plan: directory layout (`e2e/`), `playwright.config.ts` (projects, webServer, baseURL), seed strategy
(temp SQLite + Prisma), page objects per real screen, fixtures, the test files per chosen flow, and the `e2e.yml`
workflow. Present via ExitPlanMode for approval.

## Phase 4 — Execute

Install: `npm i -D @playwright/test && npx playwright install --with-deps chromium`. Copy the templates and adapt:

- **`templates/playwright.config.ts`** — `baseURL` localhost:3000; `webServer` runs `npm run dev` with the test
  `DATABASE_URL`; `chromium` + a `mobile` project; trace/screenshot/video on failure; a commented `authenticated`
  project showing `extraHTTPHeaders` for the `X-authentik-*` path. No `storageState` for open apps.
- **`templates/seed.ts`** — create + reset deterministic data through Prisma. Run it (and `prisma migrate deploy`)
  against the temp DB before tests.
- **`templates/fixtures.ts`** — extend `test` with page objects + a `db` seeding helper (Prisma-backed, not REST).
- **`templates/example-page.ts`** — Page Object Model, **role-based locators** (`getByRole`/`getByLabel`/`getByText`),
  fall back to `getByTestId` only when needed; never raw CSS.
- **`templates/e2e.yml`** — separate workflow (E2E is heavy), Node 22, temp SQLite + `prisma migrate deploy` + seed,
  `playwright install chromium`, sharded run, upload `playwright-report/`. Keep it **separate from `deploy.yml`**
  (don't block the ghcr build on slow browser tests); it runs on PR + push to main as its own gate.

Add to `.gitignore`: `e2e/.auth/`, `test-results/`, `playwright-report/`, `blob-report/`, and the test DB file
(e.g. `e2e/.test.db`).

## Non-negotiable practices (the generic skill got these right — keep them)

- **Role-based locators first** — mirrors how users (and a11y) see the page; resilient to refactors. Matches the
  `/react-ui-craft` accessibility floor.
- **Never `page.waitForTimeout()`** — wait for a URL, an element state, or a response (`waitForResponse`, `toBeVisible`).
- **Each test seeds + cleans its own data** — no shared mutable state; reset the DB (or the touched rows) per test/file.
- **Capture trace/screenshot/video on failure** for debugging; **shard** in CI for parallelism.
- Files kebab-case, page-object classes PascalCase, English test names stating behavior (per `/coding-convention`).
- Bar from `verification-before-completion`: `npx playwright test` passes locally before you call it done — paste the run.

## Checklist before finishing

- [ ] `playwright.config.ts` `webServer` starts `next dev` with the **test** `DATABASE_URL` (not the real data).
- [ ] Test DB is a temp SQLite file, migrated + seeded before the run, and gitignored.
- [ ] No in-app-login scripting; open apps use no auth, header-authz apps use `extraHTTPHeaders`.
- [ ] Seeding goes through Prisma (`templates/seed.ts` / the `db` fixture), not a REST client.
- [ ] Role-based locators; zero `waitForTimeout`; per-test data isolation.
- [ ] `e2e.yml` is separate from `deploy.yml`, Node 22, sharded, uploads the report.
- [ ] `npx playwright test` green locally before pushing.
