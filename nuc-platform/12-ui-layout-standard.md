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

**2. Every page body is a `PageShell`.** One shared component owns the rest of the frame, so pages stop
copy-pasting (and drifting) `py-8 space-y-6 max-w-* + breadcrumb`:

- vertical rhythm — `py-8 space-y-6` (one value, one place);
- an optional content **width tier** — `full` (default, inherits the shell's `max-w-7xl`; for data-dense
  pages: tables, dashboards, history), `wide` (`max-w-5xl`), `narrow` (`max-w-3xl` — detail/admin), `form`
  (`max-w-2xl`). Different widths for form-vs-data pages are legitimate; random per-page max-widths are not;
- the **breadcrumb slot** (see rule 3).

A page whose header needs a custom layout (breadcrumb sharing a row with a `<TabsList>`, a Save button)
omits the auto-breadcrumb and renders its own via the `breadcrumb` slot — it still uses `PageShell` for
the container + rhythm.

**3. Breadcrumbs replace page titles — on EVERY page.** No page ships without one. The breadcrumb names
the page (so drop the redundant `<h1>`); keep only sub-info a crumb can't carry (an email line, an
operational caveat). One central route→crumb map (`app-breadcrumbs.tsx`) holds label + href + icon +
hover-description per section; a new page adds its entry there in the same change. Detail pages nest the
full parent chain (`Section → Subsection → Chi tiết`) instead of a bespoke back-link.

**4. Sidebar footer stacks; controls collapse to icons.** Footer controls (theme toggle, logout, …) are a
vertical stack of full-width rows when expanded and centred icons on the collapsed icon rail — never a
horizontal row that overflows the ~3rem rail. Destructive footer actions (logout) use `variant="destructive"`.
The brand mark stays visible above the collapse toggle when collapsed (hide the wordmark, not the logo).

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
