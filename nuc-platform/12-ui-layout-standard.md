# 12 — Platform UI layout standard

The shared page-layout rules every MiniServer web-app follows so pages look like one product, not a
pile of independently-built screens. Complements skill `/react-ui-craft` (composition/motion/UX) and
`/coding-convention` `references/ui-rules.md` (stack/theme/the 5 UI rules) — this doc owns **page-level
frame consistency**: the container, spacing rhythm, breadcrumb, and animation baseline.

> Born 2026-07-22 from sakubun, where new pages (groups/account/admin) had drifted — each hand-rolled
> its own padding + max-width and several shipped with no breadcrumb at all. The fix is a single shared
> page wrapper, applied everywhere. Reference implementation: `sakubun/components/page-shell.tsx`.

## The rule

**1. The shell owns horizontal width only.** The app shell's `<main>` sets `mx-auto w-full max-w-7xl
px-4 sm:px-6` and nothing else — no vertical padding, no `space-y`. Pages never re-set the horizontal
container.

**2. Every page body is a `PageShell` — STRICT, no exceptions.** One shared component owns the rest of the
frame, so pages stop copy-pasting (and drifting) `py-8 space-y-6 max-w-* + breadcrumb`. If a route renders
UI, it renders it inside a `PageShell`:

- vertical rhythm — `py-8 space-y-6` (one value, one place);
- content **width tier** — `full` is the DEFAULT and the norm: data pages AND content/form pages use it so
  the whole app reads at one width. The narrower tiers (`wide` max-w-5xl, `narrow` max-w-3xl, `form`
  max-w-2xl) exist but are used sparingly — only when reading-width genuinely helps. Do NOT scatter random
  per-page max-widths;
- the **breadcrumb slot** (see rule 3);
- **tabs beside the breadcrumb** — a tabbed page passes its `<TabsList>` (plus any right-aligned action,
  e.g. a Save button) as `headerAside`, so the tabs share the breadcrumb's row (like `/resources`). The
  component that owns `<Tabs>` owns the `PageShell`: `<Tabs><PageShell section=… headerAside={<TabsList/>}>
  …<TabsContent/>…</PageShell></Tabs>`; that page's file then renders no second `PageShell`.

A detail page with a custom trail passes a `breadcrumb` node (the full parent chain) instead of `section`.

**3. Breadcrumbs replace page titles — on EVERY page — and carry the description.** No page ships without
a breadcrumb. It names the page (drop the redundant `<h1>`), and the page's **description lives in the
crumb's hover description** (`CRUMBS[section].description`), NOT as a paragraph on the page (like
`/resources`). Keep on the page only sub-info a static crumb can't carry (e.g. a per-user email line).
One central route→crumb map (`app-breadcrumbs.tsx`) holds label + href + icon + description per section; a
new page adds its entry there in the same change. Detail pages nest the full parent chain
(`Section → Subsection → Chi tiết`) instead of a bespoke back-link.

**4. Sidebar footer = two collapsible action buttons.** Footer controls (theme toggle, logout, …) are
compact action buttons that reveal their label on hover: side by side on one row when the sidebar is
expanded, stacked into a centred icon column on the collapsed ~3rem rail (never a horizontal row that
overflows it). Destructive footer actions (logout) use `variant="destructive"`. The brand mark stays
visible above the collapse toggle when collapsed (hide the wordmark, not the logo).

**5. Animation baseline = Motion, reduced-motion global.** Motion (`motion/react`) is the animation
library; wrap the app once in `<MotionConfig reducedMotion="user">` so no component re-implements the
`prefers-reduced-motion` guard. Animate only `transform`/`opacity`. Prefer a tiny shared vocabulary of
reusable variants/components (`fadeUp`, `StaggerGroup`/`StaggerItem`, `Reveal` — see
`sakubun/components/motion-primitives.tsx`) over hand-writing `<motion.div>` variants per screen, so motion
reads as one system. Pre-existing CSS-keyframe animations can stay; migrate them to Motion opportunistically
when you're already touching them, not in a big-bang rewrite.

## Applying it to a new app

Copy `page-shell.tsx` + `app-breadcrumbs.tsx` shape from sakubun (adapt the section map to the app's
routes), keep the shell `<main>` horizontal-only, wrap the tree in `MotionConfig`, and route every page
body through `PageShell`. That's the whole standard — four files and a habit.
