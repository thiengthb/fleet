---
paths:
  - "**/*.tsx"
  - "**/*.jsx"
  - "**/*.css"
  - "**/components/**"
  - "**/app/**/page.ts"
  - "**/app/**/layout.ts"
  - "**/docs/ui-patterns.json"
---

# Frontend law — loads when you touch UI files

Moved out of `CLAUDE.md` on 2026-07-28 so it costs nothing on a session that never opens a `.tsx`, and so it arrives
in **full** (not compressed to fit a line budget) at the moment it actually applies. Skill: **`/react-ui-craft`**
(MANDATORY for any React/Next UI) — it owns architecture/composition/state/motion/UX-states/security;
`/coding-convention` owns naming/commits/Prettier. Read its `SKILL.md` first; open a ref
(`architecture`/`components`/`motion`/`ux`/`security`) when needed — the 7-step + full detail live there.

## Page-frame consistency — platform std `nuc-platform/12-ui-layout-standard.md`

Every page body = a shared `PageShell` (vertical rhythm + a width tier + the breadcrumb slot); the app shell `<main>`
owns horizontal width only; breadcrumbs replace page titles on EVERY page; sidebar footer stacks + collapses to icons
(logout = destructive); animation = **Motion** wrapped once in `<MotionConfig reducedMotion="user">` + a small reusable
variant vocab. Reference impl: `sakubun/components/{page-shell,app-breadcrumbs,motion-primitives}.tsx`.

## Stack (running in `todo`)

React 19 (Server Components/Actions, `use`, `useActionState`, `useOptimistic`, ref-as-prop — **NO `forwardRef`**) +
Next.js App Router *or* React+Vite + Tailwind v4 (`@theme`+OKLCH, **no `tailwind.config.js`**) + shadcn/ui + Motion v12
+ TS. Different stack → keep the principles, don't rewrite.

## Quality floor (ship by default)

Accessible · responsive ≥360px · motion-safe · type-safe (Zod at the boundary) · performant (animate only
`transform`/`opacity`) · handle EVERY state (loading/empty/error/optimistic).

**Security:** no secret in the client bundle (only `NEXT_PUBLIC_*`/`VITE_*` reach it); Server Actions/Route Handlers
auth + Zod-validate server-side and return a minimal DTO; no unsanitized `dangerouslySetInnerHTML`; no prod stack traces.

## Mandatory UI

shadcn/ui only · dark/light via CSS vars (**no hardcoded colors**) · sonner toast · **lucide icons ONLY** (never another
icon set / no hand-rolled `<svg>` icon / **no emoji as a UI icon-marker**; exempt: SVG that renders *data* —
score-ring/gauge/sparkline — and emoji inside a text protocol the model emits verbatim) · build the reusable thing ONCE.

## Locked UI patterns — skill `/ui-pattern-lock`

**The user must never state a UI preference twice.** A project's repeated-correction registry is
`<project>/docs/ui-patterns.json`, gate-enforced by `lib/ui-pattern-lock.test.ts` and printed by a PreToolUse hook
before the session's first `.tsx` write. **The moment the user corrects or re-states a UI pattern, STOP the edit and
lock it FIRST** (append an entry — `forbid` / `require-with` / `manual`), then resume. Locking is DATA, not a new test
file. An exception goes in that entry's `allow` map with a reason; never weaken a check to go green. Rules that were
merely written down have already been broken three times — that is why this exists.

## Also relevant here

- Visual/design work → show a preview (static Artifact) and get approval **before** committing; a diff is not enough.
- Judge UI work by what it lets the user DO. Restructuring a familiar screen reads as loss, not progress.
- Prefer minimal, uncluttered surfaces — "bớt đi" means remove, not shrink. Apply a control/behaviour to EVERY
  applicable surface via the shared component, and name the exceptions.
- React/Next **performance** specifically (waterfalls, bundle size, re-renders) → `/react-best-practices`.
