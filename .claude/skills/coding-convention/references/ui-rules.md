---
rule_domain: ui-rules
applies_when: "scaffolding a new app frontend, choosing UI components, picking colors/fonts/icons, or reviewing UI before commit"
load_priority: high
---

# UI rules — mandatory stack & UX floor

> Living reference: `todo/`. Every new app is scaffolded to match. **Do NOT swap framework, UI lib, style, or font.**
> For composition / state / motion / a11y depth, see skill `/react-ui-craft` + its `references/`.

## Mandatory stack

| Slot | Must use |
|---|---|
| Framework | **Next.js 16 (App Router, RSC)** + **React 19** + **TypeScript** |
| Build | `next build` / `next start`; `output: 'standalone'` in `next.config.ts` (small Docker image) |
| UI components | **shadcn/ui**, style `radix-nova`, base color `neutral`, CSS variables (`components.json`, `rsc: true`) |
| CSS | **Tailwind v4** (`@tailwindcss/postcss`, `@import "tailwindcss"` in `app/globals.css`); theme via CSS variables |
| Sans font | **Inter** (`next/font/google`, subset `["latin","vietnamese"]`) — Geist has NO Vietnamese subset |
| Mono font | **Geist Mono** |
| Icons | **lucide-react ONLY** — **NEVER** another icon set (no react-icons / heroicons / tabler / @radix-ui/react-icons / font-awesome / feather / …). `components.json` → `"iconLibrary": "lucide"` |
| Toasts | **sonner** (`<Toaster position="bottom-center" />`, `@/components/ui/sonner`) — **NEVER** `alert()` / another toast lib |
| Theme | **next-themes** — `<ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>` |
| Data | **Server Actions** (`app/actions.ts`) + **Prisma** (`lib/db.ts`); **Route Handlers** for machine/HTTP endpoints |
| Alias | `@/` → root (`@/components`, `@/lib/...`, `@/components/ui`) |
| Class merge | `cn()` from `@/lib/utils` (clsx + tailwind-merge) |

**Quick start:** copy these from `todo` — `components.json`, `eslint.config.mjs`, `next.config.ts`, `postcss.config.mjs`, `tsconfig.json`, `lib/utils.ts`, `app/globals.css`, `app/layout.tsx`. Then `npx shadcn@latest add <component>`.

## The five UI rules (non-negotiable)

1. **IF** you need a primitive (button/input/dialog/…) **→** use shadcn/ui. **NEVER** hand-roll a raw `<button>` / `<input>` / dialog.
   - Missing component **→** `npx shadcn@latest add …` then extend; place primitives in `components/ui/`, business components in `components/<name>.tsx`.
2. **Dark/light mode is mandatory.** Every app ships a theme toggle (reference: `theme-toggle.tsx`).
   - **NEVER** hardcode colors (`bg-white`, `text-black`, `#fff`, `bg-gray-900`) — they break in the other theme.
   - **ALWAYS** use shadcn CSS variables: `bg-background`, `text-foreground`, `text-muted-foreground`, `border`, `bg-card`, …
3. **Responsive, mobile-first.** Base styles target mobile; scale up with `sm: md: lg:`. Every screen works ≥ 360 px wide. **NEVER** ship horizontal overflow on a phone.
4. **Toast = sonner; icons = lucide-ONLY.** Action feedback (save / delete / error) via `toast()`, not `alert()` / `confirm()`.
   - **Every icon comes from `lucide-react`** — no other icon library, and no hand-rolled `<svg>` icon glyph. Need a glyph lucide lacks → pick the nearest lucide icon, don't reach for another set.
   - **Exception — data-viz is not an icon.** A custom `<svg>` that *renders data* (progress/score ring, gauge, sparkline, chart) is allowed; lucide has no dynamic-value equivalent. Reference: `yakudoku` `ScoreRing`. The ban is on decorative/UI *icons*, not on SVG as a drawing surface.
   - Platform-wide as of 2026-07-12: all repos are lucide-only (audited). Keep it that way — a non-lucide icon import is a review-blocking finding.
5. **Basic a11y & UX:**
   - **IF** a button is icon-only **→** include a label / `aria-label`.
   - Use `<TooltipProvider>` for tooltips.
   - **NEVER** ship a blank screen — loading / empty / error each get explicit UI.

## Layout order (`app/layout.tsx`)

`ThemeProvider` → `TooltipProvider` → `AppShell` → `children`, then `<Toaster>` at the end. Keep this exact order. Reference: `todo/app/layout.tsx`.

## See also

- `references/react-rules.md` — server vs client components, hooks, state
- `references/backend-rules.md` — server actions / route handlers
- skill `/react-ui-craft` + its `references/` — composition, motion, UX states, security depth
