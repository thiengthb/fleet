# Day-log — the platform's temporal RECALL tier

Dated session digests, one file per day: `nuc-platform/log/YYYY-MM-DD.md`. This is the **recall tier** of the agent's
memory (Phase 3 of the agent-os evolution). It answers "what happened / what did we decide around **when**" and
"what was the state at **milestone X**" — questions the flat ledger and per-project `decisions.md` can't answer by time.

> Design + verified sources: `../plans/2026-06-14-phase3-daylog-memory-proposal.md`. Build: `../plans/2026-06-14-phase3-daylog-memory-build.md`.

## The three memory tiers (MemGPT model — know which tier you're writing to)

| Tier | Where | Holds | Loaded? |
|---|---|---|---|
| **core** | `<project>/docs/00-map.md` + thin `CLAUDE.md` | the always-true map + invariants | **always** (auto-`@import`) |
| **recall** | **this `log/YYYY-MM-DD.md`** | dated "what happened" digests | **NEVER auto-loaded** — read on demand by date / `milestone_id` |
| **archival** | `<project>/docs/decisions.md` + `06-knowledge-ledger.md` | distilled, durable "why" (append-only) + cross-project index | on demand |

**The one flow (no duplication):** `/session-wrap` writes today's recall digest HERE first, THEN distills the durable
*why* upward into `decisions.md` / the ledger. The log is the raw record; decisions is the refined lesson. Never copy the
same content into both — link from the log entry to the decisions entry it spawned.

## Hard rules

1. **Never auto-loaded.** Do NOT add `log/` to any `@import` path or `CLAUDE.md`. It's recall — pulled in only when a task
   needs it. (Auto-loading it would re-introduce the context bloat the thin-`CLAUDE.md` rule kills.)
2. **Immutable once the day closes** (event-sourcing). Append more entries *within* today's file during the day; once the
   day is over, don't rewrite it — history is the record. Corrections go in a later day's entry that links back.
3. **Lives outside `.claude/memory/`** (which is governance-locked / T4). A write here is a T2 branch-local edit, so the
   autonomy worker may write it unattended (within an approved plan).
4. **`importance` is a recall hint, never a decision input.** It biases future retrieval ordering; it does not gate or
   rank work. The high-importance signal rides **human-set milestone anchors**, not agent self-rating.

## Entry frontmatter schema (RAG-ready — `embedding` stays null until idea-0002's pgvector build)

Grounded in Park et al. 2023 (importance/recency), MemGPT (tiers), and MIF memory fields. Every entry (a file may hold
several `episodic` entries + at most one `reflection` milestone anchor) carries:

```yaml
id: 2026-06-14-01           # stable: <date>-<seq>; the FK other entries reference
type: episodic              # episodic (a session/batch digest) | reflection (a milestone anchor)
created: 2026-06-14T00:00:00+07:00
last_accessed: 2026-06-14   # bumped when recalled (recency signal; optional to maintain by hand)
importance: 5               # 1–10, assigned at write (Park poignancy: 1 mundane … 10 pivotal)
milestone_id: null          # set on a reflection entry; episodic entries point UP to their milestone here
related_ids: []             # [{id: <id>, why: "<reason>"}] — a link without a reason creates no knowledge
embedding: null             # populated only at the pgvector volume trigger (idea-0002); additive, no migration
```

- **`type: episodic`** = a normal dated digest (one session or one auto-pilot batch).
- **`type: reflection`** = a **milestone anchor**: a synthesis entry that FK-links its child episodic entries (via their
  `milestone_id` pointing at this entry's `id`, and/or this entry's `related_ids`). Mirrors Park's reflection tree. Use it
  to mark "shipped B4", "agent-os Phase 3 done", etc., and to cross-reference the relevant `plans/` file.

## Recall convention (how to read this tier)

- **By recency:** newest file → older. Most questions are answered by the last few days.
- **Around a milestone:** find the `reflection` entry (grep `type: reflection` / the milestone name), then walk its
  `related_ids` / the episodic entries whose `milestone_id` points at it — advance/retreat in time from there.
- **By topic, pre-RAG:** plain `grep` over `log/*.md` (no embeddings yet). When the corpus crosses ~200K tokens / ~150
  files (RAG-threshold research), idea-0002 populates `embedding` and recall becomes semantic — same files, additive.

## Naming

- One file per day: `YYYY-MM-DD.md`. Multiple entries per file = multiple `##`-level blocks, each with its own frontmatter
  fenced block at the top of the block (or a single file-level entry for a quiet day).
- Template: `_TEMPLATE.md`.
