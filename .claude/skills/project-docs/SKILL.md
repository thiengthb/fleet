---
name: project-docs
description: Generate & sync the standard doc set for a project in MiniServer (00-map AI-primer, decisions knowledge log, and the 01/02/03 set for web-app) per the nuc-platform/05-TAI-LIEU-CHUAN.md standard. Two modes — scaffold (create the missing doc files, copy the structure from the kind's reference app) and audit (detect code↔docs drift, read-only report). Use when creating a new project, a project is missing/out-of-sync on docs, the user says "write docs for this project", "do the docs still match the code", or for the docs step in /nuc-new-project.
---

# Skill: Standard docs for a project (project-docs)

Generate and keep in sync the doc set per **`nuc-platform/05-TAI-LIEU-CHUAN.md`** (read it first — that's the
contract; this skill is just the execution process). End goal: every project has `docs/00-map.md` (an agent
understands it in one cheap read) + `docs/decisions.md` (accumulated knowledge), and web-app also has the full 01/02/03 set.

**Don't invent a different structure** from §3/§4/§5 of 05-TAI-LIEU-CHUAN. If you find the standard needs to change →
change the standard file first, then follow it.

## Step 0 — Determine the project & kind

1. Which project (directory under `D:\Projects\MiniServer\<name>`)?
2. Look up the `kind` in `nuc-platform/INVENTORY.md §0`. No row yet → this is a new project: ask the user for the kind
   (`web-app`/`monorepo`/`worker`/`infra`/`meta`) and **add the §0 row first** (anti-drift).
3. The `kind` determines the mandatory file set (table §3 of 05-TAI-LIEU-CHUAN) + **the reference app to copy from**:

| kind | Reference to copy structure from | Mandatory file set |
|------|--------------------------|------------------|
| `web-app` (Next) | `todo/docs/` | 00-map · decisions · README · 01-product · 02-technical · 03-user-guide |
| `monorepo` | `todo/docs/` (02-technical describes a multi-image topology like `yakudoku`) | same as web-app |
| `worker` (node-bot/python-worker) | `nuc-monitor/` (lean structure) | 00-map · decisions · README |
| `infra` | `authentik/docs/` | 00-map · decisions · README |
| `meta` | — | README · (decisions if valuable) |

## Mode A — scaffold (create the missing files)

Run when the project lacks the doc-set (a new project, or an old one that's empty).

1. **Read enough code to truly understand** (don't make it up): entry points (`app/`, `src/`, `index.*`, `main.py`),
   `package.json`/`requirements.txt` (stack), Prisma schema / models, route handlers + server actions,
   `Dockerfile` + `deploy.yml` (deploy), `.env.example` (secrets — variable NAMES only). For a web-app use
   `/coding-convention` as the basis for understanding the stack.
2. **Generate `docs/00-map.md`** following exactly the 8-section skeleton in §4 of 05-TAI-LIEU-CHUAN. Token-cheap rule: tables +
   an abbreviated directory tree + bullets; a few lines per section; point to deep docs instead of copying. Section 5 "Highlights"
   must name the real clever/non-obvious bit (computed dynamically? trust boundary? unusual topology?) — don't leave it empty if there is one.
3. **Generate `docs/decisions.md`** from the template `templates/decisions.md` (header + 1 seed entry if a non-obvious
   decision can be extracted from the code/CLAUDE.md/INVENTORY; if there's nothing worth recording yet → keep the header + the note "no
   entries yet").
4. **web-app/monorepo**: also generate `docs/README.md` (index — copy the table style of `todo/docs/README.md`),
   `01-product.md`, `02-technical.md`, `03-user-guide.md`. Copy the **section layout** from `todo/docs/` then fill in
   the project's REAL content (don't leave any of todo's placeholders behind).
5. **Thin `CLAUDE.md`**: if there isn't one → create a short version (rules + project-specific invariants + a pointer "read
   `docs/00-map.md`"). If one exists but is bloated with spec → propose splitting the spec out into `docs/` (as `todo` did), ASK
   before cutting.
6. **Update the index**: add/edit the project line in `nuc-platform/06-SO-TRI-THUC.md §B`.
7. **Do NOT commit/push automatically.** Report the files created, for the user to review. Pushing the app repo = triggers CI → ask the user.

## Mode B — audit (detect code↔docs drift)

Run when you want to know whether the docs still match the code (read-only — report only, like `/nuc-health-audit`).

Reconcile and list the mismatches:
- **Module map (`00-map §3`) vs reality**: new route/model/lib/directory not in the map? A map entry pointing to a
  deleted/renamed file?
- **Stack (`00-map §2`) vs `package.json`/`requirements.txt`**: a major version mismatch / a dropped lib?
- **Secrets (`00-map §7`) vs `.env.example`**: a new variable not recorded?
- **Is the full set present per kind** (table §3): any mandatory file still missing?
- **`decisions.md`**: is there a big decision in recent git that hasn't been recorded? (suggest running
  `/session-wrap`.)

Report by ✅/⚠️ section, one line per mismatch + a proposed fix. **Don't edit files automatically** unless the user agrees; once
edited, still do NOT commit/push without being asked.

## Acceptance

- `docs/00-map.md` is grasped in one read; the module map matches the code; the "Highlights" + "Invariants" are real.
- The full file set is present per `kind` (table §3 of 05-TAI-LIEU-CHUAN).
- `INVENTORY §0` has the project row; `06-SO-TRI-THUC §B` has the pointer.
- No leftover placeholder/content from the reference app.
