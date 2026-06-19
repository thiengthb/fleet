---
status: draft # draft (research-pending) → proposed → accepted → done
created: 2026-06-19
kind: proposal # analyze stage of /idea → proposal → /project-plan; NOT a build plan yet
milestone_id: closed-loop-driver-phase4
related: 2026-06-18-closed-loop-driver.md (Phase 4), 2026-06-14-agent-os-evolution.md, 10-idea-queue.md (idea-0002, idea-0005)
research_status: PARTIAL — foundation grounded in the 2026-06-14 cited prior art; the 3 NEW mechanisms below await external research (interrupted 2026-06-19 by a session limit; re-run after reset). Per research-before-design, the new mechanisms are NOT yet designed, only framed with in-repo-precedent candidate options.
---

# Proposal — Closed-loop Phase 4: memory / harness redesign

> **Propose-don't-execute.** This opens Phase 4 (the last phase of `2026-06-18-closed-loop-driver.md`, deferred to
> research-after). It is a *framing + options* artifact, not a build plan. The genuinely-new mechanisms are gated behind
> completing external research (see `research_status`); the supervisor accepts an option set before any `/project-plan`.

## Problem

The closed loop (Phases 0–3) now runs review→fix→propose→accept→plan→split→execute→synthesize→wrap→retro→re-prioritize
unattended, with Discord as the human touchpoint. Its remaining weakness is the **memory/context substrate**:

- **Rules and identity are tangled.** `CLAUDE.md` mixes the agent's stable *north-star/identity* with fast-churning
  *operational rules* — every rule edit re-reads the identity, and the agent has no stable self-concept doc.
- **The episodic day-log grows unbounded.** `nuc-platform/log/` accumulates `type: episodic` entries with no automatic
  compaction; recall stays cheap only because logs are NEVER auto-loaded, but cross-session synthesis is manual.
- **Loading is coarse.** A flat `MEMORY.md` index loads every session; `references/<domain>.md` on-demand loading (the
  skill-law refactor) proved the pattern but there is no general *router* for picking the right context per task.
- **No retrieval foundation in use.** The frontmatter schema with a nullable `embedding` exists (Phase 3) but pgvector
  retrieval is unbuilt (idea-0002, deferred behind a volume trigger).

## What ALREADY EXISTS — do not rebuild (and the research that grounds it)

From `2026-06-14-agent-os-evolution.md §85–96` (research-before-design, cited there):

- **3-tier memory (MemGPT/Letta):** core rules (CLAUDE.md) · recall day-log (`log/`) · archival ledger/decisions. Tiers
  documented in `05-documentation-standard §2`.
- **Retrieval scoring prior art:** Generative Agents (Park 2023) `score = recency(exp-decay) + relevance(cosine) +
  importance(LLM-rated at write)`; pgvector + HNSW + hybrid BM25/RRF.
- **RAG-vs-context threshold:** don't build RAG under **~50K tokens / ~150 files** — measured below to confirm we are
  still far under it.
- **Frontmatter-as-schema** already designed (UUID `id`, `type`, `importance`, `milestone_id`, `related_ids`, nullable
  `embedding`) so the eventual migration is a column-add, not a rebuild.
- **Token estimation ceiling** (relevant to harness): a-priori forecasting is unreliable (r≈0.39) → enforce with
  historical p99 + `cost: S/M/L` + hard cap, don't predict (idea-0005, active).

## Current corpus volume (measured 2026-06-19 — informs the RAG build/defer call)

> ⚠️ Re-measure when re-running (the 2026-06-19 measurement was interrupted by a classifier outage; fill in exact
> counts on the next pass). Expectation from prior art: a few dozen memory/doc/ledger files — **well under the
> ~50K-token / ~150-file RAG crossover**, so RAG stays a *foundation* (schema only), not a now-build.

## The four workstreams (S4.x) — framing + candidate options

### S4.1 — VISION.md separate from rules  ·  research: PENDING
Separate the agent's stable identity/north-star from churning operational rules.
- **Option A — a thin `VISION.md`** (identity, mission, the supervisor relationship, the propose-don't-execute ethos),
  imported by `CLAUDE.md` like `MEMORY.md` is. Stable, rarely edited; rules keep churning around it. *In-repo precedent:*
  the `@.claude/memory/MEMORY.md` import mechanism already works this way.
- **Option B — a Letta-style "persona block"** embedded but clearly delimited inside `CLAUDE.md`. Cheaper (one file) but
  does not solve the re-read-on-every-rule-edit churn.
- *Tradeoff axis:* token churn vs file sprawl vs how load-bearing the identity should be for autonomous decisions.
- **External research needed:** identity/spec separation patterns (Letta memory blocks; Claude constitution; AGENTS.md
  vs CLAUDE.md). → grounds the choice; do not finalize without it.

### S4.2 — Automatic episodic compaction  ·  research: PENDING
Compact old `type: episodic` day-log entries into higher-level summaries without losing important facts.
- **Option A — importance-decay reflection synthesis** (Generative Agents style): when accumulated importance crosses a
  threshold, synthesize a `type: reflection` anchor from the period's high-importance episodics; keep anchors, age out
  raw episodics. *In-repo precedent:* the reflection-anchor FK already exists.
- **Option B — size/time-window rolling summary** (MemGPT recursive summarization): when a month's log exceeds N
  tokens/entries, summarize the oldest window into one digest. Simpler trigger, blunter (may drop a low-importance but
  load-bearing fact).
- *Tradeoff axis:* trigger (importance vs size/time) · lossiness · who runs it (a `/session-wrap` step vs a scheduled
  batch) · the hallucinated-summary risk.
- **External research needed:** compaction triggers + failure modes (lossy/hallucinated summaries) — exactly what the
  interrupted research was gathering.

### S4.3 — Routing / INDEX for on-demand loading  ·  research: PENDING
Generalize `references/<domain>.md` on-demand loading into a router that picks the right context per task.
- **Option A — metadata/keyword router** (an enriched INDEX: each memory/doc tagged with trigger-topics; the agent
  matches the task to tags and loads only those). Deterministic, cheap, no embeddings; fits a small corpus. *In-repo
  precedent:* `MEMORY.md` one-line descriptions + the skill `description`-as-trigger pattern.
- **Option B — embedding/semantic router** (load by cosine match). More powerful, but premature at this corpus size and
  couples to the (deferred) RAG build.
- *Tradeoff axis:* determinism/auditability vs recall · build cost · coupling to RAG.
- **External research needed:** routing patterns + small-corpus cost/accuracy tradeoffs.

### S4.4 — RAG / pgvector foundation  ·  research: GROUNDED (defer the build)
- The schema foundation exists; build is gated behind the **~50K-token / ~150-file** volume trigger (idea-0002,
  deferred). **Recommendation: keep deferred** — confirm via the re-measured corpus volume above. Lay no new code now;
  only ensure new memory/log writes keep the nullable-`embedding` schema so the eventual migration is a column-add.

## Recommended sequence (for the supervisor to accept/modify)

1. **S4.1 first** (cheapest, unblocks identity-stability) → 2. **S4.3 router** (compounds with every later load) →
   3. **S4.2 compaction** (needs the most research + carries the most risk) → 4. **S4.4 stays deferred**.
2. **Gate:** finish the external research (re-run after the session-limit reset), fill the PENDING blocks with cited
   options, then bring this back as `status: proposed` for the human accept → `/project-plan`.

## Open questions for the supervisor

1. Is a standalone `VISION.md` worth a new always-loaded file, or is the churn cost low enough to leave identity in
   `CLAUDE.md`?
2. Should compaction run inside `/session-wrap` (human-cadence, supervised) or as an autonomous scheduled batch?
3. Confirm: RAG stays deferred behind the volume trigger (yes/adjust the threshold)?

## Decisions to distill (at accept time)

- Foundation (memory tiers, retrieval scoring, RAG threshold, schema) is already research-grounded — Phase 4 reuses it,
  does not re-derive it.
- The new mechanisms (VISION split, compaction, routing) must be externally grounded before design — this artifact
  deliberately stops at framing because the research was interrupted (honest research-before-design).
