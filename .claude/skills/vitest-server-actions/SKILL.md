---
name: vitest-server-actions
description: Set up & write Vitest tests for the MiniServer web stack (Next.js App Router + React 19 + Prisma + server actions) — unit-test pure logic, test server actions by mocking the Prisma singleton + next/cache, optional React Testing Library, gate a CI test job before deploy.yml builds. Use when adding tests to a web-app or the user says "write tests / add testing / set up Vitest". Complements /playwright-e2e-builder (E2E).
---

# Skill: Testing the web stack with Vitest (server actions + logic)

The platform's web apps are Next.js App Router + React 19 + TS + Prisma + **server actions** (no separate Express). The
hardest-to-test and most-used path is exactly that: a server action that validates input, calls `prisma.*`, and calls
`revalidatePath`. This skill covers it. Complements `/coding-convention` (naming, ESM, Prettier) and `/react-ui-craft`
(it says "parse with Zod"; this shows how to test that boundary). Living code to mirror: `projects/todo/app/actions.ts`,
`projects/todo/lib/db.ts`, pure-logic libs `projects/todo/lib/{streak,dates,capacity}.ts`.

## Test in ROI order (don't test everything — test what breaks)

1. **Pure logic first (cheapest, highest value).** Dynamic-computation helpers (`lib/streak.ts`, `dates.ts`,
   `capacity.ts`, `priority.ts`) are pure functions — no mocks, fast, and they encode the real product rules (e.g.
   streak "never miss twice" grace day). Test branches + edge cases here.
2. **Server actions (mock Prisma + `next/cache`).** Assert: the right `prisma.*` call with the right args, the inline
   guards (e.g. `addTask` ignores an empty title; `setEmotion` only scores a *done* task), and that `revalidatePath`
   was called with the correct path/scope (`"/"` vs `"/", "layout"`).
3. **Components (React Testing Library), only where logic lives.** Test behavior a user observes (a toggle flips, an
   empty state shows) — not styling. Skip presentational components with no logic.
4. **A few integration tests against a real test DB (optional tier).** Mocks can't catch a bad query or a
   schema/Prisma mismatch; a handful of real-DB tests do. Reserve for the queries you'd be scared to get wrong.

**Do NOT** chase a coverage %, test framework internals (`revalidatePath`'s own behavior), or assert on Prisma's return
shape you mocked yourself. If a test would only break when you intend to change behavior, it's worth it; otherwise drop it.

## Setup

Add dev deps (ESM, Node ≥22, alias `@/*` → repo root):

```
npm i -D vitest @vitejs/plugin-react vite-tsconfig-paths vitest-mock-extended \
  @testing-library/react @testing-library/dom @testing-library/jest-dom @testing-library/user-event jsdom
```

Copy the templates: `vitest.config.ts` + `vitest.setup.ts` to the project root, and use `templates/actions.test.ts`
as the pattern. Add scripts to `package.json`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

`vitest.config.ts` uses `vite-tsconfig-paths` so `@/...` resolves, default `environment: "node"` (server actions/logic);
component test files opt into jsdom with a top-of-file docblock `// @vitest-environment jsdom`.

## The key technique — mock the Prisma singleton + next/cache

Both mocks go **before** importing the action under test (hoisted `vi.mock`). Pattern (full version in
`templates/actions.test.ts`):

```ts
import { mockDeep, mockReset, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";

vi.mock("@/lib/db", () => ({ prisma: mockDeep<PrismaClient>() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { addTask, setEmotion } from "@/app/actions";

const db = prisma as unknown as DeepMockProxy<PrismaClient>;
beforeEach(() => { mockReset(db); vi.clearAllMocks(); });

it("trims the title, creates the task, revalidates /", async () => {
  await addTask("  Buy milk  ", "2026-06-13");
  expect(db.task.create).toHaveBeenCalledWith({ data: { title: "Buy milk", date: "2026-06-13" } });
  expect(revalidatePath).toHaveBeenCalledWith("/");
});

it("ignores an empty title (guard)", async () => {
  await addTask("   ");
  expect(db.task.create).not.toHaveBeenCalled();
});
```

For an action that reads then writes (`setEmotion`), set the read's return with `db.task.findUnique.mockResolvedValue(...)`
and assert the conditional write. For an action that uses `redirect`/`notFound`, also
`vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn() }))`. For Zod-validated input (when an action
does `schema.parse(formData)`), test BOTH a valid parse and that invalid input is rejected before any `prisma.*` call.

## CI — gate tests before the deploy build

Add a `test` job and make `build` depend on it (`templates/ci-test-job.yml`). **`npx prisma generate` is required** before
running tests — the mocked `@/lib/db` still imports the generated `PrismaClient` type. This keeps the platform invariant
intact (the NUC still only PULLs; tests run in GitHub Actions, not on the NUC):

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npx prisma generate
      - run: npm run test
  build:
    needs: test   # <-- existing build job only runs if tests pass
    # ... unchanged build-and-push-to-ghcr steps
```

## Conventions

- Test files: `*.test.ts` / `*.test.tsx`, **co-located** next to the unit under test (`lib/streak.test.ts`,
  `app/actions.test.ts`). kebab-case filenames, English test names, Prettier-formatted (per `/coding-convention`).
- One `describe` per unit; `it` states the behavior ("ignores an empty title"), not the implementation.
- Reset mocks in `beforeEach` so tests don't leak state.
- A new server action / a new branch in a pure-logic helper ⇒ add/extend its test in the SAME change (the bar from
  `verification-before-completion`: don't claim "done" without the test passing — paste the run output).
