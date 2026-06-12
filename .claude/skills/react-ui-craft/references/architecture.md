# Architecture & Clean Code

How to structure a React/Next.js app so it stays readable and changeable months later. The enemy is not complexity — it's *accidental* complexity: structure that doesn't map to how the app actually works.

## Table of contents
1. Project setup (the canonical bootstrap)
2. Folder structure (feature-first)
3. Server vs client — the Next.js split
4. The data / API layer
5. State management — pick the lightest thing that works
6. Naming & file conventions
7. Clean-code rules that actually pay off

---

## 1. Project setup

**Next.js (App Router) + Tailwind v4 + shadcn/ui + TypeScript:**
```bash
npx create-next-app@latest my-app --typescript --tailwind --app --eslint
cd my-app
npx shadcn@latest init        # choose new-york style; sets up components.json + CSS vars
npx shadcn@latest add button card dialog input sonner
npm install motion
```

**React + Vite (SPA):**
```bash
npm create vite@latest my-app -- --template react-ts
cd my-app
npm install -D @tailwindcss/vite
npm install motion
# add @tailwindcss/vite to vite.config.ts plugins, set "@" path alias to ./src
npx shadcn@latest init        # detects Vite; writes components.json
```

Tailwind v4 has **no `tailwind.config.js` by default**. Configure tokens in CSS:
```css
/* app/globals.css (Next) or src/index.css (Vite) */
@import "tailwindcss";

@theme {
  --color-brand-500: oklch(0.62 0.19 264);
  --color-brand-600: oklch(0.55 0.19 264);
  --font-display: "Geist", sans-serif;
  --radius: 0.625rem;
}
```
shadcn writes its design tokens (`--background`, `--foreground`, `--primary`, …) here too, in OKLCH. Edit those to rebrand — don't override component-by-component.

---

## 2. Folder structure — feature-first, not type-first

Group by **feature/domain**, not by file type. Type-first (`components/`, `hooks/`, `utils/` holding everything) collapses once the app grows: a change to "vocabulary review" touches ten scattered folders. Feature-first keeps a change local.

**Next.js App Router:**
```
src/
  app/                      # routing only — thin pages that compose features
    (marketing)/page.tsx
    dashboard/
      page.tsx
      layout.tsx
  features/                 # the real app, by domain
    vocabulary/
      components/           # feature-specific UI
      api/                  # data access for this feature
      hooks/
      types.ts
    review/
  components/
    ui/                     # shadcn primitives (owned, editable)
    shared/                 # cross-feature composites (PageHeader, EmptyState…)
  lib/                      # framework-agnostic helpers
    api-client.ts
    utils.ts                # cn(), formatters
  hooks/                    # truly global hooks
  types/                    # shared/global types
```

**Vite SPA:** same `features/`, `components/`, `lib/` — replace `app/` with `pages/` or a `routes/` tree (React Router v7).

Rules of thumb: a component used by one feature lives in that feature; promote to `components/shared` only on the *second* consumer. Keep `app/`/route files thin — they wire data to feature components, they don't contain business UI.

---

## 3. Server vs client — the Next.js split

This is the single most leveraged architectural decision in App Router. Default to **Server Components**; opt into client only when you need interactivity.

A component must be a **Client Component** (`"use client"` at the top of the file) if it uses: `useState`/`useEffect`/`useReducer`, event handlers (`onClick`…), browser-only APIs, or any library that needs them — **including Motion**.

Keep the `"use client"` boundary *low* in the tree. Don't mark a whole page client because one button is interactive — extract the interactive bit into its own client component and keep the page a server component that fetches data.

```tsx
// app/dashboard/page.tsx  — Server Component (no "use client")
import { getStats } from "@/features/dashboard/api/stats";
import { StatsChart } from "@/features/dashboard/components/stats-chart"; // client

export default async function DashboardPage() {
  const stats = await getStats();          // runs on the server, secrets safe
  return <StatsChart data={stats} />;       // pass plain data across the boundary
}
```

Server Components can be `async` and fetch directly. Data fetched on the server never exposes tokens or query logic to the client. Pass **serializable data** across the boundary (no functions, no class instances).

In a **Vite SPA there is no server boundary** — everything is a client component, and all data fetching happens in the browser. That's fine; just know that *nothing* in the bundle is private (see security reference).

---

## 4. The data / API layer

Never scatter `fetch` calls through components. Centralize.

**A typed client** in `lib/api-client.ts`:
```ts
const BASE = process.env.NEXT_PUBLIC_API_URL ?? import.meta.env.VITE_API_URL;

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    credentials: "include", // if using cookie auth
  });
  if (!res.ok) throw new ApiError(res.status, await safeJson(res));
  return res.json() as Promise<T>;
}
```

**Per-feature data functions** wrap it and own the types:
```ts
// features/vocabulary/api/words.ts
import { z } from "zod";
const Word = z.object({ id: z.number(), kanji: z.string(), meaning: z.string() });
export type Word = z.infer<typeof Word>;

export async function getWords(level: string): Promise<Word[]> {
  const data = await apiFetch<unknown>(`/words?level=${level}`);
  return z.array(Word).parse(data);   // parse, don't cast — untrusted input
}
```

**Fetching strategy:**
- *Server Components (Next.js):* call the data function directly in the component; use `fetch` cache options or `revalidate`.
- *Client fetching (SPA or client components):* use **TanStack Query (React Query)** for anything non-trivial — it gives caching, dedupe, retries, loading/error state, and invalidation for free, and removes most hand-rolled `useEffect` data code. SWR is a lighter alternative.
- *Mutations (Next.js):* prefer **Server Actions** + `useActionState`/`useOptimistic`; they keep the mutation on the server and integrate with forms.

Don't reach for a global store to cache server data — that's what Query/Server Components are for.

---

## 5. State management — lightest thing that works

Escalate only when the simpler tier genuinely fails:
1. **Local `useState`/`useReducer`** — most state. Keep it close to where it's used.
2. **Lift + props / composition** — share between siblings. Prefer passing children over prop-drilling deep trees.
3. **Context** — for *low-frequency* global values (theme, current user, locale). Don't put fast-changing state in context; it re-renders the whole subtree.
4. **Zustand / Jotai** — genuine cross-app client state that changes often (a complex editor, a multi-step wizard). Small, unopinionated, no boilerplate.
5. **Server cache (TanStack Query / RSC)** — *server* data is not "state" you own. Cache it, don't mirror it into a store. The #1 architecture smell is duplicating server data into Redux/Zustand and fighting to keep it in sync.

URL is state too: filters, tabs, pagination belong in search params (`useSearchParams` / `nuqs`) so links are shareable and back/forward works.

---

## 6. Naming & file conventions

- Components: `PascalCase` files and exports (`WordCard.tsx`). One main component per file.
- Hooks: `useThing.ts`, always prefixed `use`.
- Utilities/non-component files: `kebab-case.ts` (`api-client.ts`).
- Booleans read as predicates: `isLoading`, `hasError`, `canSubmit`.
- Event handlers: `handleX` inside a component, `onX` for the prop name.
- Types/interfaces: `PascalCase`, no `I` prefix. Co-locate a component's prop type as `WordCardProps`.
- Barrel files (`index.ts`) only at feature boundaries, not everywhere — over-barreling hurts tree-shaking and creates import cycles.

---

## 7. Clean-code rules that pay off

- **Components do one thing.** If a component fetches, transforms, and renders three sections, split it. A good ceiling: if you can't describe it in one sentence without "and", split it.
- **Props are an API.** Few, named, typed. More than ~6 props or several booleans that combine → switch to a `variant`/composition or split the component. Avoid boolean prop explosions (`isPrimary` + `isLarge` + `isGhost`) — use a `variant` union.
- **Extract logic into hooks.** Stateful logic that isn't rendering belongs in a `useX` hook, testable on its own and reusable. Components should read like a description of the UI.
- **Derive, don't sync.** Compute values during render from existing state/props instead of storing duplicates in `useEffect`. Most `useEffect`s that set state are bugs waiting to happen.
- **`useEffect` is for synchronizing with external systems**, not for reacting to props/state. If there's no external system (subscription, DOM measure, non-React widget), you probably don't need it.
- **No magic values.** Hoist repeated strings/numbers to named constants; use enums/unions for fixed sets.
- **Errors are part of the design**, not an afterthought. Type them, surface them (see ux.md), and add an Error Boundary at route level so one broken widget doesn't blank the page.
- **Keep functions short and named for intent.** A reader should follow the happy path top-to-bottom without scrolling.
