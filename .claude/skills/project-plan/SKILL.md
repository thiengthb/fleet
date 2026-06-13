---
name: project-plan
description: Capture a substantial multi-step plan (feature, refactor, migration, hard bug fix) as a persisted file under docs/plans/ so the roadmap survives across sessions. Use when the user asks to "make a plan to develop/fix/improve X", "lay out the steps", or when the work spans more than one session. NOT for small one-off changes (use plan mode, then just do it).
---

# Skill: Persisted project plan (project-plan)

The **forward-looking** half of the Knowledge OS. `docs/decisions.md` records *why we did what we did* (retrospective);
a plan file records *what we intend to do + where we are in doing it* (prospective). It exists so a multi-session piece
of work keeps its roadmap + state on disk instead of evaporating when the conversation ends.

> Relationship to plan mode (`/plan`): they are complementary, not alternatives. Use **plan mode** to research read-only
> and get the user's approval *in the session*; use **this skill** to **persist** the approved plan so the next session
> remembers it. Typical flow: plan-mode research → user approves → write the plan file → execute → keep the file's checklist
> in sync as you go. The standard this skill follows: `nuc-platform/05-documentation-standard.md §5.5`.

## When to use it (and when NOT to)

Persist a plan file **only** when the work is substantial — a feature, a refactor, a migration, a hard multi-step bug
fix — i.e. likely to **span more than one session** or worth remembering as a roadmap. A small, same-session change
does **not** get a file: use plan mode, then just do it. Over-producing plan files turns `docs/plans/` into clutter and
costs context — resist it.

## Step 0 — Locate the project

Which project under `MiniServer/`? Look up its `kind` in `INVENTORY §0`. Plans live at `<project>/docs/plans/` — create
that directory if it doesn't exist. (Plans sit under `docs/` so they stay on the standard context-loading path; they are
NOT a top-level folder.)

## Step 1 — Check the existing plans first (this is the whole point)

Before writing a new plan, **glob `docs/plans/*.md` and read the frontmatter** of any with `status: active` or `status: draft`.
Reasons:

- The work may already have a plan in flight → continue/update it instead of starting a parallel one.
- An old plan's approach/tradeoffs inform the next plan (don't re-decide what was settled, don't repeat a ruled-out path).
- A `done` plan nearby may show how a similar thing was tackled.

Do **not** bulk-read every `done` plan on entry — that bloats context. Read `done` plans only when one is relevant to the
task at hand.

## Step 2 — Write the plan file

Path: `docs/plans/YYYY-MM-DD-<kebab-slug>.md` (date = today, slug = short topic, e.g. `2026-06-13-discord-reminders`).
Copy `templates/plan.md` and fill it in. Keep it **token-cheap** (tables + bullets + a checklist, not prose). The skeleton:

```markdown
---
title: <one line — what this plan delivers>
status: draft        # draft → active → done | abandoned
created: YYYY-MM-DD
updated: YYYY-MM-DD
related: [file.ts, INVENTORY §n, docs/plans/<prior>.md]
---

## Goal
One sentence: what "done" looks like (the observable outcome).

## Context
Why now, the constraints, what triggered it. 1–3 lines.

## Approach & tradeoffs
The chosen approach + what was ruled out and why (brief — the durable "why" is distilled to decisions.md at the end).

## Steps
- [ ] Step 1 — <action> · Files: Create/Modify `path:line` · Test: `<how it's verified>`
- [ ] Step 2 — ... (one line each; check off as you go, across sessions)

## Out of scope
Explicit non-goals, so a later session doesn't scope-creep.

## Open questions / risks
Things still unknown or risky (cap at ~3 — more than that means the plan isn't framed tightly enough). Strike through as they close.

## Decisions to distill
Bullets of non-obvious knowledge that should land in docs/decisions.md when this plan completes (handed off by /session-wrap).
```

Set `status: draft` until the user approves it; flip to `active` once execution starts.

**Two habits that make steps + execution sharp** (borrowed from the community plan/execute skills):
- **Actionable steps** — each step names the exact files it touches (`Create/Modify path:line`) and how it's verified
  (`Test:`). A step a fresh session can't act on without re-deriving context is too vague.
- **Critique the plan before executing** — before flipping to `active`, run `/honest-critique` over the plan: what's the
  weakest assumption, what's missing, what could break an invariant? Fix it in the plan, not mid-execution.

## Step 3 — Keep it in sync while executing

**Execute in small batches with a checkpoint.** Don't run the whole plan in one silent sweep — do ~3 related steps, then
report (and, for outward/irreversible steps, wait for the user) before the next batch. This is the rhythm this very
session used to adopt skills wave-by-wave. Each batch ends by checking off its steps + bumping `updated:`.


A plan file is **live**, not write-once. As you work (this session or a later one): check off steps, bump `updated:`,
append newly-discovered steps/risks. A stale checklist is worse than none — the next session trusts it.

## Step 4 — Closing a plan

When the work finishes (or is dropped):

- Flip `status:` to `done` (or `abandoned`, with a one-line reason).
- The durable "why" does **not** stay only in the plan — `/session-wrap` distills the **Decisions to distill** bullets
  into `docs/decisions.md` so the knowledge joins the compounding log. The plan file then stays as the historical roadmap
  but is off the default read path (its `status` is no longer `active`).

> Anti-overlap rule: `decisions.md` owns the retrospective "why"; plan files own the forward roadmap + execution state.
> When a plan closes, knowledge migrates one way (plan → decisions). Don't duplicate a settled decision in both as the
> live source of truth.

## Step 5 — Pointer in 00-map (light)

If a project has any `active` plan, `docs/00-map.md §8 Further reading` should point to `docs/plans/` ("active plans:
status: active"). No separate index file to maintain (that would just drift) — the `status:` frontmatter IS the index;
glob + read frontmatter to list them.
