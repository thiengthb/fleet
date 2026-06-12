# Motion

Animation with **Motion v12** (the library formerly named Framer Motion; package `motion`, import from `motion/react`). The goal is motion that feels intentional and physical — and that you'd never notice was AI-added. Restraint is the whole game: one orchestrated moment beats ten scattered effects.

## Table of contents
1. Setup & the Next.js `"use client"` rule
2. Core patterns (the 90%)
3. Bundle size — `LazyMotion`
4. Performance — what's free, what's expensive
5. Reduced motion — mandatory
6. Taste: when *not* to animate

---

## 1. Setup

```bash
npm install motion
```
```tsx
import { motion, AnimatePresence } from "motion/react";
```

**Next.js App Router gotcha:** Motion components are client-only. Any file using `motion.*`, `AnimatePresence`, or Motion hooks needs `"use client"` at the top. Keep that boundary small — wrap just the animated piece in a client component, not the whole page (see architecture.md §3).

The legacy `framer-motion` package still works and shares the API, but new code uses `motion/react`.

---

## 2. Core patterns

**Enter animation** — declare start/end:
```tsx
<motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3, ease: "easeOut" }} />
```

**Exit animation** — wrap in `AnimatePresence`, give a stable unique `key`:
```tsx
<AnimatePresence>
  {open && (
    <motion.div key="panel" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0 }} />
  )}
</AnimatePresence>
```

**Stagger a list** with variants (parent orchestrates children):
```tsx
const list = { show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };
<motion.ul variants={list} initial="hidden" animate="show">
  {words.map(w => <motion.li key={w.id} variants={item} />)}
</motion.ul>
```

**Layout animation** — animate size/position changes automatically with the `layout` prop (great for reordering, expanding cards, shared-element transitions via `layoutId`). Use `layout="position"` or `layout="x"`/`"y"` to constrain and avoid distorting children.

**Scroll reveal** — `whileInView` with `viewport={{ once: true }}` so it fires once, not on every scroll-by:
```tsx
<motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.4 }} />
```

**Gesture micro-interactions** — `whileHover`/`whileTap` for tactile feedback. Keep them subtle (scale 1.02, not 1.2):
```tsx
<motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} />
```

**Springs feel more natural than durations** for interactive movement: `transition={{ type: "spring", stiffness: 300, damping: 30 }}`. Use eased durations for fades and entrances; springs for things the user pushes around.

---

## 3. Bundle size — `LazyMotion`

The full `motion` component is ~34KB. For size-sensitive apps, use `LazyMotion` + the `m` component to drop to ~6KB initial, loading features on demand:
```tsx
import { LazyMotion, domAnimation } from "motion/react";
import * as m from "motion/react-m";

<LazyMotion features={domAnimation}>
  <m.div animate={{ opacity: 1 }} />   {/* use m.*, not motion.* */}
</LazyMotion>
```
`domAnimation` covers transforms/opacity/variants/gestures; `domMax` adds layout + drag at larger size. Don't mix `motion.*` and `m.*` haphazardly — pick `m.*` under `LazyMotion`.

---

## 4. Performance

- **Animate `transform` and `opacity` only.** These are GPU-composited and don't trigger layout/paint. Animating `width`, `height`, `top`, `left`, `margin` causes reflow and jank — use `transform: scale/translate` or a `layout` animation instead.
- **`will-change` is automatic** for animating elements; don't hand-set it broadly (it costs memory).
- **Avoid animating hundreds of elements at once.** Stagger, virtualize long lists (TanStack Virtual), or animate a container rather than every child.
- **`AnimatePresence` needs stable keys** — index keys break exit animations on reorder.

---

## 5. Reduced motion — mandatory

Some users get motion sickness; the OS exposes `prefers-reduced-motion`. Honor it — this is part of the quality floor, not a nice-to-have.

Global, simplest:
```tsx
import { MotionConfig } from "motion/react";
<MotionConfig reducedMotion="user">{children}</MotionConfig>  // respects the OS setting app-wide
```
Per-component, when you want a tailored fallback (e.g. fade instead of slide):
```tsx
import { useReducedMotion } from "motion/react";
const reduce = useReducedMotion();
<motion.div animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }} />
```
Rule: motion that *moves* things should reduce to a simple opacity change (or nothing) when reduced motion is on. Essential feedback (a spinner, a state change) can stay, just calmer.

---

## 6. Taste — when not to animate

Animation is seasoning. Overuse is the clearest tell of an AI-generated page.

- Animate **state changes the user caused** (open/close, add/remove, navigate) and **arrivals worth noticing** (a hero, the first paint of key content). Skip ambient motion that loops forever for no reason.
- **One signature moment** per screen, done well, beats everything fading-and-sliding on load. Decide what that moment is.
- **Keep durations short:** 150–250ms for micro-interactions, 300–500ms for entrances. Anything slower feels sluggish on repeat visits.
- **Don't block content on animation.** Text should be readable immediately; never gate critical info behind a 2s reveal.
- **Consistency:** reuse the same easing and durations across the app (define them as constants/`MotionConfig` defaults) so motion feels like one system, not per-component improvisation.
