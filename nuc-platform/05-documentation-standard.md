# 05 — MiniServer documentation standard (Knowledge OS)

> **Documentation contract** applied to EVERY project in `D:\Projects\MiniServer\`. Purpose: an agent (and people)
> **understand a project in one cheap read**, and non-obvious knowledge **accumulates across sessions**
> instead of evaporating. This is the source of truth that the two skills `/project-docs` and `/session-wrap` reference.
>
> Established 2026-06-12. Inspiration + gold standard: the documentation set of `todo/`.

---

## 1. Why this file exists

Before 2026-06-12 documentation maturity across projects was wildly uneven (`todo` had a full set; `journal` was
bare; the worker only had a README). Consequence: every time an agent touched a project, it had to **re-read the
code from scratch to understand it** → token-expensive, and **the reasoning behind the code** (why this approach was
chosen, traps encountered) wasn't recorded → later sessions repeated the same old mistakes.

This standard solves exactly those two things:

1. **A fixed, cheap context-loading path** — the agent always knows what to read first, stops early when it has enough.
2. **A compounding mechanism** — each session records new knowledge into a committed log → later sessions get smarter.

---

## 2. The context-loading path — 3 tiers (INVARIANT)

An agent entering any project follows this exact order, **stopping the moment it has enough for the task**:

```
Tier 0 — INVENTORY §0            (1 table)     → what this project is, which kind, where
Tier 1 — <project>/docs/00-map.md (1 page)     → grasp the essence + module map + flows + invariants
Tier 2 — docs/ in depth          (per task)    → 01-product / 02-technical / 03-user-guide / *-spec
        + docs/decisions.md       (file tail)   → why the code is this way, known traps
        + docs/plans/ (status:active)(if any)   → forward roadmap of work currently in flight
```

- Each project's `CLAUDE.md` is a file Claude Code **auto-loads** (walking up the directory tree). Since auto-loading
  costs context every turn → keep it **thin**: only rules + the project's own invariants + a pointer "read `docs/00-map.md`
  to grasp it". Do **NOT** stuff the module map / flows / spec into `CLAUDE.md` — that's `docs/`'s job.
- `docs/00-map.md` is the core token-saving artifact: reading it gives you a "grasp" of the project without opening
  code. Always at this exact path, every kind.
- Read `docs/` in depth **only when the task needs it** (fixing AI → read 02-technical §AI; writing a guide → 03-user-guide…).

> **Memory tiers (MemGPT model) — know which one you're touching.** The loading path above is the *core* (`00-map`,
> always read) + *archival* (`decisions.md`/ledger, on demand) tiers. There is a third, **recall** tier: dated session
> digests in `nuc-platform/log/YYYY-MM-DD.md` (Phase 3). It captures "what happened around **when** / at milestone X" and
> is **NEVER auto-loaded** — read it on demand by date or `milestone_id` only (auto-loading would re-bloat context). The
> log is the raw record; `/session-wrap` distills its durable *why* **upward** into `decisions.md`. Schema + recall
> convention: `nuc-platform/log/README.md`. (Its frontmatter is RAG-ready — `embedding: null` until idea-0002's pgvector build.)

---

## 3. The standard documentation set by `kind` (tiered)

`kind` comes from `INVENTORY.md §0`. Column ✅ = mandatory, ➖ = not needed, "optional" = when it has value.

| File | `web-app` / `monorepo` | `worker`<br/>(node-bot / python-worker) | `infra` | `meta` |
|------|:---:|:---:|:---:|:---:|
| `README.md` (repo root — for people visiting GitHub) | ✅ | ✅ | ✅ | ✅ |
| `CLAUDE.md` (thin: rules + invariants + pointer) | ✅ | ✅ short | optional | optional |
| **`docs/00-map.md`** (AI-primer — §4) | ✅ | ✅ | ✅ | ✅ |
| **`docs/decisions.md`** (knowledge log — §5) | ✅ | ✅ | ✅ | optional |
| `docs/README.md` (docs set index) | ✅ | ➖ | ➖ | ➖ |
| `docs/01-product.md` (why / philosophy / users) | ✅ | ➖ | ➖ | ➖ |
| `docs/02-technical.md` (architecture / data model / flows / detailed deploy) | ✅ | ➖ | ➖ | ➖ |
| `docs/03-user-guide.md` (end-user guide) | ✅ | ➖ | ➖ | ➖ |
| `docs/NN-*-spec.md` (deep feature spec, loaded on-demand) | optional | ➖ | ➖ | ➖ |

**Two new pillars every project has:** `docs/00-map.md` (the cheap-to-read one) + `docs/decisions.md` (the
compounding one). Worker/infra stopping there is enough — do NOT force the 01/02/03 set onto a headless bot (wasteful, extra effort).

> **Beyond `docs/` — every app with a UI also ships an in-app guide page** (route `/guide`), per the skill
> `/user-guide`: task-oriented, with a dedicated tab per machine-facing integration (Discord / MCP). The
> in-app guide mirrors `docs/03-user-guide.md` but is user-facing (written in the product's language).

> Gold standard `web-app`: `todo/docs/` (full 01/02/03/04 + README). `todo`'s `00-map.md` is exactly the distillation
> of §3 (module map) + §4 (flows) from `todo/docs/02-technical.md`.

---

## 4. `docs/00-map.md` — MANDATORY skeleton (AI-primer)

Goal: **≤ ~1 page**, reading it gives you a grasp of the project without opening code. Write it dense, no rambling. 8 fixed
sections (keep the exact order + headings so the agent can scan fast):

```markdown
# <project name> — Map

> One sentence: <what this app is, for whom>. `kind`: <web-app|worker|…>. Deploy: <domain or "headless"> · NUC `/opt/apps/<name>`.

## 1. Essence
2–4 lines: the problem it solves, the core value, what is NOT its goal.

## 2. Stack
A short table: framework · UI · data · AI/external · deploy. (web-app follows the standard /coding-convention stack.)

## 3. Module map / entry points
A CONDENSED directory tree — only the important directories/files + a one-line "what it does". This is the part the agent uses most.
(Template: todo/docs/02-technical.md §3.)

## 4. Main flows
The 1–3 most important flows, each a few numbered steps (e.g.: mutation, AI call, cron). Note traps/trust-boundaries inline.

## 5. Highlights
The clever / non-obvious things worth knowing: dynamic computation instead of stored columns? trust boundary? an unusual architectural decision?
(These are the "highlights" so people + AI quickly grasp the subtle bits — don't leave it blank if the project has something special.)

## 6. Invariants
Rules that must NOT be broken when editing this project (distilled from CLAUDE.md + platform). One invariant per line.

## 7. Secrets / env
Which variables are needed to run (NAMES only, NO values) + where they live (.env on NUC / GitHub Secret / Variable). Mark build-time variables.

## 8. Further reading
Pointers: which deep docs for which task · `docs/decisions.md` (why + traps) · INVENTORY §<n> · related skill.
```

**Rules for writing it token-cheaply:** prefer tables + trees + bullet points over prose; a few lines per section; point
to deep docs instead of copying them; avoid repeating what `CLAUDE.md` already said (link, don't copy).

---

## 5. `docs/decisions.md` — the knowledge log (the compounding mechanism)

Append-only, **newest on top**. Record **non-obvious** knowledge: architectural decisions + reasons, traps
encountered + how to avoid them, trade-offs weighed. Do **NOT** record what the code/git already says (renaming a
variable, fixing a typo).

Each entry follows this exact skeleton (short — 4 lines is enough):

```markdown
## YYYY-MM-DD — <decision/trap title, one line>

**Context:** why this decision was necessary (1–2 sentences).
**Decision / Trap:** what was chosen, or what the trap is.
**Why:** the reason + what was ruled out (this is the most valuable part — don't skip it).
**Related:** `file.ts:42` · [[other-name]] · INVENTORY §n.
```

The "is it worth recording?" criterion — ask: *if a later session didn't know this, would it repeat the mistake /
break an invariant / waste time re-investigating?* Yes → record it. This is the job of the `/session-wrap` skill.

> Different from `nuc-platform/02-known-traps.md` (**system/platform**-level traps) and
> `06-knowledge-ledger.md` (a cross-project index). `decisions.md` is the traps + decisions **of a single project**.

---

## 5.5 `docs/plans/` — the forward roadmap (the prospective mechanism)

If `decisions.md` is the **retrospective** log (*why we did what we did*), `docs/plans/` is its **prospective**
counterpart (*what we intend to do + where we are in doing it*). It exists so a piece of work that **spans more than one
session** keeps its roadmap + execution state on disk instead of evaporating with the conversation. Maintained by the
`/project-plan` skill.

- **One file per substantial plan**, path `docs/plans/YYYY-MM-DD-<slug>.md`. Substantial = a feature / refactor /
  migration / hard multi-step bug fix. A small same-session change does **NOT** get a file — use plan mode (`/plan`) and
  just do it. Over-producing plan files is clutter and costs context.
- **`status:` frontmatter IS the index** (`draft → active → done | abandoned`) — no separate index file to drift. To list
  in-flight work: glob `docs/plans/*.md`, read frontmatter, filter `status: active`.
- **Live, not write-once:** the checklist is kept in sync as work proceeds (this session or a later one). A stale plan is
  worse than none.
- **Complementary to plan mode**, not a replacement: plan mode researches read-only + gets in-session approval; the plan
  file **persists** the approved roadmap for the next session. Flow: plan-mode research → approve → write file → execute →
  sync checklist.
- **Anti-overlap with `decisions.md`:** plan files own the forward roadmap + state; `decisions.md` owns the durable "why".
  When a plan closes, `/session-wrap` **distills** its *Decisions to distill* bullets into `decisions.md` (knowledge
  migrates plan → decisions, one way) and flips the plan to `done`. Don't keep the same settled decision as the live
  source of truth in both.
- **Context-loading:** only `active`/`draft` plans are on the default read path (and only when the task relates to them);
  `done`/`abandoned` plans are read on-demand. Do NOT bulk-read finished plans on entry.

> Different from `decisions.md` (backward, append-only knowledge) and from a one-off in-session plan (ephemeral, not
> persisted). A plan file is the persisted roadmap of **one multi-session effort** in **one project**.

---

## 6. Relationship with personal memory (`~/.claude/.../memory`)

- `docs/decisions.md` = knowledge **of the project**, committed, everyone reads it, travels with the repo.
- Personal memory = the user's preferences/feedback, private, per-machine. NOT the same role.
- Rule: knowledge about *project code/decisions* → `decisions.md`. Feedback about *how the user wants to work* →
  memory. A lesson *spanning multiple projects* → `06-knowledge-ledger.md` (index).

---

## 7. Enforcement (keeping docs from drifting off the code) — light

- **Skill `/project-docs`** scaffolds (generates the missing docs set, copied from the reference app of the kind) + audits
  (detects code↔docs drift, read-only report).
- **Skill `/project-plan`** persists a substantial multi-session plan into `docs/plans/` (and keeps its checklist in sync)
  so the roadmap survives across sessions — the forward-looking counterpart to `decisions.md` (§5.5).
- **Skill `/session-wrap`** at the end of a session: extracts decisions/traps → `decisions.md`; updates `00-map` if the
  module map changed; closes a finished plan (`done`) + distills its knowledge into `decisions.md`; one line into
  `06-knowledge-ledger.md` if cross-project.
- **A light pre-commit hook** (`coding-convention/hooks/pre-commit`): a commit touching code but NOT touching `docs/`
  → a **non-blocking** warning (doesn't block). It nudges, doesn't obstruct.
- **`/nuc-new-project`**: a newly created project has already run `/project-docs scaffold` → born-documented.
- **`/nuc-health-audit`**: checks that every project in §0 has the full doc-set per the §3 table (platform-level drift).

---

## 8. Quick checklist when touching a project

- [ ] Does `docs/00-map.md` have all 8 sections of §4? Missing → `/project-docs scaffold`.
- [ ] Does the module map / flows in `00-map` still match the code? Mismatched → update it (or `/project-docs audit`).
- [ ] Does this session have a non-obvious decision/trap? Yes → record it in `docs/decisions.md` (via `/session-wrap`).
- [ ] Is the work multi-session/substantial? → persist a plan in `docs/plans/` (via `/project-plan`); keep its checklist in sync.
- [ ] Is `CLAUDE.md` still thin (not bloated with spec)? Heavy spec → split it into `docs/`.
- [ ] A cross-project lesson? → add one line to `06-knowledge-ledger.md`.
