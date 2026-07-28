---
name: coding-convention
description: Mandatory coding convention for every MiniServer project — naming, git commits (Conventional Commits, English), and the required frontend stack/UI (Next.js App Router + React 19 + TS + shadcn radix-nova + Tailwind v4 + lucide + sonner + dark/light, Prisma + server actions). Use when creating/editing code, scaffolding a frontend, reviewing before a commit, or when the user asks "is this following convention".
---

# Skill: MiniServer Coding Convention

This is the LAW for writing code in any project under `D:\Projects\MiniServer\`.
It applies alongside the infrastructure invariants in `CLAUDE.md` (deploy/NUC) — this skill
handles the **code & UI** side, not the deploy side.

The living reference for every convention is the **`todo`** repo (Next.js 16 full-stack — `D:\Projects\MiniServer\todo`).
When unsure "how should I write this", open the corresponding file in `todo` and look — don't invent something new.

If a user request conflicts with a MANDATORY rule below → point out the conflict and ask back before proceeding. Don't silently break the rules.

---

## Rule files (load on demand by topic)

This SKILL is the **procedure**. The actual rules ("if X then Y", tables, mandatory stack) live in `references/<domain>.md` and load only when the procedure step needs them.

| When the task touches… | Read |
|---|---|
| naming a file/dir/component/var/type/constant/env/DB column; general style (`const`/`===`/early return) | `references/naming.md` |
| writing a commit message, branching, hook setup | `references/git-commit.md` |
| TypeScript / JS — types, imports, async, Prettier, lint/build gates | `references/typescript-style.md` |
| frontend stack choice, shadcn/ui, theme, fonts, the 5 UI rules | `references/ui-rules.md` |
| React component / hook / server-vs-client / state | `references/react-rules.md` |
| server action / route handler / Prisma / health / machine endpoint | `references/backend-rules.md` |

For UI craft depth (composition, motion, UX states, frontend security) → skill `/react-ui-craft`.

---

## Procedure

### 1. Before editing — pick the right rule files

Read the description above and pull the 1-2 reference files the task actually needs. Don't preload them all.

### 2. While editing — apply the rules from those files

- Naming, style, imports → `references/naming.md` + `references/typescript-style.md`.
- Component / hook / state → `references/react-rules.md`.
- UI primitives, theme, colors → `references/ui-rules.md`.
- Server action / route handler → `references/backend-rules.md`.

### 3. Per-repo setup (one-time at repo init)

When scaffolding a new project (skill `/nuc-new-project`), install at the repo-init step:

- **Prettier config + ignore** — copy from `templates/`:
  ```sh
  cp ".claude/skills/coding-convention/templates/.prettierrc"     "<repo>/.prettierrc"
  cp ".claude/skills/coding-convention/templates/.prettierignore" "<repo>/.prettierignore"
  npm i -D prettier
  # package.json: "format": "prettier --write .", "format:check": "prettier --check ."
  ```
- **Git hooks** (commit-msg + pre-commit) — copy from `hooks/`:
  ```sh
  cp ".claude/skills/coding-convention/hooks/commit-msg" "<repo>/.git/hooks/commit-msg"
  cp ".claude/skills/coding-convention/hooks/pre-commit" "<repo>/.git/hooks/pre-commit"
  # On Unix add: chmod +x ...
  ```

Behaviour spec for both hooks: `references/git-commit.md`.

### 4. Document-as-you-code

- A **non-obvious** decision (architecture choice, dodging a pitfall, a trade-off) → write one entry into `<project>/docs/decisions.md` (template in `platform/05-documentation-standard.md §5`), alongside the code commit.
- End of a substantial editing pass → `/session-wrap` to lock in the knowledge + sync `docs/00-map.md`.

### 5. Before committing — run the checks

- `prettier --write` (or `npm run format`).
- `npm run lint` — clean.
- `npm run build` — clean.
- `/lint-and-validate` (the post-edit gate) → `/verification-before-completion` (evidence before "done").

---

## Checklist before reporting "done" / before committing

- [ ] File / variable / type names follow `references/naming.md`; general style (const, ===, early return, async/await…) clean.
- [ ] If frontend touched: stack from `references/ui-rules.md`; the 5 UI rules pass (no hardcoded colors, dark/light works, responsive ≥ 360 px).
- [ ] React: `references/react-rules.md` clean — hooks have full deps + cleanup, stable `key`, minimal state, full loading/error/empty.
- [ ] If server code touched: `references/backend-rules.md` clean — no hand-coded auth, health endpoint open, machine endpoints not forward-authed.
- [ ] `prettier --write` ran; `npm run lint` + `npm run build` pass.
- [ ] No hardcoded secrets; no leftover `console.log` / dead code; comments in English on non-obvious spots.
- [ ] Repo has Prettier config + `commit-msg` + `pre-commit` hooks installed (procedure §3).
- [ ] Commit follows `references/git-commit.md` (English Conventional Commits, lowercase description); only commit/push when the user asks.
- [ ] Docs keep up: non-obvious decisions in `docs/decisions.md`; module map/flow change → `docs/00-map.md` updated.
