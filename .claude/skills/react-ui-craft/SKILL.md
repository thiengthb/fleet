---
name: react-ui-craft
description: >-
  Build polished, production-grade React and Next.js (App Router) interfaces:
  elegant UI on Tailwind v4 + shadcn/ui, smart well-composed components, smooth
  Motion (Framer Motion) animations, thoughtful UX states, clean maintainable
  architecture, and frontend security hardening. Reach for this skill whenever
  the work involves a React or Next.js frontend, UI components, a design system,
  Tailwind/shadcn, animation or micro-interactions, loading/empty/error states,
  refactoring frontend code for maintainability, or securing a client app that
  talks to an API — even when the user only says "make this page nicer", "build
  a dashboard", "add an animation", or "clean up this component" without naming
  the stack. Use alongside the frontend-design skill, which covers pure visual
  aesthetics (palette, typography, layout direction).
---

# React UI Craft

Build React / Next.js interfaces that look designed, feel alive, and stay maintainable — without shipping a security hole. This skill is the engineering counterpart to the `frontend-design` skill: that one decides *what the page should look and feel like*; this one decides *how to build it well*.

**Read `frontend-design` first when the task is open-ended visual design** (a landing page, a brand, a hero). Read the references here for the build itself. They compose.

## The stack this skill assumes

- **React 19** — Server Components, Actions, `use`, `useActionState`, `useOptimistic`, ref-as-prop (no more `forwardRef`).
- **Next.js (App Router)** *or* **React + Vite (SPA)** — the references call out where the two diverge. If the user hasn't chosen, see the decision note below.
- **Tailwind CSS v4** — CSS-first config via `@theme`, OKLCH colors, `@tailwindcss/vite` or `@tailwindcss/postcss`. No `tailwind.config.js` unless a plugin needs it.
- **shadcn/ui** — `new-york` style, copy-in components you own and edit, `sonner` for toasts, `data-slot` attributes. Not a dependency you upgrade — code you maintain.
- **Motion v12** (`motion` package, `import { motion } from "motion/react"`) — the library formerly called Framer Motion.
- **TypeScript** — always. Type safety is part of "clean and maintainable", not optional.

If the user is on a different stack (CSS Modules, MUI, plain CSS animations, React Router SPA), keep the *principles* in the references and translate the specifics — don't force a rewrite onto their tooling.

## Next.js vs React SPA — quick decision

Pick once, early; it shapes the data layer and the security model.

- **Next.js App Router** — choose for SEO, fast first paint, server-side data fetching, when you want to keep secrets/tokens on the server, or for a content + app hybrid. Default for new public-facing products.
- **React + Vite SPA** — choose for an internal tool, an app behind a login that doesn't need SEO, or a pure client that talks to an existing backend API (e.g. a Spring Boot / REST/GraphQL service). Simpler mental model, no server runtime to operate.

When a backend API already exists and owns auth and data, a Vite SPA or a thin Next.js client both work — let the team's deployment story decide. State the choice and why, then proceed.

## Workflow

Do this in order. Skipping the plan is how component sprawl and inconsistent spacing happen.

1. **Frame it.** Name the screen's one job, the data it needs, and where that data comes from (server component, client fetch, form action). One sentence each.
2. **Plan the structure before code.** Decide the component boundaries (see `references/components.md` → composition), the data-fetching location, and which pieces are server vs client. For visual direction, run the `frontend-design` plan (tokens: color/type/layout/signature).
3. **Scaffold the system, not the screen.** Set up Tailwind theme tokens and the shadcn primitives you'll reuse *first*, so every screen draws from one vocabulary. See `references/architecture.md`.
4. **Build with composition.** Small components with clear props; container/presentational split where it earns its keep; `cn()` for class merging. See `references/components.md`.
5. **Layer in motion last, deliberately.** Animation enhances a finished layout; it never rescues a weak one. See `references/motion.md`.
6. **Handle every state.** Loading, empty, error, success, and the in-between (optimistic, pending). A screen that only handles the happy path is unfinished. See `references/ux.md`.
7. **Self-review against the quality floor** (below) and `references/security.md` before calling it done.

## The quality floor — non-negotiable

Every interface ships with these, without being asked. They're cheap to build in and expensive to retrofit.

- **Accessible.** Semantic HTML, labelled controls, visible keyboard focus (`focus-visible`), color contrast ≥ 4.5:1 for text, `aria-*` only where semantics fall short. shadcn/ui (Radix) gives most of this for free — don't undo it.
- **Responsive.** Works from 360px up. Design mobile-first; add breakpoints upward.
- **Motion-safe.** Respect `prefers-reduced-motion` everywhere there's animation (`useReducedMotion` / `MotionConfig`). See motion reference.
- **Type-safe.** No `any` at boundaries. Type API responses; parse untrusted data (e.g. Zod) rather than casting.
- **Performant.** Animate only `transform`/`opacity`; lazy-load heavy/below-the-fold pieces; don't ship a 34KB animation bundle when `LazyMotion` makes it 6KB.
- **Secure.** No secrets in client bundles, no unsanitized `dangerouslySetInnerHTML`, sensible auth-token handling. See security reference.

## Reference files — read the ones you need

These are detailed and meant to be opened during the build, not memorized. Each is self-contained.

| File | Read it when |
|------|-------------|
| `references/architecture.md` | Setting up a project, deciding folder structure, the data/API layer, state management, server vs client split, naming, keeping code clean and maintainable. |
| `references/components.md` | Building or refactoring components: composition patterns, shadcn/ui usage, `cn()`/variants, forms, accessibility specifics, what makes a component "smart". |
| `references/motion.md` | Adding any animation or micro-interaction: Motion setup, the core patterns (enter/exit, layout, scroll, gesture), performance, reduced-motion, Next.js `"use client"` gotcha. |
| `references/ux.md` | Designing the experience around the data: loading/skeleton/empty/error states, optimistic updates, feedback, forms UX, perceived performance, copy. |
| `references/security.md` | Anything touching auth, tokens, user-generated content, API calls, env vars, dependencies, or a Next.js server boundary. Read before shipping. |

When several apply (the common case), read them together — they're designed to overlap cleanly.

## shadcn workflow & boundary validation (platform habits)

- **Use the shadcn CLI as the source of truth**, don't hand-copy component code: `npx shadcn@latest add <comp>` to pull a
  component you then own; `add --diff` to preview/upgrade against your version; `npx shadcn@latest docs <comp>` for usage;
  `info` to read the project's config. Compose via shadcn's own sub-components (FieldGroup/Field, Card sub-parts) rather
  than re-implementing — consistency reads as "designed". (Stack details: `/coding-convention §4-5`.)
- **Validate at the boundary with Zod, don't cast.** A server action / Route Handler parses untrusted input with
  `schema.safeParse(...)` and returns typed field errors on failure (drives `useActionState` form UX); derive the TS type
  with `z.infer`. The client receives a minimal DTO, never raw rows. (Depth: `references/security.md` + `references/ux.md`.)

> Note: the "you-might-not-need-an-effect" rule (derive from props/state in render; event handlers over effects; `key`
> to reset state) lives in `/coding-convention §6` — not duplicated here.

## Two habits that keep the bar high

- **Build the reusable thing once.** Before writing a one-off card/list/dialog, check whether it belongs in the shared component vocabulary. Consistency reads as "designed"; duplication reads as "assembled".
- **Critique your own output.** After building, look again as a skeptical reviewer: Is any piece templated default rather than a choice? Does every state work? Would this pass a security review? Fix what you find before presenting. A picture is worth a thousand tokens — screenshot if the environment allows.
