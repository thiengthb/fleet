# 08 — Shared assets catalog (reusable building blocks)

> **The cheap index of "what reusable thing already exists, where its canonical copy lives, and how to reuse it."** Read
> this BEFORE building a feature so you reuse instead of reinventing (saving tokens + dev time). Owned + kept in sync by
> the skill **`/code-reuse`** — every reuse / extraction / newly-noticed duplication MUST update this file in the same
> change (anti-drift, same discipline as `INVENTORY.md`).
>
> Established 2026-06-13. The platform is **independent repos** — reuse is never free; see `/code-reuse` for the
> rule-of-three gate and the hybrid share model, and `references/extraction-playbook.md` for how to extract.

---

## Maturity / status legend

- **PATTERN** — a recurring shape worth copying by hand; no single canonical artifact yet (or not worth extracting).
- **TEMPLATE** — a canonical scaffold to copy from (config/CI/Dockerfile/hooks).
- **REGISTRY** — copy-in shared code with a canonical home (the `ui-kit` model).
- **DUPLICATED — extract candidate** — built ≥2×, near-identical; flagged for extraction once it hits 3× stable.
- **SHARED (package)** — extracted to a published `@thiengthb/*` package; consumed at CI build time.

> Reminder (rule of three): 1× = build local · 2× = log here as DUPLICATED · 3× same-shape + stable = extract.

---

## A. Catalog

| Asset | What it is | Canonical / where | Reused in | Mechanism | Status |
|------|-----------|-----------|-----------|-----------|--------|
| **MCP self-issued OAuth shim (glue)** | OAuth authorize/token/register + issuer/validation for the MCP endpoint — *glue only*, NOT the tool definitions | `todo/lib/mcp/{auth,oauth}.ts` + `todo/app/api/oauth/*` | `todo`, `yakudoku/web` (near-identical: auth 38≈39, oauth 86≈89, token 63≈67, authorize 124≈129, register 32=32) | → **published package** when extracted (heavy + security-sensitive) | **DUPLICATED — extract candidate** (built 2×; extract at 3rd app or now if churn has stopped) |
| **MCP `server.ts` (tool definitions)** | The app-specific MCP tools | per app | — | **stays local** (this is the *feature*, not glue) | PATTERN (do NOT share) |
| **Forward-auth header reader** | Read `X-authentik-email` / `X-authentik-groups` to identify/authorize the user | `todo`, `journal`, `yakudoku/web` (`lib/api.ts`) | 3 apps | copy-in or tiny package | **DUPLICATED — extract candidate** (3 apps; verify same shape before extracting) |
| **Public-router split** | Splitting health/MCP/OAuth/webhook endpoints into their own Traefik router, **exempt from forward-auth** (invariant #8) | `todo`, `journal`, `yakudoku` | 3 apps | PATTERN (compose labels) — see `coding-convention §9`, `authentik/docs/auth-apps.md` | PATTERN (well-documented; no artifact to extract) |
| **Prisma client singleton** | `lib/db.ts` global-cached PrismaClient (avoids hot-reload connection storms) | `todo/lib/db.ts` | `todo`, `journal` | TEMPLATE / copy-in | PATTERN (small; copy-in) |
| **shadcn UI components** | Visual component stock | `ui-kit` (`thiengthb/ui-kit`) | every web-app | **REGISTRY (copy-in)** — already established | REGISTRY |
| **Data pagination control** | Controlled pagination UI (`page`/`pageCount`/`onPageChange` + `…` window); client- or server-side paging | `ui-kit/registry/thiengthb/data-pagination.tsx` (`shadcn add data-pagination`) | `sakubun` (`/items`, `/history`, 2026-07-10) | **REGISTRY (copy-in)** | REGISTRY (built 1×; canonical in ui-kit from the start per user directive — reuse platform-wide) |
| **Page header + field (minimal-UI, ⓘ tooltip)** | `page-header` (eyebrow/h1/description-as-hover-tooltip/action/back) + `field` (label+control+ⓘ) + `info-tooltip` (hover/focus Radix tooltip, wrap+`line-clamp`) + `truncate`. `info-tooltip` = hover sibling of the click-Popover `info-hint`; `page-header`/`field` point at it | `ui-kit/registry/thiengthb/{page-header,field,info-tooltip,truncate}.tsx` (`shadcn add page-header`) | `sakubun` (all pages, 2026-07-10) | **REGISTRY (copy-in)** | REGISTRY (info-tooltip added 2026-07-10; needs the shadcn `tooltip` primitive, not `popover`) |
| **Semantic-tone tokens + score/progress ring** | OKLCH `--ok/--warn/--alert` tokens via `@theme inline` + a reusable SVG ring primitive; color-codes state (a11y carried by emoji+label, not color alone); CSS-only animation (no `motion` dep) | `todo` (UI-renovation 2026-06-14: `progress-ring`/`progress-bar` + tokens) | `todo`, `yakudoku/web` (`ScoreRing` + `--ok/--warn`, slice F 2026-06-20), `sakubun` (tokens only, 2026-07-06) | copy-in (→ `ui-kit` at the 3rd app) | **DUPLICATED — 3× reached (tokens)** — extract the token block to `ui-kit` next time any of the three touches theming (ring still 2×) |
| **MCP tool guard/ok/mcpError wrapper** | The per-tool wrapper (duration log, ZodError → readable soft error, no raw -32603) around `createMcpHandler` registrations | `yakudoku/web/lib/mcp/server.ts` | `todo`, `yakudoku/web`, `sakubun` (2026-07-06, copied verbatim minus auth) | copy-in (tiny, stable) | **DUPLICATED — 3×** but ~30 lines; extraction cost > drift risk, keep copy-in |
| **`deploy.yml` (GitHub Actions)** | Build → push `ghcr.io/thiengthb/<repo>` (`:latest` + `:sha`) | "copy from a living app" — `todo/.github/workflows/deploy.yml`, `yakudoku/.github/workflows/deploy.yml` | every deployed repo | **TEMPLATE** | TEMPLATE |
| **Dockerfile (node multi-stage / python)** | Standard build with `EXPOSE` + `HEALTHCHECK`, base `node:22` | living apps | every repo | TEMPLATE (see `/docker-expert`, `/nuc-new-project`) | TEMPLATE |
| **commit-msg + pre-commit hooks** | Conventional Commits enforcement + docs reminder | `.claude/skills/coding-convention/hooks/` | every repo | **TEMPLATE** (installed at repo init) | TEMPLATE |
| **Prettier config** | Shared formatting (`semi`, singleQuote, printWidth 100…) | `.claude/skills/coding-convention/templates/` | every repo | **TEMPLATE** | TEMPLATE |
| **Discord bot bootstrap** | Gateway connect + command/handler scaffold + allowlist | node: `jobhunter-bot`, `yakudoku-bot`; python: `nuc-monitor`, `nuc-ops-bot` | 4 workers (2 node + 2 python) | PATTERN per language | **DUPLICATED — watch** (different langs; extract only within a language if 3× same-shape) |
| **Consumer-driven contract test (cross-repo HTTP seam)** | Zod-contract + consumer fixture test + provider real-response verify — guards a repo↔repo API from silent drift (fixtures-first, no Pact broker) | `.claude/skills/testing-standard/templates/contract-test.example.ts` | (seams: todo↔core, web↔core, MCP) | **TEMPLATE** (copy-in; broker deferred to ≥2 teams) — standard `11-testing-standard.md §4` | TEMPLATE |

---

## B. How to use this file

- **Building a feature?** Scan column 1 here first. If it's listed → reuse via its mechanism (don't grep, don't rebuild).
- **Found a 2nd copy of something?** Add a row (or flip a row to DUPLICATED) — same change as the code.
- **Extracting?** Follow `/code-reuse` → `references/extraction-playbook.md`; then flip the row to SHARED/REGISTRY with the
  canonical location + consuming repos.
- **Auditing?** `/code-reuse` audit mode reconciles this table against a grep sweep of the projects; `/nuc-health-audit`
  treats a drifted catalog as a finding.
