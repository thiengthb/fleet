# `platform/` — the machine-agnostic agent OS

> Everything here is true on **every** machine. Deployment law that depends on the machine lives in
> [`targets/`](targets/README.md). If a document would read differently on a NUC than on a laptop, it is in the
> wrong folder.

**Read on need, not reflexively.** Nothing in here is loaded automatically — that is the point. A trivial turn
needs none of it; a task that touches a project reads that project's `docs/00-map.md` first, and comes here only
when the task actually needs a rule.

## The one registry that outranks the rest

**[`inventory.md`](inventory.md)** — every project, its `kind`, and its **`target`**. The `target` field decides
which deployment law binds. It is DATA: read it, never assume. Any lifecycle change must update it in the same
turn of work.

## `standards/` — rules. Stable, small, read when the task touches them.

| Read when | Document |
|---|---|
| Writing or auditing docs · plans · the knowledge log | [`documentation.md`](standards/documentation.md) |
| Deciding how to test a change, or writing acceptance criteria | [`testing.md`](standards/testing.md) |
| Building a page frame or laying out a screen | [`ui-layout.md`](standards/ui-layout.md) |
| Reviewing a **running** UI (a11y, contrast, responsive, CLS) | [`uiux-review.md`](standards/uiux-review.md) |
| Choosing a model, staffing subagents, or doing web research | [`token-and-research.md`](standards/token-and-research.md) |
| An unattended / headless run — tiers, gates, what is hard-blocked | [`autonomy-contract.md`](standards/autonomy-contract.md) |

## `registries/` — living data. Appended to, never "finished".

| Read when | Document |
|---|---|
| Something infra-shaped broke and it feels familiar | [`known-traps.md`](registries/known-traps.md) |
| Checking whether a lesson has already been learned (index → [`ledger/`](ledger/)) | [`knowledge-ledger.md`](registries/knowledge-ledger.md) |
| Before building a feature — has this been built already? | [`shared-assets.md`](registries/shared-assets.md) |
| Considering a community skill (verdicts: adopted / borrowed / rejected + why) | [`skill-candidates.md`](registries/skill-candidates.md) |
| Capturing an idea, or asking "what next" | [`idea-queue.md`](registries/idea-queue.md) |

> **Registries bloat; standards do not.** Measured 2026-07-28: every platform document over 15KB is a registry
> (14–57KB); no standard reaches 16KB. That is not a discipline failure — it is what append-only data does. The
> consequence is that a *rotation* mechanism belongs on registries specifically (`knowledge-ledger` already has
> one: the index stays scannable, the detail lives in `ledger/YYYY-MM.md`). The other four do not have one yet.

## Folders

| Folder | What it holds |
|---|---|
| [`targets/`](targets/README.md) | Per-target deployment law: `nuc/` · `local/` · `cloud/` |
| `ledger/` | Full text of every cross-project lesson, by month. The index is `registries/knowledge-ledger.md` |
| `log/` | The dated recall tier — raw "what happened", never auto-loaded |
| `plans/` | Persisted multi-session roadmaps. `status:` frontmatter **is** the index — glob it, don't maintain a list |
| `proposals/` | Governance drop-ins awaiting a human to apply them |
| `skill-proposals/` | Drafted skills awaiting human review. The agent never writes to `.claude/skills/` |
| `backup/` | Backup strategy + scripts |

## File naming

**`lowercase-kebab-case.md` for every file. `README.md` is the only exception** (tooling convention).

Written down 2026-07-28, because until then **there was no rule** — the mix of `INVENTORY.md`,
`07-SKILL-CANDIDATES.md` and `05-documentation-standard.md` was not drift from a convention, it was the absence
of one. Worth checking before assuming drift: sometimes there is nothing to drift from.

**No number prefixes.** They encoded creation order and nothing else, and the first reorganisation
(2026-07-28, three documents moving into `targets/nuc/`) turned the sequence into 02, 05–14 — holes that taught
nobody anything. A folder plus a descriptive name carries the same ordering information and stays true when
files move. This index does the job the numbers were pretending to do.
