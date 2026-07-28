---
title: Agent-OS evolution — temporal memory, idea-queue lifecycle, interest model, token-aware batching
kind: system-change
status: done
created: 2026-06-14
updated: 2026-06-14 # Phases 2 (interest model) + 3 (day-log recall tier) SHIPPED; idea-0002 shrunk→deferred (schema folded into P3)
related:
  - platform/standards/autonomy-contract.md
  - platform/plans/2026-06-14-autonomous-agent.md
  - .claude/skills/auto-pilot/SKILL.md
  - .claude/skills/memory/SKILL.md
  - platform/standards/documentation.md
  - platform/registries/skill-candidates.md
---

> **CLOSED 2026-07-28.** Phases 1–3 shipped long ago (idea queue, interest model, day-log recall tier). Phase 4
> (memory/harness) was largely delivered in the 2026-07-28 session, though **not the way this plan imagined it** —
> which is why the plan is being closed rather than carried:
>
> | Phase 4 workstream | Outcome |
> |---|---|
> | S4.1 identity vs churning rules | **Solved differently.** No `VISION.md`; instead `CLAUDE.md` split by *layer* (machine-agnostic agent OS vs per-target deployment) and trimmed 254 → 200 lines. |
> | S4.2 episodic compaction | **NOT done.** The day-log still grows unbounded. Re-filed as an idea so it gets ranked against everything else instead of lingering here. |
> | S4.3 routing / on-demand loading | **Done, natively.** Path-scoped `.claude/rules/`, JIT doc loading, and native auto-memory topic files that are not preloaded. No custom router was needed. |
> | S4.4 RAG / pgvector | **Still deferred, now measured.** Always-loaded context is ~10.7K tokens; grep + an index still answers retrieval. The real bloat was one 421KB ledger file, fixed by splitting it, not by embedding it. |
>
> The plan's own premise also shifted: it assumed the agent-OS would keep being hand-built. The 2026-07-28 session
> moved memory onto native rails and deleted auto-pilot for the same reason. Remaining work lives in the idea queue.


<!--
  NORTH-STAR capture of the supervisor's 2026-06-14 vision for evolving the agent's "operating system":
  day-based memory, an idea/todo queue with lifecycle + pushback + interest scoring, token-aware task
  batching, smoother session handoff, and (eventually) a RAG/vector memory store.

  This is the parent artifact. It decomposes the vision into phases; each phase becomes its OWN proposal
  (templates/proposal.md) with external prior-art before it flips to accepted. NOT a build order yet —
  status: draft until the supervisor agrees the shape + sequence below.

  CRITICAL framing: most of the "infrastructure" half is ALREADY BUILT or PLANNED in the autonomy layer
  (standards/autonomy-contract + the autonomous-agent plan's Layer C). This is EXTEND, not rebuild.
-->

## Problem

The supervisor works across multiple machines and wants the agent to **compound** — accumulate dated, queryable
knowledge; manage a living queue of ideas it prioritizes, pushes back on, and learns from; size work to fit a session;
hand off cleanly between sessions; and eventually retrieve knowledge cheaply via an external RAG instead of burning
tokens re-reading docs. Today: memory is a flat set of files with no temporal/milestone axis and no semantic retrieval
(`/memory` skill + `standards/documentation`); there is **no platform-native idea backlog** (`registries/skill-candidates`
is a one-time *external-skill* eval ledger, not a living queue); prioritization, interest-scoring, dedup, and dead-idea
pruning do not exist. The autonomy layer (built 2026-06-14 from another machine) already solved the hardest
infrastructure pieces — so the gap is narrower and more specific than the raw vision suggests.

## What ALREADY EXISTS (prior art IN-REPO — do not rebuild)

From the autonomy layer pulled today (`standards/autonomy-contract.md`, `auto-pilot/SKILL.md`, `2026-06-14-autonomous-agent.md`):

| Vision item | Status in autonomy layer | Implication |
| --- | --- | --- |
| Session→session handoff w/o re-init waste | **DONE.** "the plan file is the cross-context memory"; stateless worker reads plan + `00-map` + a referenced `decisions.md` entry; "Never `--continue`/`--resume`". | Don't design a new handoff — the durable-plan-on-disk model IS the handoff. |
| Split work to fit a session | **PARTIAL.** Worker takes "next 1–3 related safe-zone steps" — by COUNT, not token-size. Open question R4 = "batch sizing sweet spot". | Add a `cost:` annotation to plan steps; don't invent a token forecaster (see Misconceptions). |
| Idea/candidate queue + prioritization | **PARTIAL/PLANNED.** Layer C "Proposer" (C1–C3) is scoped but **NOT built**: bounded proposal queue (~5), gap-analysis grounded in external standards, Reflexion accept/reject memory. | **This is the spine of the request.** Build it = build Layer C. |
| Self-reflection / learn-from-logs | **PARTIAL + a hard finding.** Plan cites research: *"pure self-critique is harmful (98%→57%), needs an external signal."* Reflexion accept/reject = the planned signal (C2, unbuilt). | The supervisor's "chiêm nghiệm" instinct is right but naive self-review backfires — must anchor to the accept/reject signal. |
| Reserved end-of-session wrap budget | **PARTIAL.** Every batch ends with `/session-wrap` + commit — behavioral, not a reserved token budget. | Keep behavioral; a hard reserve isn't reliably enforceable (see Misconceptions). |
| Governance / propose-don't-execute / gates | **DONE.** T1–T4 tiers, `autonomy-gate.mjs`, research-before-design + `prior-art-check.mjs`. | New mechanisms plug into these; **`memory/**` is governance-protected** → autonomous day-log writes must live OUTSIDE `.claude/memory/`. |

## What is GENUINELY MISSING (the real work)

1. **Temporal / day-based memory** — no dated session-log artifact; no milestone anchoring; can't ask "what changed around milestone X" or "what did we decide this week" without manual file reading. (`registries/knowledge-ledger` has a date column but is a flat scan.)
2. **Idea-queue lifecycle** — intake → re-prioritize after each big feature → deep-analyze top-1 → agent pushback on biased/infeasible ideas → defer-list for rejected-but-maybe → duplicate-detection trigger → dead-idea pruning. None exists.
3. **Interest model** — a per-idea *bonus* score from a deeper user model, applied ONLY after an idea already passes feasibility+fit (never overriding logic). No user-interest signal feeds prioritization today.
4. **(Future) RAG / vector memory** — retrieve knowledge via an external LLM over a vector DB to save tokens. Premature now (volume is tiny: ~5 shared + ~7 local memory files, 19 ledger lines). A scaling milestone, not a now-build.

## Misconceptions to correct (verified against the `claude-api` reference)

These shape what is and isn't buildable — surfaced honestly per `/honest-critique`:

- **"Session has a 1-hour cache; after it the agent re-reads and wastes tokens."** Half-true, conflated. The **prompt cache** TTL is **5 min default** (or 1h opt-in) and affects **cost/latency only, NOT correctness**. Conversation **context does not vanish when the cache expires** — the API is stateless, the full history is re-sent every turn; cache expiry just means that re-send is billed at full input price instead of ~0.1×. The real cross-session boundary is **compaction** (when context nears the window limit), which the autonomy layer already handles via the stateless-worker/durable-plan model. So: there is no "1-hour cliff after which the agent forgets and must re-read files."
- **"Agent should know what % of the session remains."** Not reliably available to the agent itself. `/context` is **user-invoked**; the harness auto-compacts (~70–80%); there is **no live token meter the model can query mid-turn**. (Task Budgets is an API-builder feature that gives a *countdown* to a model you orchestrate — it is not Claude Code introspecting its own session.) Practical substitute: the stateless-worker model (fresh context per batch) + conservative batch sizing + `/context` checkpoints the *supervisor* reads.
- **"Agent computes the token cost of each task and packs tasks to fit a session."** Not feasible as *a-priori prediction* — `count_tokens` measures a known string, it can't forecast how many tokens unwritten work will take. The workable version: a coarse `cost: S/M/L` annotation on plan steps (human+agent estimate), **post-hoc calibration** (log actual tokens per step type over time → improve future estimates — this is where "more memory → better calibration" genuinely applies), and the existing 1–3-step batch heuristic.

## Recommended decomposition & sequence (extend the autonomy layer)

Build as phases of the EXISTING autonomy roadmap, not a parallel system. Each is its own `proposal.md` (with external prior-art) before build.

- **Phase 1 — Idea-queue + lifecycle (= autonomy Layer C "Proposer"). ✅ SHIPPED 2026-06-14.** Built: `platform/registries/idea-queue.md` (seeded w/ 8 real ideas) + skill `/idea` (capture/gate/sort/analyze/pushback/outcome/defer/kill) + CLAUDE.md pointers. Proposal `2026-06-14-phase1-idea-queue-proposal.md` (ACCEPTED), build `2026-06-14-phase1-idea-queue-build.md`. Intake → re-prioritize after each feature → deep-analyze top-1 → pushback → defer-list → dup trigger → prune; bounded ~5 active per C2; supervisor accept/reject = the oracle.
- **Phase 2 — Interest model (rides on Phase 1). ✅ SHIPPED 2026-06-14.** Proposal `2026-06-14-phase2-interest-model-proposal.md` (ACCEPTED, full Option A). `interest` is now DERIVED from human signals only (the `outcome:` oracle + `user-profile.md` §"Interest signals"), confidence-weighted (Hu 2008), capped ≤15%, re-derived per sort. Key addition beyond the cap: an **exploration floor** (≥1 wildcard/sort exempt from interest) because the bias compounds per round (Mansoury CIKM'20) and the cap alone doesn't stop homogenization. Rules in `registries/idea-queue.md` §Rules + procedure in `/idea` skill. First live re-derive already caught a homogeneous (no-wildcard) backlog.
- **Phase 3 — Temporal/day-log memory. ✅ SHIPPED 2026-06-14.** Proposal+build `2026-06-14-phase3-daylog-memory-{proposal,build}.md`. Recall tier `platform/log/` (README schema + `_TEMPLATE`), `/session-wrap` Step 1.5 + `/auto-pilot` Step 6 wired to write digests, `standards/documentation §2` documents the MemGPT 3-tier model, seeded+dogfooded (`log/2026-06-14.md`). **Folded idea-0002's schema-now half in** (nullable `embedding`); idea-0002 shrunk → deferred pgvector migration. Logs are recall = NEVER auto-loaded.
- **Phase 4 — Token-aware batching.** `cost: S/M/L` on plan steps + post-hoc calibration log; the auto-pilot skill reads `cost` instead of a fixed step count. **+ dedicated research sub-task (supervisor decision 2026-06-14):** investigate the most-accurate-feasible token estimation — `count_tokens` for known inputs, Task-Budgets-style countdown patterns, calibration models — and document the honest accuracy ceiling before committing a mechanism. Coarse `cost:` ships first; the research refines it.
- **RAG/vector memory — EARLY research + foundation (supervisor decision 2026-06-14: do NOT defer).** Research agent long-term-memory + RAG architectures and **design the vector schema now** (reuse journal's Postgres+pgvector) so later there is no migration. Stage the actual build sensibly, but lay the foundation early. ⚠️ Honest risk (flagged + accepted): designing retrieval before real volume can over-fit to today's tiny corpus — mitigate by grounding the schema in external memory-architecture prior art, not just current files.

## Open questions / forks (for the supervisor)

1. Confirm **extend-the-autonomy-layer** (build these as Layer C + additions) vs a separate system. (Strong rec: extend.)
2. Confirm **start with Phase 1 (idea-queue)** as the spine, interest+memory after. (Strong rec: yes.)
3. Accept the **reframe of token-budgeting** (coarse `cost:` + calibration, not live %/forecasting)?
4. RAG: agree to **defer behind a volume trigger**, not build now?

## Prior art & sources — gathered 2026-06-14 (research-before-design)

⚠️ Citation-verification caveat: a few arXiv IDs returned by the research pass look future-dated (post-cutoff) and MUST be re-fetched/verified before a per-phase proposal flips to accepted. The foundational papers and vendor docs below are solid and load-bearing; the conclusions hold regardless of the shakier IDs.

**Phase 1 — idea-queue lifecycle + prioritization + self-critique:**
- Prioritization models: **RICE** `(Reach×Impact×Confidence)/Effort`, **WSJF** `CoD/JobSize`, **Kano** (Must-be/Performance/Delighter — Delighter = where an interest bonus legitimately lives), **MoSCoW** as a coarse pre-gate, value/effort 2×2. → Design: feasibility+fit GATE first (MoSCoW/Kano), score survivors (RICE/WSJF), then an **interest bonus capped at ~15%** that can break ties / boost but never leapfrog a higher-value idea.
- Hygiene: GTD **Someday/Maybe** (cadenced review, cap the list, delete after N failed reviews) = the defer-list; Kanban **WIP limit** (~3 active) = the bounded queue (matches autonomy C2's "~5 max").
- Self-critique needs an EXTERNAL signal: [Huang et al. 2023 "LLMs Cannot Self-Correct Reasoning Yet"](https://arxiv.org/abs/2310.01798), [Reflexion — Shinn et al. 2023](https://arxiv.org/abs/2303.11366), [CRITIC — Gou et al. 2023](https://arxiv.org/abs/2305.11738), plus the MIT TACL 2024 survey "When Can LLMs Actually Correct Their Own Mistakes?". → The supervisor's **accept/reject is the oracle**; agent stores a verbal "why declined" memory (Reflexion) to avoid re-surfacing low-fit ideas; never treat no-response as a positive signal. (Full prioritization-framework URLs — RICE/WSJF/Kano/MoSCoW/GTD/Kanban — are in the Phase 1 proposal.)

**Phase 4 — token estimation (the honest ceiling):** a-priori per-task token forecasting is **fundamentally unreliable** — agent self-prediction correlates only r≈0.39 and systematically underestimates; the same task varies up to ~30× in tokens; output length has a stochastic floor (~11–18% noise). `count_tokens` measures only KNOWN input, not future output. A Claude Code agent **cannot** self-query remaining budget mid-session (Task Budgets exposes a countdown only to the model on the raw Messages API, not in Claude Code; `/context` is user-only). → The workable mechanism is NOT forecasting but **historical p99 per task-class + `cost: S/M/L` + a runtime hard cap (`max_tokens`/Task-Budget hint)**. The "research for max accuracy" track concludes: coarse sizing + post-hoc calibration is the ceiling; spend effort on enforcement, not prediction. (Sources: Anthropic count_tokens + Task Budgets docs; Stanford/MSR "How Do AI Agents Spend Your Money"; output-length-prediction papers — IDs to verify.)

**Phase 3 + RAG foundation — memory architecture:** [Letta/MemGPT](https://www.letta.com/blog/agent-memory) tiers (Core/Recall/Archival, self-editing), [Generative Agents (Park et al. 2023)](https://arxiv.org/abs/2304.03442) retrieval `score = recency(exp-decay) + relevance(cosine) + importance(LLM-rated at write time)`, [pgvector](https://github.com/pgvector/pgvector) + HNSW + hybrid BM25/RRF, frontmatter-as-schema, MIF (Memory Interchange Format) Level 1/2 fields, RAG-vs-context threshold (**don't build RAG under ~50K tokens / ~150 files** — our corpus is far below this). → **Design the frontmatter schema NOW** (UUID v4 `id`, `type` episodic/semantic/procedural, `taxonomy`, `namespace`, ISO `created`/`last_accessed`, `importance` 1–10 at write, `milestone_id`, `valid_from/until`, `tags`, `related_ids`, `source_uri`) so the eventual pgvector migration is a column-add with a **nullable `embedding`** populated only at the volume trigger. Day-log = `type: episodic`; milestone anchor = a reflection entry FK-linking child IDs. Honors "lay the foundation early" without premature RAG build.

## Decision (human) — 2026-06-14

1. **Extend the autonomy layer** (Layer C + additions), NOT a parallel system. ✓
2. **Start with Phase 1 (idea-queue)** as the spine; interest → memory → token-batching after. ✓
3. Token-batching: **accept coarse `cost:` + calibration now**, AND run a dedicated research sub-task to push token estimation as accurate as feasible (don't settle for the coarse version as final). ✓ (modified)
4. RAG: **do NOT defer — research + design the vector schema/foundation early** (override of the "defer behind a volume trigger" recommendation). ✓ (modified)

**Next action:** research-before-design (per `standards/autonomy-contract`) — gather external prior art for Phase 1 (idea-queue lifecycle + prioritization + self-critique-needs-external-signal), the token-estimation accuracy question, and the RAG/agent-memory foundation; then write the Phase 1 `proposal.md`.
