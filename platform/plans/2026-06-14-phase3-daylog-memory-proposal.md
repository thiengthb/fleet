---
title: Phase 3 — day-log + milestone-anchored temporal memory (the recall tier, RAG-schema-ready)
kind: system-change # feature | system-change — both REQUIRE prior-art before acceptance
status: accepted # draft → accepted → rejected | superseded
created: 2026-06-14
updated: 2026-06-14 # ACCEPTED — Option A + fold idea-0002 schema-now into this build; building this session
related:
  [
    platform/10-idea-queue.md (idea-0003 — the candidate this analyzes; couples idea-0002),
    platform/plans/2026-06-14-agent-os-evolution.md (parent — Phase 3 + RAG foundation),
    platform/06-knowledge-ledger.md (the cross-project index this complements),
    platform/05-documentation-standard.md (decisions.md = archival tier),
    .claude/skills/session-wrap (the writer of the recall→archival distillation),
    .claude/skills/auto-pilot/SKILL.md (already emits a per-batch digest — the raw material),
    platform/09-autonomy-contract.md (memory/** is governance-locked → log lives outside it),
  ]
---

<!--
  RESEARCH-GROUNDED proposal (research-before-design / anti-bias). Produced by `/idea analyze` on the top-1 active
  idea (idea-0003). Propose-don't-execute: queued for HUMAN approval; never self-enters the build pipeline.
  Sources verified 2026-06-14 (the two load-bearing arXiv IDs confirmed — resolves the parent plan's future-date caveat).
-->

## Problem

Knowledge accumulates across sessions (`decisions.md` per project, `06-knowledge-ledger.md` cross-project) but has **no
session-temporal or milestone axis**. The ledger has a date *column* but is a flat scan; `decisions.md` is append-only
*why*-entries, not dated session digests; and the autonomy worker already produces a per-batch digest (auto-pilot Step 7)
that is **ephemeral** — it scrolls past and is never persisted as a queryable record. So "what changed around milestone X",
"what did we decide this week", or "what was the state when we shipped B4" can only be answered by manual file-reading or
`git log` archaeology. This blocks the supervisor's stated goal (agent-os-evolution §"genuinely missing" #1) of an agent
that *compounds* — and it blocks the eventual RAG (idea-0002), which needs a structured, dated corpus to index. Grounding:
this is the recall tier that MemGPT (arXiv 2310.08560) names explicitly and that the platform currently lacks.

## Prior art & sources — REQUIRED: ≥2 external URLs (research BEFORE designing; all VERIFIED 2026-06-14)

- [Park et al. 2023, *Generative Agents*, UIST — arXiv 2304.03442](https://arxiv.org/abs/2304.03442) (formula confirmed via
  [ar5iv mirror](https://ar5iv.labs.arxiv.org/html/2304.03442)). **Reuse:** the memory-stream retrieval score
  `= recency + importance + relevance` (equal weights), where **importance is an LLM-rated 1–10 assigned at write time**
  and reflections form a **tree FK-linking source memories** — this is exactly the milestone-anchor → child-entries shape.
  **Avoid:** its recency decay (0.995/*hour*) is tuned for sandbox game-hours; re-parameterize for *day* granularity (logs
  decay far slower); equal weights are a default, not gospel.
- [Packer et al. 2023, *MemGPT*, arXiv 2310.08560](https://arxiv.org/abs/2310.08560) + [Letta memory blog](https://www.letta.com/blog/agent-memory/).
  **Reuse:** the 3-tier model — **core** (always in context) / **recall** (sequential history, on-demand) / **archival**
  (long-term, semantically indexed). Direct mapping: `00-map.md`+thin `CLAUDE.md` = core, **`log/YYYY-MM-DD.md` = recall**,
  `decisions.md`+ledger = archival. **Avoid:** MemGPT pages via hard capacity limits; a file system has no such pressure —
  be explicit about what is auto-loaded (core only) vs recalled on demand.
- [Sascha Fast, *Intro to the Zettelkasten Method*, zettelkasten.de](https://zettelkasten.de/introduction/) +
  [Obsidian Daily Notes docs](https://obsidian.md/help/plugins/daily-notes). **Reuse:** the **`YYYY-MM-DD` dated-file**
  convention + the **fleeting → permanent → structure** hierarchy = log → decisions → 00-map; "a link without a reason
  creates no knowledge" → `related_ids` must carry a *why*, not bare IDs. **Avoid:** Obsidian backlinks are GUI-rendered;
  for an agent, links must live in frontmatter or be grep-able — no graph engine runs.
- [Martin Fowler, *Event Sourcing* (2005)](https://martinfowler.com/eaaDev/EventSourcing.html). **Reuse:** each closed
  `YYYY-MM-DD.md` is an **immutable, append-only event**; temporal queries = read the log up to date X; state is derivable
  by replay. **Avoid:** don't import CQRS/event-store machinery — borrow only the immutability + append-only discipline.
- [Redis Eng., *RAG vs large context window* (Feb 2026)](https://redis.io/blog/rag-vs-large-context-window-ai-apps/) +
  [mmntm.net, *RAG bifurcation* (Jan 2026)](https://www.mmntm.net/articles/rag-bifurcation). **Reuse (the defer decision):**
  below **~200K tokens** long-context+caching beats a vector store; design the schema now (cheap), build embeddings at the
  volume trigger. **Avoid / caveat:** both are vendor/opinion (not peer-reviewed) — treat 200K as order-of-magnitude; the
  multi-source agreement on "skip RAG while tiny" is the load-bearing claim, not the exact number. Also "lost-in-the-middle"
  costs 10–20pts at long context → another reason recall tier ≠ "dump everything into context".

## Options considered — REQUIRED: ≥2, with tradeoffs

| Option | How it works | Benefit | Drawback / cost |
| --- | --- | --- | --- |
| **A — Markdown day-log (`platform/log/YYYY-MM-DD.md`), RAG-schema-ready frontmatter, milestone anchors, embeddings DEFERRED** *(recommended)* | Each session/batch appends a dated digest with frontmatter (`id`, `type: episodic\|reflection`, `created`, `last_accessed`, `importance` 1–10 at write, `milestone_id`, `related_ids` w/ reasons, `embedding: null`). Milestone = a `reflection` entry FK-linking its children (Park tree). Recall convention: newest→oldest, jump around a `milestone_id`. Immutable once the day closes (event-sourcing). Logs are **recall tier → never auto-loaded** (kept out of the `@import` path); read on demand. `/session-wrap` writes the digest, then distills the durable *why* into `decisions.md` (archival). | No new infra; rides existing markdown + git + `/session-wrap` + the auto-pilot digest. Schema is RAG-ready ⇒ idea-0002's migration is a column-add (nullable `embedding`), no rewrite. Tier roles are explicit (no duplication). Honours thin-context (recall not auto-loaded). | A third knowledge artifact to keep coherent; importance is agent-rated (calibration risk); discipline needed so it's read, not write-only. |
| **B — Build Postgres+pgvector now (idea-0002 immediately), digests as rows** | Stand up the vector store now; store every digest embedded for semantic recall. | Semantic recall from day one; no later migration. | **Premature** per the RAG-threshold research (corpus ≪200K tokens; full-context still wins +15–20% accuracy under ~1M). New infra + dep on journal's Postgres + embedding cost + over-fit to a tiny corpus. Violates "design now, build at trigger." |
| **C — Status quo: keep appending to `decisions.md` + ledger; rely on `git log`** | No new artifact; temporal questions answered by `git log --since` + reading decisions. | Zero added surface; `git log` is already an immutable dated event log. | No milestone anchoring / FK recall; ledger already bloating; commit granularity is noisy (not session-semantic); no schema substrate for the future RAG. |

## Recommendation

**Adopt Option A.** It delivers milestone-anchored temporal recall on existing infrastructure, makes the autonomy worker's
already-produced digest durable, and lays idea-0002's frontmatter schema *for free* (nullable `embedding` ⇒ the later
pgvector build is additive, not a migration).

- **Why not B:** the RAG-threshold research is explicit — skip the vector store under ~200K tokens; our corpus is tens of
  files. Design the schema now, build embeddings at the volume trigger (this is idea-0002's *later* half).
- **Why not C:** `git log` answers "what commit when" but not session-semantic "what did we decide / what state at milestone
  X"; no FK milestone recall; and it gives the future RAG nothing to index. (But see the Counter-case — C is closer than it looks.)
- **Scope-coupling flag for the supervisor (like idea-0009):** Phase 3 naturally implements idea-0002's "standardize the
  frontmatter schema now" half (the day-log *needs* that schema). Recommend **shrinking idea-0002 to just the eventual
  pgvector migration** and folding the schema-definition into this Phase 3 build — surfaced, not silently merged.

## Pre-mortem — REQUIRED: ≥2 failure modes

- **If the day-log duplicates `decisions.md`/ledger** → three-places-to-write drift. Mitigation: enforce the **tier split**
  (MemGPT) — log = *recall* (raw dated "what happened"), `decisions.md` = *archival* (distilled "why", append-only), ledger
  = cross-project *index*. `/session-wrap` writes the digest, then distills its durable bullets *upward* into decisions —
  one flow, not three copies. Spell this out in the skill or it rots.
- **If the frontmatter schema guesses wrong** → costly later migration. Mitigation: ground every field in Park/MemGPT/MIF
  prior art; `embedding: null` makes the RAG an additive column; keep `type` an open enum.
- **If agent-rated `importance` is miscalibrated/inflated** → recall noise. Mitigation: Park's importance is *event
  poignancy* (descriptive), not the agent grading its own work — lower risk; keep it coarse (1–10), treat it as a recall
  hint never a decision input, and let **milestone anchors (human-set)** carry the high-importance signal.
- **If logs leak into the auto-loaded context path** → context tax that violates the thin-`CLAUDE.md` invariant.
  Mitigation: logs are recall tier — **never** `@import`ed; read on demand by date/`milestone_id` only. 00-map stays the
  sole always-loaded map.
- **If the autonomy worker can't write the log** → `.claude/memory/**` is governance-locked (T4). Mitigation: the log lives
  in `platform/log/` (outside the lock) so a T2 branch-local write is allowed; confirm `autonomy-gate.mjs` treats it as T2.

## Counter-case

`git log` is *already* an immutable, append-only, dated event stream and `decisions.md` already holds the durable why — so
for a solo operator at this corpus size a third dated artifact risks becoming write-only overhead nobody reads; the cheapest
honest version may be a *recall convention over git history + decisions.md* (no new file type) until the corpus or the RAG
actually demands the structured log.

## Decision (human) — ACCEPTED 2026-06-14

**accepted, Option A** + **fold confirmed**: the frontmatter schema is defined IN this Phase 3 build (the day-log needs
it), and **idea-0002 shrinks to the later pgvector migration only** (moved to deferred, revisit at the volume trigger).
Build roadmap → `plans/2026-06-14-phase3-daylog-memory-build.md`. Tier discipline (log=recall / decisions=archival /
ledger=index) and "logs are never auto-loaded" are load-bearing acceptance criteria.
