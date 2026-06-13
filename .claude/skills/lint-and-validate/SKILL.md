---
name: lint-and-validate
description: Run lint + typecheck + audit after a code change and fix the findings before claiming done — Node/TS (eslint, tsc, npm audit) and Python workers (ruff, mypy, bandit). Use after editing code, before committing. Complements /coding-convention (Prettier/naming) with the post-edit run-and-fix gate, and /verification-before-completion (evidence before "done").
---

# Lint & Validate (platform-adapted)

> **Adapted from** `development/lint-and-validate` (`davila7/claude-code-templates`). I read its `lint_runner.py` /
> `type_coverage.py` scripts — benign (no network/destructive ops) — but **dropped them as non-essential**: the value is
> the discipline below, run with the project's own tools, not an extra Python wrapper to maintain.

Run the right checks after editing, read the output, fix, repeat. Don't report "done" with outstanding lint/type errors
(that's the `/verification-before-completion` gate).

## The quality loop

1. Edit code.
2. **Run the audit** for the ecosystem (below).
3. Read the output — count errors, don't extrapolate.
4. Fix and re-run until clean. Submitting code with failing checks is not allowed.

## Node.js / TypeScript (the web stack + node workers)

```bash
npm run lint              # eslint (eslint-config-next for web apps)
npx tsc --noEmit          # type errors
npm audit --audit-level=high   # known-vuln deps (high/critical)
npx prettier --check .    # formatting (per /coding-convention; --write to fix)
```

`tsc` failing ≠ lint passing — a linter does not check compilation. Fix type mismatches before proceeding.

## Python (workers / bots)

```bash
ruff check . --fix        # fast linter + autofix
mypy .                    # type checking
bandit -r . -ll           # security lint (medium+ severity)
```

## No tooling configured?

Check the project root for `.eslintrc*` / `eslint.config.*`, `tsconfig.json`, `pyproject.toml`. Missing → suggest adding
it (web apps already ship eslint + Prettier via `/coding-convention`; Python workers should add `ruff` + `mypy`). Don't
silently skip the check — say it's missing.

## Strict rule

No code is committed or reported "done" without these passing. Pair with `/vitest-server-actions` (tests) so the gate is
lint + types + tests, then claim done **with the output** (`/verification-before-completion`).
