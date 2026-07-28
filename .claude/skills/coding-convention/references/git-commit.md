---
rule_domain: git-commit
applies_when: "writing a commit message, creating a branch off main, or considering --no-verify / hook bypass"
load_priority: high
---

# Git commit & branch rules

## Commit message format (Conventional Commits, English)

```
<type>(<scope>): <short description, imperative mood, no trailing period>

[optional body: explain WHY, not WHAT]
```

| Field | Rule |
|---|---|
| `type` | one of `feat · fix · refactor · chore · docs · test · perf · style · build · ci` |
| `scope` | module/area name (`auth`, `api`, `ui`, `deps`, `docker`…); omit if generic |
| description | English, **lowercase first word**, ≤ ~72 chars, imperative mood, **no trailing period** |
| body | explains the **reason**, not a restatement of the diff |

**Allowed exception:** all-caps acronyms in the description stay capitalised (`feat(auth): add JWT verification`).

### Examples

- `feat(auth): add Authentik login via forward-auth`
- `fix(api): handle empty tag returning 500`
- `chore(deps): bump next to 16`
- `refactor(ui): extract link-card into its own component`

## Operation rules

- **NEVER** commit/push unless the user asks.
- **IF** on `main` and a large change is needed **→** create a branch first (`git checkout -b <type>/<slug>`).
- **NEVER** use `--no-verify`, skip hooks, or skip signing — unless the user explicitly asks.
- **IF** the commit bundles unrelated work **→** split it. **One commit = one coherent change idea.**
- **NEVER** force-push, `reset --hard`, or `branch -D` without explicit user permission.

## Per-repo hook setup (one-time)

Every repo SHARES one config set. Source of truth = this skill's `hooks/`. Install after `git init` / clone:

```sh
cp ".claude/skills/coding-convention/hooks/commit-msg" "<repo>/.git/hooks/commit-msg"
cp ".claude/skills/coding-convention/hooks/pre-commit" "<repo>/.git/hooks/pre-commit"
# Git for Windows runs hooks via sh — no chmod. On Unix: chmod +x ...
```

| Hook | Behaviour |
|---|---|
| `commit-msg` | **BLOCKS** wrong `type(scope): desc` structure, subject ending with `.`, capitalised first letter of description (forces lowercase, except all-caps acronyms). Skips merge/revert/fixup commits. |
| `pre-commit` | **REMINDS** (non-blocking) when a commit touches CODE but not `docs/` → consider updating `docs/00-map.md` / `docs/decisions.md`. |

When scaffolding a new project (`/app-onboard`), install BOTH the Prettier config and these 2 hooks at the repo-init step.

## See also

- `references/naming.md` — general English naming + style for the description body
- `platform/05-documentation-standard.md` — the docs the pre-commit hook nudges you toward
