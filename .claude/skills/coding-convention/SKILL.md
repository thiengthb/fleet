---
name: coding-convention
description: Mandatory coding convention for every MiniServer project — naming, git commits (Conventional Commits, English), and the required frontend stack/UI (Next.js App Router + React 19 + TS + shadcn radix-nova + Tailwind v4 + lucide + sonner + dark/light, Prisma + server actions). Use when creating/editing code, scaffolding a frontend, reviewing before a commit, or when the user asks "is this following convention".
---

# Skill: MiniServer Coding Convention

This is the LAW for writing code in any project under `D:\Projects\MiniServer\`.
It applies alongside the infrastructure invariants in `CLAUDE.md` (deploy/NUC) — this skill
handles the **code & UI** side, not the deploy side.

The living reference for every convention below is the **`todo`** repo (Next.js 16 full-stack — `D:\Projects\MiniServer\todo`).
When unsure "how should I write this", open the corresponding file in `todo` and look — don't invent something new.
(The `link-manager` repo — the old Vite+Express-style reference — was retired 2026-06-11; every reference now points to `todo`.)

If a user request conflicts with a MANDATORY item below → point out the conflict and ask back
before proceeding. Don't silently break the rules.

---

## 1. Git — commit & push

**Commit message = Conventional Commits, written in ENGLISH.**

```
<type>(<scope>): <short description, imperative mood, no trailing period>

[optional body: explain WHY, not WHAT]
```

- `type` ∈ `feat | fix | refactor | chore | docs | test | perf | style | build | ci`.
- `scope` = module/area name (`auth`, `api`, `ui`, `deps`, `docker`…). Omit if generic.
- Description in English, lowercase, ≤ ~72 characters, no trailing period.
- The body (if needed) explains the **reason**, not a restatement of the diff.

Correct examples:
```
feat(auth): add Authentik login via forward-auth
fix(api): handle empty tag returning 500
chore(deps): bump next to 16
refactor(ui): extract link-card into its own component
```

Git operation rules (repeated from the harness, don't forget):
- Do NOT commit/push unless the user asks.
- On the default branch (`main`) and a large change is needed → create a branch first.
- No `--no-verify`, no skipping hooks/signing unless the user explicitly asks.
- One commit = one coherent change idea; don't bundle unrelated work.

---

## 2. Naming convention (full stack)

| Object | Convention | Example |
|---|---|---|
| Directory | kebab-case | `nuc-monitor/`, `components/ui/` |
| React component file | kebab-case `.tsx` | `link-card.tsx`, `theme-toggle.tsx` |
| lib/util/logic file | kebab/lowercase `.ts` | `api.ts`, `auth.ts`, `utils.ts` |
| React component | PascalCase, **named export** | `export function LinkCard(...)` |
| Props interface | `<Component>Props`, declared RIGHT ABOVE the component | `interface LinkCardProps { … }` |
| Function / variable | camelCase | `faviconUrl`, `getAccessToken` |
| Type / interface | PascalCase | `LinkItem`, `StatsGranularity` |
| Module-level config constant | UPPER_SNAKE_CASE | `BASE_URL`, `PORT`, `API_KEY` |
| DB column & API JSON field | snake_case | `created_at`, `last_visited_at` |
| Env variable | UPPER_SNAKE_CASE | `VITE_API_URL`, `CORS_ORIGIN` |

- Comments and code are written in **English** (English everywhere for dev artifacts); use JSDoc `/** … */`
  for non-obvious fields/functions (see `todo/lib/types.ts` as a reference).
- Name things by meaning, no cryptic abbreviations. Match the tone & comment density of the surrounding file.

---

## 3. JavaScript / TypeScript

- **ESM everywhere**: `"type": "module"`, `import`/`export`, no `require`. Node ≥ 22.
  Server-running code (route handler, server action, `lib/*`) uses the `node:` prefix for built-ins (`import fs from 'node:fs'`).
- **TypeScript is mandatory.** No casual `any` — declare interfaces/types in `lib/types.ts` (see `todo/lib/types.ts`).
- Formatting is decided by **Prettier**, no arguing: single quotes `'…'`, **semicolons** (`semi: true`),
  `printWidth 100`, `tabWidth 2`, `trailingComma: all`. Shared config in section 8. Run `prettier --write` before committing.
- The app must pass `npm run lint` (eslint-config-next: core-web-vitals + typescript) clean and `npm run build`
  (`next build`) before it counts as done.
- Secrets are NOT hardcoded — read via `process.env` / `import.meta.env` (repeating platform invariant #4).

---

## 4. Frontend — MANDATORY STACK (identical to `todo`)

Every new app is scaffolded like `todo`. Do NOT swap framework, UI lib, style, or font.

| Component | Must use |
|---|---|
| Framework | **Next.js 16 (App Router, RSC)** + **React 19** + **TypeScript** |
| Build/run | `next build` / `next start`; `output: 'standalone'` in `next.config.ts` (for a small Docker image) |
| UI components | **shadcn/ui**, style `radix-nova`, base color `neutral`, CSS variables (`components.json`, `rsc: true`) |
| CSS | **Tailwind v4** (`@tailwindcss/postcss`, `@import "tailwindcss"` in `app/globals.css`), theme via CSS variables |
| Font | **Inter** (`next/font/google`, subset `["latin","vietnamese"]`) for `--font-sans` + **Geist Mono** for mono. Reason: Geist on Google Fonts has NO Vietnamese subset → use Inter for sans |
| Icon | **lucide-react** — do NOT use another icon set |
| Toast | **sonner** (`<Toaster position="bottom-center" />`, `@/components/ui/sonner`) — no `alert()` / other toast lib |
| Theme | **next-themes** — `<ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>` |
| Data | **Server Actions** (`app/actions.ts`) + **Prisma** (`lib/db.ts`) for mutation/query; **Route Handlers** (`app/api/<x>/route.ts`) for machine/HTTP endpoints. Do NOT stand up a separate Express. |
| Alias | `@/` → root for every internal import (`@/components`, `@/lib/...`, `@/components/ui`) |
| Helper class | `cn()` from `@/lib/utils` (clsx + tailwind-merge) to merge className |

Quick start for a new app: copy the structure from `todo`
(`components.json`, `eslint.config.mjs`, `next.config.ts`, `postcss.config.mjs`, `tsconfig.json`,
`lib/utils.ts`, `app/globals.css`, `app/layout.tsx`), then `npx shadcn@latest add <component>` to add UI.

---

## 5. Frontend — UI RULES (mandatory, non-negotiable)

1. **Only use shadcn/ui components.** Don't hand-write raw `<button>`/`<input>`/dialog.
   Need a component that doesn't exist yet → `npx shadcn@latest add …` then extend, place it in `components/ui/`.
   Business components (composed from ui) go in `components/<name>.tsx`.

2. **Dark/light mode is mandatory.** Every app has a theme toggle (reference: `theme-toggle.tsx`).
   Colors COME FROM shadcn CSS variables (`bg-background`, `text-foreground`, `text-muted-foreground`,
   `border`, `bg-card`…). **Do NOT hardcode colors** like `bg-white`, `text-black`, `#fff`, `bg-gray-900`
   — they'll break in the other theme.

3. **Responsive, mobile-first.** Write base styles for mobile first, scale up with `sm: md: lg:`.
   Every screen must work well on a phone; layout flexes, no horizontal overflow.

4. **Toast = sonner, icon = lucide.** Action feedback (save/delete/error) via sonner's `toast()`,
   not raw `alert()`/`confirm()`. Icons only from `lucide-react`.

5. **Basic a11y & UX:** icon-only buttons have a label/aria; use `<TooltipProvider>` for tooltips;
   loading/empty/error states must have clear UI, never a blank screen.

The standard `app/layout.tsx` reference (ThemeProvider → TooltipProvider → AppShell → children, then `<Toaster>`)
— keep this exact order; see `todo/app/layout.tsx`.

---

## 6. React best practices (mandatory)

Applies to every component. Living reference: `todo/components/*`.

**Server vs Client Component (Next.js App Router)**
- Default is a **Server Component** (runs on the server, fetch/Prisma directly, ships no JS to the client).
  Add `'use client'` at the TOP of the file only when the component needs state/effect/event handler/browser hook.
- Push the `'use client'` boundary as deep as possible (leaf, not root) to keep the bundle small.
  Fetch data in a Server Component then pass primitives down to the Client Component.

**Component & structure**
- Function component + hooks. NO class components. One file = one primary business component
  (named export); small child components can live in the same file.
- Keep presentational components separate from logic; reusable client logic → custom `use*` hook (place in `hooks/`).
- Declare props via a `<Component>Props` interface; destructure in the parameter. Pass primitives/handlers,
  avoid passing large objects across many layers — use Context when needed.
- Keep JSX/component files short; > ~250 lines is a sign you should split.

**Hooks**
- Follow the Rules of Hooks: only call at the top level, not inside loops/conditions. Enable the
  `eslint-plugin-react-hooks` rule (already in the config) and keep it clean.
- `useEffect` must declare ALL dependencies. Effects are only for side-effects (fetch, subscribe, DOM);
  anything derivable from props/state should be computed directly during render, do NOT cram it into effect + state.
- Clean up every subscription/timer/listener/AbortController in the effect's return.
- `useMemo`/`useCallback` only when there's a measurable benefit (large lists, stable ref for a memoized child) —
  don't wrap blindly.

**State & data**
- Minimal state, placed near where it's used; lift it up only when sharing is needed. Don't duplicate data
  that already exists (derived state) into separate state.
- `key` in a list = a stable id, do NOT use the index when the list can reorder/add/remove.
- Update state immutably (spread, map…), don't mutate directly.
- Prefer fetching data in a **Server Component** (call Prisma via `lib/db.ts`) or a **Server Action**
  (`app/actions.ts`); only fetch client-side when truly needed (realtime, after an interaction). Keep business logic
  in `lib/*`, don't cram it into the component.
- Client fetch: handle all 3 states loading / error / empty; show UI for each state (section 5.5).

**Render & a11y**
- Don't create new components/functions inside the render path that cause remounts; define them outside or use useCallback.
- Use semantic HTML (`<button>`, `<nav>`, `<main>`…); operable by keyboard.
- No `dangerouslySetInnerHTML` with unsanitized data.

## 7. General conventions from the major style guides (Airbnb / Google / TS / React)

Distilled to what fits this stack — treat as defaults, deviations need a reason:

- **`const` by default, `let` when reassignment is needed, no `var`.** Don't reassign function parameters.
- **`===`/`!==`** always (except `== null` to deliberately catch both `null` and `undefined`).
- **Early return** instead of deep nested `if`; avoid else after return. Avoid nesting > 3 levels.
- **Small functions, single responsibility.** Verb names for functions (`fetchLinks`, `formatDate`), nouns for data.
- **Booleans** named `is/has/should/can` (`isLoading`, `hasError`).
- **Async/await** instead of long `.then()` chains; always `try/catch` around an await that can fail.
- **TS:** prefer `interface` for object shapes, `type` for unions/aliases; avoid `any` (use `unknown` then
  narrow); enable strict (already in `tsconfig`); export types explicitly.
- **Import order:** built-in/node → external libraries → internal alias `@/…` → relative `./…`. No circular imports.
- **No dead code / leftover `console.log`** in committed code (deliberate logging is fine on the backend).
- **Repeated magic number/string** → extract a named constant.
- **Comments explain WHY, not WHAT;** delete dead code instead of commenting it out.

**Design smells to catch in review** (beyond the above):
- A function that needs a comment to explain a *block* → extract that block into a well-named function.
- A **boolean parameter** that switches behaviour (`render(true)`) → usually two functions, or an options object with a named field.
- A **long parameter list** (>3-4) → pass a single typed options object.
- **Primitive obsession** — a bag of loose strings/numbers that always travel together → give them a type/interface.

## 8. Per-repo setup: Prettier + commit-msg hook

Every repo SHARES one config set (the source of truth is in this skill), don't invent a different one.

**Prettier — unified formatting across all repos.** Config: `semi: true`, `singleQuote: true`,
`printWidth: 100`, `tabWidth: 2`, `trailingComma: 'all'`, `arrowParens: 'always'`, `endOfLine: 'lf'`.

```sh
# 1. Copy config + ignore into the repo ROOT (and each frontend/backend sub-package if split apart):
cp ".claude/skills/coding-convention/templates/.prettierrc"     "<repo>/.prettierrc"
cp ".claude/skills/coding-convention/templates/.prettierignore" "<repo>/.prettierignore"
# 2. Install & add scripts (in each package with a package.json):
npm i -D prettier
#    package.json scripts: "format": "prettier --write .",  "format:check": "prettier --check ."
```

- Run `npm run format` (or `prettier --write`) before committing. CI/lint should use `format:check`.
- ESLint handles logic/bugs, Prettier handles style — don't enable format rules in ESLint so they don't clash.

**Git commit-msg hook — enforce Conventional Commits right on the machine.** Source:
`.claude/skills/coding-convention/hooks/commit-msg`. Install after `git init`/clone:

```sh
cp ".claude/skills/coding-convention/hooks/commit-msg" "<repo>/.git/hooks/commit-msg"
cp ".claude/skills/coding-convention/hooks/pre-commit" "<repo>/.git/hooks/pre-commit"
# Git for Windows runs hooks via sh so no chmod is needed; on Unix add: chmod +x ...
```

- **`commit-msg`** blocks: wrong `type(scope): desc` structure, subject ending with `.`, and a **capitalized first
  letter of the description** (forces lowercase, imperative mood — except all-caps acronyms like API/JWT/SSO). Skips merge/revert/fixup.
- **`pre-commit`** (non-blocking) reminds you when a commit touches CODE but not `docs/` → consider updating
  `docs/00-map.md` / `docs/decisions.md` (docs standard: `nuc-platform/05-TAI-LIEU-CHUAN.md`). Does NOT block.

When scaffolding a new project (skill `/nuc-new-project`), install BOTH the Prettier config and the 2 hooks at the repo init step.

**Document-as-you-code:** when making a **non-obvious** decision (choosing an architecture, dodging a pitfall, a trade-off) →
write one entry into `<project>/docs/decisions.md` (template in `05-TAI-LIEU-CHUAN.md §5`), alongside the code commit.
At the end of a significant editing pass → run `/session-wrap` to lock in the knowledge + sync `docs/00-map.md`.

## 9. Backend (Next.js — Route Handlers + Server Actions, NO separate Express)

- Server logic lives in Next.js: **Server Action** (`app/actions.ts`) for mutations from the UI;
  **Route Handler** (`app/api/<x>/route.ts`) for HTTP/machine endpoints. Configure via `process.env.X || '<fallback>'`.
- **DB via Prisma** (`lib/db.ts` exports a single shared `prisma` instance — avoids creating many clients on hot-reload).
  Schema in `prisma/schema.prisma`. Data persists via a named volume; DB/file paths read from env (`DATABASE_URL`…), not a hardcoded absolute path.
- The health endpoint `app/api/health/route.ts` is always open (for Docker HEALTHCHECK + CI) — don't put auth on it.
- Auth per platform: forward-auth via Authentik (gated at Traefik) > read `X-authentik-*` headers in the app for
  authorization > API token for machine endpoints. Do NOT hand-code login (see invariant #8 in `CLAUDE.md`).
- ⛔ Endpoints that a MACHINE client calls automatically (MCP/OAuth/webhook) must NOT sit behind forward-auth — split into a separate router, auth at
  the app layer (living reference: `todo/app/api/[transport]` + `app/api/oauth/*`, self-managed bearer/OAuth; see `auth-apps.md`).

---

## 10. Checklist before reporting "done" / before committing

- [ ] File/variable/type/commit names follow sections 1–2; general conventions in section 7 (const, ===, early return, async/await…).
- [ ] Frontend: correct stack from section 4, all 5 UI rules from section 5 (especially: no hardcoded colors, has dark/light, responsive).
- [ ] React follows section 6: clean hooks (full dependencies, cleanup), stable `key`, minimal state, full loading/error/empty.
- [ ] `prettier --write` has been run; the frontend's `npm run lint` and `npm run build` pass (if the frontend was touched).
- [ ] No hardcoded secrets; no leftover `console.log`/dead code; comments in English for non-obvious spots.
- [ ] The repo has the Prettier config + commit-msg + pre-commit hook (section 8). Commit in English Conventional Commits (lowercase description); only commit/push when the user asks.
- [ ] Docs keep up with code: non-obvious decisions recorded in `docs/decisions.md`; module map/flow changed → `docs/00-map.md` updated (standard: `05-TAI-LIEU-CHUAN.md`; end of a large editing pass → `/session-wrap`).
