# Proposal — one installer for the Prettier config (a human applies this)

**Status:** awaiting the supervisor · **Decided by:** supervisor, 2026-07-29 (option "skill template becomes a pointer")
**Why this is a proposal and not a commit:** `.claude/skills/**` is governance — the agent may propose, a human commits
(`autonomy-gate.mjs`, the CVE-2025-53773 lesson). Everything below is a copy-paste patch.

## The problem, in one line

`commons` now ships `config-prettier` (`shadcn add config-prettier` → `.prettierrc` + `.prettierignore`), and
`.claude/skills/coding-convention/templates/` still holds the same two files, **byte-identical today**. Two installers
for one contract: whichever one is edited next, nothing detects that the other did not move.

Verified 2026-07-29: the skill template matches `todo`, `journal` and `sakubun`'s `.prettierrc` exactly.

## The patch (3 edits, ~2 minutes)

### 1. `.claude/skills/coding-convention/SKILL.md` — §3 "Per-repo setup (one-time)"

Replace the Prettier block:

```diff
-- **Prettier config + ignore** — copy from `templates/`:
-  ```sh
-  cp ".claude/skills/coding-convention/templates/.prettierrc"     "<repo>/.prettierrc"
-  cp ".claude/skills/coding-convention/templates/.prettierignore" "<repo>/.prettierignore"
-  npm i -D prettier
-  # package.json: "format": "prettier --write .", "format:check": "prettier --check ."
-  ```
+- **Prettier config + ignore** — install from `commons`, the single source:
+  ```sh
+  npx shadcn@latest add ../commons/public/r/config-prettier.json   # or: @thiengthb/config-prettier
+  npm i -D prettier
+  # package.json: "format": "prettier --write .", "format:check": "prettier --check ."
+  ```
```

### 2. `.claude/skills/coding-convention/references/typescript-style.md` — "Per-repo install (one-time)"

Same replacement (lines 41-48).

### 3. Delete the now-duplicated templates

```sh
git rm ".claude/skills/coding-convention/templates/.prettierrc" \
       ".claude/skills/coding-convention/templates/.prettierignore"
```

Keep everything else in `templates/` — only these two moved.

## What does NOT change

- The rule itself (the settings table in `references/typescript-style.md`) stays in the skill. That is the **law**, which
  is read; only the **file**, which is installed, moves to `commons`. Same axis as the rest of the install-surface plan.
- `hooks/commit-msg` + `hooks/pre-commit` stay in the skill for now: they install into `.git/hooks/`, which is outside
  the working tree, so `shadcn add` cannot place them. Revisit only if that changes.

## If you would rather not

The alternative is to drop `config-prettier` from `commons` — but then `starter-web-app` (Phase 3) cannot land a
`.prettierrc` into a new repo in one command, which is the point of the starter. The third option, leaving both in
place, is the one that silently drifts.
