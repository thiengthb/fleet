---
rule_domain: react-rules
applies_when: "writing or reviewing a React component, hook, server vs client boundary, or state structure"
load_priority: high
---

# React rules

> Living reference: `todo/components/*`. Applies to every component in any MiniServer app.

## Server vs Client (Next.js App Router)

- **Default = Server Component.** Runs on the server, fetches/Prisma directly, ships zero JS to the client.
- **IF** the component needs state / effect / event handler / browser hook **→** add `'use client'` at the **top** of the file.
- **IF** a component tree mixes server + client work **→** push the `'use client'` boundary as **deep** as possible (leaf, not root). Fetch in a Server Component, pass primitives down to the Client Component.

## Component & file structure

- Function component + hooks. **NEVER** class components.
- One file = one primary business component (named export). Small child components may share the file.
- Keep presentational components separate from logic. **IF** logic is reused on the client **→** extract a custom `use*` hook into `hooks/`.
- Declare props via `<Component>Props` interface; destructure in the parameter list.
- Pass primitives / handlers; **IF** a large object would cross many layers **→** use Context.
- **IF** a component file > ~250 lines **→** split it.

## Hooks

- **Rules of Hooks:** call only at the top level of a component or another hook. **NEVER** inside loops / conditions. Keep `eslint-plugin-react-hooks` clean (already configured).
- **`useEffect`:**
  - declare ALL dependencies (no lying to the linter);
  - is for **side-effects only** (fetch, subscribe, DOM);
  - **IF** the value can be derived from props/state **→** compute it during render, **NEVER** cram it into effect + state;
  - **ALWAYS** clean up subscriptions / timers / listeners / `AbortController` in the effect's return.
- **`useMemo` / `useCallback`:** only when there's a measurable benefit (large lists, stable ref for a memoised child). **NEVER** wrap blindly.

## State & data

- Minimal state, placed near where it's used. Lift it up only when sharing is needed.
- **NEVER** duplicate derived data into state.
- **`key` in a list = a stable id.** **NEVER** use the index when the list can reorder / add / remove.
- **ALWAYS** update state immutably (spread, map, …). **NEVER** mutate directly.
- **Prefer fetching in a Server Component** (`lib/db.ts` via Prisma) or a **Server Action** (`app/actions.ts`). Fetch client-side only when truly needed (realtime, after an interaction).
- Keep business logic in `lib/*` — **NEVER** cram it into a component.
- **Client fetch:** handle loading / error / empty states; render UI for each (UI rule #5).

## Render & a11y

- **NEVER** define a new component / function inside the render path that causes remounts; declare it outside or wrap in `useCallback`.
- Use semantic HTML (`<button>`, `<nav>`, `<main>`, `<form>`, …). The component must be operable by keyboard.
- **NEVER** use `dangerouslySetInnerHTML` with unsanitized data.

## See also

- `references/typescript-style.md` — TS rules, imports, async
- `references/ui-rules.md` — shadcn/ui, theme, the 5 UI rules
- skill `/react-ui-craft` + `references/{architecture,components,motion,ux,security}.md` — depth on composition / motion / states / security
- skill `/react-best-practices` — performance (waterfalls, bundle size, re-renders)
