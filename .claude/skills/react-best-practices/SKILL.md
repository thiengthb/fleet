---
name: react-best-practices
description: React/Next.js PERFORMANCE rule catalog (Vercel) — eliminating data waterfalls, bundle-size cuts, server-side caching, re-render and rendering optimization. Use specifically when optimizing or reviewing performance of React/Next.js code (slow page, big bundle, excess re-renders, fetch waterfalls). For general build quality/composition/UX use /react-ui-craft; for naming/stack rules /coding-convention.
---

# React Best Practices — performance rules (platform-adapted)

> **Adapted from** `development/react-best-practices` (Vercel Engineering, via `davila7/claude-code-templates`,
> originally `vercel-react-best-practices`). Kept the categorized rule catalog as a **self-contained checklist**;
> the upstream's per-rule `rules/*.md` + `AGENTS.md` were **not vendored** (45 files) — fetch them live from the
> upstream repo only if you need a specific rule's full example. Stack-aligned (Next.js App Router + React 19).

Scope: **performance**. This is the perf-specific complement to `/react-ui-craft` (holistic build quality, composition,
UX states, security). Reach here when something is *slow/heavy*, not for general component work.

45 rules across 8 categories, ordered by impact — apply top-down (waterfalls + bundle first, they dominate).

## 1. Eliminating waterfalls (CRITICAL)
`Promise.all()` for independent fetches · move `await` into the branch that uses it · start promises early/await late in
Route Handlers · `<Suspense>` to stream. The single biggest win on App Router pages.

## 2. Bundle size (CRITICAL)
Import directly, **avoid barrel files** (`index.ts` re-exports) · `next/dynamic` for heavy components · defer
analytics/3rd-party until after hydration · load a module only when its feature activates · preload on hover/focus.

## 3. Server-side performance (HIGH)
`React.cache()` for per-request dedup · LRU for cross-request cache · **minimize data serialized to client components**
(matches the "minimal DTO" security rule) · restructure to parallelize server fetches · `after()` for non-blocking work.

## 4. Client-side fetching (MEDIUM-HIGH)
SWR for automatic dedup · dedupe global event listeners. (Most data here should be server-fetched — fetch client-side
only for realtime/post-interaction, per `/coding-convention §6`.)

## 5. Re-render optimization (MEDIUM)
Don't subscribe to state only read in callbacks · memoize genuinely expensive subtrees · primitive deps in effects ·
subscribe to derived booleans not raw values · functional `setState` for stable callbacks · lazy `useState` initializer ·
`startTransition` for non-urgent updates.

## 6. Rendering (MEDIUM)
Animate a wrapper `div`, not the SVG · `content-visibility` for long lists · hoist static JSX out of the component ·
ternary not `&&` for conditional render (avoids `0`/falsy leaks) · inline script to avoid hydration flicker for
client-only data.

## 7. JavaScript (LOW-MEDIUM)
`Map`/`Set` for O(1) repeated lookups · cache property access / function results / storage reads in loops · combine
multiple `filter`/`map` passes · hoist `RegExp` out of loops · early-exit · `toSorted()` for immutable sort.

## 8. Advanced (LOW)
Store event handlers in refs · `useLatest` for stable callback refs.

## How to apply

Treat this as a review checklist; fix in priority order (a fetch waterfall or a barrel import outweighs a dozen micro
JS tweaks). For a rule's full before/after example, fetch it live from the upstream repo
(`development/react-best-practices/rules/<rule>.md`) — don't guess. **Measure first** (`/performance` thinking, the
Network/React Profiler) so you optimize the real bottleneck, not a guessed one.
