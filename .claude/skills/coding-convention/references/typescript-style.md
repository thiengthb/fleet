---
rule_domain: typescript-style
applies_when: "writing or reviewing TypeScript / JavaScript code — types, imports, async, lint/build gates"
load_priority: high
---

# TypeScript & JS rules

## Module system & runtime

- **ESM everywhere** — `"type": "module"`, `import` / `export`. **NEVER** `require` in app code.
- **Node ≥ 22.**
- **IF** code runs on the server (route handler, server action, `lib/*`) **→** use the `node:` prefix for built-ins (`import fs from 'node:fs'`).

## TypeScript discipline

- **TypeScript is mandatory.** No casual `any`.
- **IF** you need a permissive type at a boundary **→** use `unknown`, then narrow (don't reach for `any`).
- **IF** declaring an object shape **→** prefer `interface`. **IF** a union/alias **→** use `type`.
- **IF** declaring a domain entity used in multiple files **→** put it in `lib/types.ts` (see `todo/lib/types.ts`).
- **Strict mode is on** in every `tsconfig.json` — keep it on.
- Export types explicitly when consumed across modules.

## Formatting (Prettier — non-negotiable)

| Setting | Value |
|---|---|
| `semi` | `true` |
| `singleQuote` | `true` |
| `printWidth` | `100` |
| `tabWidth` | `2` |
| `trailingComma` | `'all'` |
| `arrowParens` | `'always'` |
| `endOfLine` | `'lf'` |

- **IF** committing **→** `prettier --write` (or `npm run format`) FIRST. CI uses `format:check`.
- **NEVER** add format rules to ESLint — they clash with Prettier. ESLint = logic/bugs only.

### Per-repo install (one-time)

```sh
cp ".claude/skills/coding-convention/templates/.prettierrc"     "<repo>/.prettierrc"
cp ".claude/skills/coding-convention/templates/.prettierignore" "<repo>/.prettierignore"
npm i -D prettier
# package.json scripts:
#   "format": "prettier --write ."
#   "format:check": "prettier --check ."
```

## Imports

Order, top-to-bottom (blank line between groups):
1. built-in / `node:*`
2. external libraries
3. internal alias `@/…`
4. relative `./…`

- **NEVER** create a circular import.

## Async

- **IF** chaining > 1 `.then()` **→** use `async / await` instead.
- **IF** an `await` can fail **→** wrap in `try / catch`.

## Build gate

The app must pass BOTH before "done":
- `npm run lint` (eslint-config-next: core-web-vitals + typescript) — clean
- `npm run build` (`next build`) — clean

## Anti-patterns

- **NEVER** hardcode secrets — read via `process.env` / `import.meta.env` (platform invariant #4).
- **NEVER** leave `console.log` in committed code (deliberate backend logging is fine).
- **NEVER** leave commented-out code — delete it.

## See also

- `references/naming.md` — variable / function / type naming
- `references/react-rules.md` — when the file is a React component
- `references/backend-rules.md` — server-only TS (route handlers, server actions, Prisma)
