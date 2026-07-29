---
rule_domain: naming
applies_when: "creating/renaming any file, dir, component, function, variable, type, constant, env var, DB column, or API field"
load_priority: high
---

# Naming rules

> Living reference: `projects/todo/`. When unsure, open the matching file there before inventing.

## Core mappings

| Object | Rule | Example |
|---|---|---|
| Directory | kebab-case | `projects/nuc-monitor/`, `components/ui/` |
| React component file | kebab-case `.tsx` | `link-card.tsx`, `theme-toggle.tsx` |
| lib / util / logic file | kebab/lowercase `.ts` | `api.ts`, `auth.ts`, `utils.ts` |
| React component | PascalCase, **named export** | `export function LinkCard(...)` |
| Props interface | `<Component>Props`, declared **right above** the component | `interface LinkCardProps { … }` |
| Function / variable | camelCase | `faviconUrl`, `getAccessToken` |
| Type / interface | PascalCase | `LinkItem`, `StatsGranularity` |
| Module-level config constant | UPPER_SNAKE_CASE | `BASE_URL`, `PORT`, `API_KEY` |
| DB column & API JSON field | snake_case | `created_at`, `last_visited_at` |
| Env variable | UPPER_SNAKE_CASE | `VITE_API_URL`, `CORS_ORIGIN` |

## Hard rules

- **IF** writing a function name **→** use a verb (`fetchLinks`, `formatDate`).
- **IF** writing a data/value name **→** use a noun.
- **IF** the value is a boolean **→** prefix `is` / `has` / `should` / `can` (`isLoading`, `hasError`).
- **IF** an acronym is part of a name **→** keep its case as a single word in the surrounding case (`ApiClient`, `httpServer`, `JWT_SECRET`).
- **NEVER** use cryptic abbreviations — name things by meaning.

## General style (always-on)

- **`const` by default**, `let` only when reassignment is needed; **NEVER** `var`. Don't reassign function parameters.
- **`===` / `!==`** always (the only exception: `== null` to deliberately catch both `null` and `undefined`).
- **Early return** instead of deep nested `if`; avoid `else` after a `return`. Avoid nesting > 3 levels.
- **Small functions, single responsibility.** A function that needs a comment to explain a *block* → extract that block.
- **Repeated magic number/string** → extract a named constant.
- **Comments explain WHY, not WHAT;** delete dead code instead of commenting it out.

## Design smells (catch in review)

- **IF** a function takes a boolean parameter that switches behaviour (`render(true)`) **→** split into two functions, or use an options object with a named field.
- **IF** the parameter list is > 3-4 items **→** pass a single typed options object.
- **IF** a bag of loose strings/numbers always travels together (primitive obsession) **→** give them a type/interface.

## See also

- `references/typescript-style.md` — TS-specific rules (`any`, `unknown`, `interface` vs `type`)
- `references/git-commit.md` — commit subject style (lowercase, imperative)
