# MiniServer — Shared rules for every project in this folder

Every project in `D:\Projects\MiniServer\` is deployed to the NUC `thienminiserver`
following a fixed architecture (built 2026-06-07):

```
git push main → GitHub Actions build → ghcr.io/thiengthb/<repo> (:latest + :<sha>)
→ Watchtower on the NUC auto-pulls (≤60s) → Traefik route → Cloudflare Tunnel → *.thientnse.site
```

Full docs: `nuc-platform/01-KIEN-TRUC-VA-VAN-HANH.md` (operations),
`02-MO-XE-LOI-HE-THONG-CU.md` (known traps), `03-SETUP-FROM-SCRATCH.md` (rebuild).
**`nuc-platform/INVENTORY.md` = the SINGLE source of truth** for every app/volume/domain/auth/monitor —
read it before touching a project lifecycle; every add/remove-app skill MUST update it (anti-drift).
**User reports the NUC was reset / the system needs rebuilding → read and follow
`nuc-platform/04-AGENT-RUNBOOK-TAI-THIET.md` (the agent runbook).**

## Invariants — MUST NOT be violated in any project

1. **The NUC only PULLs images.** No self-hosted runner, no SSH-deploy from CI,
   no building on the NUC (except deliberate firefighting).
2. **One shared Docker network `edge`.** Infra (`/opt/infra`) CREATES it; every app
   references `external: true`. Apps do NOT publish ports to the host — only Traefik
   reaches apps over the network.
3. **Public/private = label.** Traefik `exposedbydefault=false`; an app is public if
   and only if it has the 4 `traefik.*` labels. A new subdomain does NOT need to touch
   Cloudflare (the wildcard `*.thientnse.site` already catches it).
4. **Secrets live only in `.env`** (chmod 600) + `.env` must be in
   `.gitignore`. Never hardcode a token/key into compose, Dockerfile, or code.
5. **Dual image tag `latest` + short git-SHA.** Rollback = pin the SHA tag in the
   compose on the NUC, do not revert git.
6. **TLS is handled by Cloudflare.** Do not configure Let's Encrypt/certbot anywhere.
7. **Traefik ≥ v3.7, Watchtower must have `DOCKER_API_VERSION=1.44`** (Docker 29
   on the NUC dropped API < 1.40 — a violation fails silently, see doc 02).
8. **Authentication = Authentik** (IdP at `auth.thientnse.site`, `/opt/apps/authentik`).
   Do NOT self-code login / password hashing / JWT signing / session minting in the app. Protect an app =
   forward-auth via Traefik (middleware `authentik@docker`); authorization = the app reads the
   `X-authentik-*` headers. **NEVER** put forward-auth on an endpoint that a machine client calls automatically.
   Authentik is a prebuilt image — do NOT attach a Watchtower label (update manually, bump
   `AUTHENTIK_TAG`). Link users by **email**.

## Conventions

- GitHub repo: `thiengthb/<repo>`, deploy branch: `main`.
- Every repo must have: a `Dockerfile` (with `EXPOSE <port>` + `HEALTHCHECK` where possible)
  and `.github/workflows/deploy.yml` (standard: copy from a living ghcr app — `nuc-monitor` or `todo`).
- On the NUC: an app lives at `/opt/apps/<name>/` with `docker-compose.yml` + `.env` +
  `.gitignore`. The compose in the repo (if any) is for local dev ONLY.
- App data: a named volume (e.g. `<name>_data`) — no bind-mount, not inside the container.
- SSH NUC: `ssh thien25@thienminiserver` (key installed; user is in the docker group).
- **Language = English everywhere for dev artifacts** (code, comments, `docs/*.md`, skills, specs,
  commit messages). End-user-facing UI copy stays in the product's chosen language (e.g. Vietnamese for
  `todo`); the in-app guide page is the one user-facing place exempt from the English rule.

## Coding convention — MANDATORY when writing/editing code in any project

Before writing code, scaffolding a frontend, or committing in ANY project in this folder,
follow the skill **`/coding-convention`** (`.claude/skills/coding-convention/SKILL.md`). A summary of
the non-negotiable rules (details + checklist in the skill):

- **Git commit = Conventional Commits, in English** (`feat(scope): ...`). Commit/push only when the user asks.
- **Naming:** directories & files kebab-case; React components PascalCase named-export with `<Name>Props`;
  functions/variables camelCase; type/interface PascalCase; constants & env UPPER_SNAKE; DB columns/API fields snake_case.
  Comments and code in English. ESM everywhere, Node ≥ 22.
- **Frontend = skill `/react-ui-craft`** (the shared frontend engineering standard — see the dedicated section just below).
  Reference stack (running in `todo`): Next.js App Router + React 19 + TS + shadcn/ui (style `radix-nova`,
  CSS variables) + Tailwind v4 + **Motion v12** + Inter (sans, with a vi subset) + Geist Mono + lucide + sonner +
  next-themes, alias `@/`, helper `cn()`; data = Prisma + server actions, no separate Express.
- **Mandatory UI:** use only shadcn/ui components (don't hand-roll raw ones); dark/light mode via CSS
  variables — **no hardcoded colors**; responsive mobile-first; toast via sonner, icons via lucide.
- **React:** function components + hooks (Rules of Hooks, effects with full dependencies + cleanup, stable `key`,
  minimal state, full loading/error/empty states) + general conventions (const/===/early-return/async-await, avoid `any`).
- **Format = Prettier** (shared config: `semi:true`, singleQuote, printWidth 100, tabWidth 2, trailingComma all)
  from `.claude/skills/coding-convention/templates/`. Run `prettier --write` before committing.
- **Each repo installs the `commit-msg` + `pre-commit` hooks** from `.claude/skills/coding-convention/hooks/`
  (commit-msg enforces Conventional Commits + lowercase description; pre-commit reminds to update docs) —
  install at repo-init time for EVERY project (already installed for `todo`).

## Frontend — shared engineering standard, MANDATORY when a project has React/Next (skill `/react-ui-craft`)

Every project with a **React/Next** UI in this folder follows the skill **`/react-ui-craft`**
(`.claude/skills/react-ui-craft/` — `SKILL.md` + 5 references: `architecture` / `components` / `motion` /
`ux` / `security`). This is the **shared frontend engineering standard**; it COMPLEMENTS `/coding-convention`
(clear division: coding-convention handles naming + commits + Prettier + commit-msg hook; react-ui-craft
handles architecture + composition + state + motion + UX states + frontend security). Opening frontend work →
read `SKILL.md` first, open a reference when needed. This skill is **engineering** (how to build it well);
pure visual inspiration (palette/typography/layout) goes with the `frontend-design` skill if available.

- **Standard stack:** React 19 (Server Components, Actions, `use`, `useActionState`, `useOptimistic`,
  ref-as-prop — NO `forwardRef`) + Next.js App Router *or* React+Vite SPA (decide early since it shapes the
  data layer + security) + Tailwind v4 (tokens via `@theme` + OKLCH, NO `tailwind.config.js` unless a
  plugin needs it) + shadcn/ui (components you OWN, theme via CSS variables) + **Motion v12** (`motion`,
  `import { motion } from "motion/react"`) + TypeScript. A different stack (CSS Modules, MUI…) → KEEP THE
  PRINCIPLES, translate the specifics, do NOT force a rewrite.
- **7-step process (in order — skipping the plan produces messy components + uneven spacing):** ① frame the
  screen's single job + data source → ② plan the structure before coding (component boundaries, server/client)
  → ③ scaffold the SYSTEM (tokens + reusable primitives) BEFORE screens → ④ build by composition (small
  components, props as API, `cn()`) → ⑤ motion LAST, with intent → ⑥ handle EVERY state
  (loading/empty/error/optimistic/ideal) → ⑦ self-review against the quality floor + `references/security.md`.
- **Quality floor (ship by default, NOBODY needs to remind you):** accessible (semantic HTML, labeled
  controls, `focus-visible`, contrast ≥4.5:1, `aria-*` when semantics are missing) · responsive ≥360px mobile-first ·
  motion-safe (respect `prefers-reduced-motion` wherever there's animation) · type-safe (no `any` at the boundary,
  parse with Zod instead of casting) · performant (animate only `transform`/`opacity`, lazy-load heavy things,
  `LazyMotion` when needed) · secure.
- **Security (read `references/security.md` BEFORE shipping):** no secret in the client bundle (only
  `NEXT_PUBLIC_*`/`VITE_*` reach the client — treat them as public); no unsanitized `dangerouslySetInnerHTML`;
  a Server Action/Route Handler MUST auth + validate (Zod) on the server (don't trust the client); the client
  receives only a minimal DTO; `npm audit` clean of high/critical; no stack trace exposed in production.
- **Two habits that keep the bar high:** build the reusable thing ONCE (put it into the shared component
  stock, don't duplicate — consistency reads as "designed"); self-critique your output like a tough reviewer before handing it off.

## In-app user guide — MANDATORY for every app with a UI (skill `/user-guide`)

Every app with a frontend MUST ship an in-app guide page (route `/guide`), following the skill
**`/user-guide`**. It is task-oriented (walk through screens + actions). **One dedicated tab per
machine-facing integration**: if the app has a **Discord** bot/webhook → a Discord tab (setup, command
table, notification types, troubleshooting); if it exposes an **MCP** server → an MCP tab (endpoint + auth,
how to connect, tool table with examples, workflow/safety). Keep the tabs in sync with the code (a new
command/tool ⇒ update the tab in the same change). Living reference: `todo/app/guide/page.tsx`.

## Documentation & knowledge — MANDATORY for every project (Knowledge OS)

Full standard: **`nuc-platform/05-TAI-LIEU-CHUAN.md`** (read it when touching docs). Purpose: an agent
**understands a project in one cheap read**, and non-obvious knowledge **accumulates across sessions**
instead of evaporating.

- **The context-loading path — 3 tiers (invariant):** `INVENTORY §0` (index) → `<project>/docs/00-map.md`
  (AI-primer, 1 page, ALWAYS read first when entering a project) → `docs/` in depth + `docs/decisions.md`
  (only when the task needs it). Each project's `CLAUDE.md` stays **thin** (rules + invariants + pointers) —
  do NOT stuff the module map/flows/spec into it (it costs context since it auto-loads every turn); heavy
  spec lives in `docs/`.
- **Two pillars every project has:** `docs/00-map.md` (essence · module map · flows · highlights ·
  invariants · secrets) + `docs/decisions.md` (knowledge log: decisions + traps + **why**, append-only). A
  web-app adds the `01-product`/`02-technical`/`03-user-guide` set (tiered by `kind` — see 05 §3).
- **Forward roadmap:** substantial **multi-session** work (feature/refactor/migration/hard bug fix) gets a persisted plan
  in `docs/plans/YYYY-MM-DD-<slug>.md` via the skill **`/project-plan`** — the prospective counterpart to `decisions.md`
  (05 §5.5). Complements plan mode (`/plan` researches + approves in-session; the file persists the roadmap across
  sessions). Small same-session changes do NOT get a plan file. When a plan closes, `/session-wrap` distills its "why"
  into `decisions.md`.
- **Skills:** **`/project-docs`** generates/syncs the doc-set (scaffold + audit drift) · **`/project-plan`** persists a
  multi-session plan in `docs/plans/` · **`/session-wrap`** wraps a session → write `decisions.md`, update `00-map`, close
  any finished plan + distill it, add a line to `06-SO-TRI-THUC.md` if cross-project.
  Cross-project lessons → the index `nuc-platform/06-SO-TRI-THUC.md`; **infrastructure** traps → `02-MO-XE-LOI`.
- **Convention:** at the end of a substantial editing pass → run `/session-wrap`; a non-obvious decision →
  `decisions.md` (in the same commit as the code). The pre-commit hook reminds (non-blocking) when code changes but docs don't.

## When creating a new project / bringing a project onto the NUC

Use the skill **`/nuc-new-project`** — it runs the correct process: gather info →
Dockerfile → workflow → push & verify image → create `/opt/apps/<name>` → acceptance.
Don't improvise a different process.

## When removing / decommissioning a project

Use the skill **`/nuc-remove-project`** — the reverse of `nuc-new-project`: delete local code →
tear down container + volume + image + dir on the NUC → clean up Authentik (if it has its own provider/group) →
verify the subdomain 404s → update `INVENTORY.md` + `auth-apps.md` → guide the user to delete the GitHub
repo + ghcr. Safety first: confirm the data loss + no impact on other services before tearing down.

## When auditing system health / cleaning up

Use the skill **`/nuc-health-audit`** — reconcile `INVENTORY.md` against reality, catch drift + orphans
(orphan volume, dangling image, hanging Authentik provider), check every subdomain is alive, Watchtower,
disk/RAM, secret hygiene. Read & report only; every destructive action (deleting a volume/image) must ask the user.

## When protecting an app (login / SSO / authorization)

Use the skill **`/nuc-protect-app`** — login gate (forward-auth), restrict who can enter (group
policy), or in-app authorization (the `X-authentik-groups` header). The registry of every provider/app
+ known traps: the `authentik/` repo (especially `authentik/docs/auth-apps.md`). In-app authorization =
read the `X-authentik-*` headers via `headers()` in Next.js (no living example yet — the first app to do it
becomes the reference). Don't improvise another auth mechanism.

## When the web is broken

Debug by layer DNS → tunnel → traefik → app, using the symptom table in
`nuc-platform/01-KIEN-TRUC-VA-VAN-HANH.md` section 7. Don't fix blindly before pinpointing
which layer the request dies at.
