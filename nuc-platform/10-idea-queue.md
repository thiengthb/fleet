# 10 — Idea Queue (platform-native backlog)

> The platform's **living backlog of its own ideas** — distinct from `07-SKILL-CANDIDATES.md` (external community-skill
> verdicts). This is the front door of the autonomy **Layer C "Proposer"**. Managed by skill **`/idea`**; design +
> rationale in `plans/2026-06-14-phase1-idea-queue-proposal.md`; parent vision in `plans/2026-06-14-agent-os-evolution.md`.
>
> **Propose-don't-execute:** the agent may capture / score / rank / push back / dedup autonomously, but an idea becomes
> a plan ONLY when the supervisor sets `outcome: accept`. No-response is **not** approval.

## Rules

- **States:** `inbox` (captured, ungated) → `active` (gated-in, ranked) → `analyzing` (top-1 deep-dive) → `proposed`
  (has a `proposal.md`, awaiting human) → `done` (became a plan / shipped) · `deferred` (someday/maybe, has
  `revisit_when`) · `dead` (pruned — keep the tombstone + reason, don't delete the block).
- **Gate FIRST, score SECOND:** an idea enters `active` only after a feasibility+fit gate (`moscow: must|should|could|wont`
  + "does it fit the system?"). `wont` / no-fit → `deferred` or `dead`.
- **Ranking:** coarse RICE `base = reach×impact×confidence / effort` (ordinal HINT, not truth — real rigor lives in the
  proposal). `rank = base × (1 + 0.15 × interest)`. **Interest bonus is capped at 15%** — it breaks ties / nudges, it
  **never** lets a lower-value idea leapfrog a higher one. Gate is absolute; interest is a Delighter-tier bonus.
- **WIP cap:** keep `active` ≤ 5 (Kanban). Over the cap → defer the lowest-ranked. Re-sort after every big feature ships.
- **Oracle = supervisor accept/reject.** Record it in `outcome:` with the *why* — that verbal signal (Reflexion) biases
  future agent proposals away from rejected patterns. Self-scoring in a closed loop is forbidden (it degrades — see proposal §Prior art).
- **Dedup:** new idea similar to an existing one → set `dedup_of:` + **flag the supervisor** to re-analyze jointly; don't silently merge.
- **Prune:** `deferred` that fails re-scoring twice, or is fundamentally unfit → `dead` (tombstone + reason).

## Queue

<!-- newest/active near top; sorted by rank within active. one block per idea, stable id. -->

### idea-0001 — Phase 2: user interest model (formalize the interest signal)
state: active · source: user · created: 2026-06-14 · updated: 2026-06-14
gate: pass · moscow: should · reach: 2 impact: 2 confidence: 0.7 effort: 2 · base: 1.4 · interest: 0.7 · **rank: 1.55**
proposal: null · outcome: null
> A per-idea interest *bonus* (≤15%) from a deeper user model (extends `.claude/memory/user-profile.md`), applied only
> after feasibility+fit. Rides on Phase 1's queue. Why: keeps the supervisor engaged enough to steer (not "tự biên tự diễn").

### idea-0002 — RAG/vector memory foundation (design schema now, build at volume trigger)
state: active · source: user · created: 2026-06-14 · updated: 2026-06-14
gate: pass · moscow: should · reach: 3 impact: 2 confidence: 0.6 effort: 3 · base: 1.2 · interest: 0.9 · **rank: 1.36**
proposal: null · outcome: null
> Standardize memory frontmatter now (UUID/type/taxonomy/importance/milestone_id/…, nullable `embedding`); migrate to
> journal's Postgres+pgvector at ~150 files / ~80K tokens. Supervisor wants the foundation early (parent plan, fork 4).

### idea-0003 — Phase 3: day-log + milestone-anchored memory
state: active · source: user · created: 2026-06-14 · updated: 2026-06-14
gate: pass · moscow: should · reach: 3 impact: 2 confidence: 0.7 effort: 3 · base: 1.4 · interest: 0.6 · **rank: 1.53**
proposal: null · outcome: null
> Dated session digests in `nuc-platform/log/YYYY-MM-DD.md` (OUTSIDE governance-locked `.claude/memory/`), milestone
> anchors FK-linking child entries, recall convention (newest→oldest, jump around a milestone). Couples to idea-0002 schema.

### idea-0004 — Autonomy B4: Discord control plane for auto-pilot
state: active · source: agent · created: 2026-06-14 · updated: 2026-06-14
gate: pass · moscow: could · reach: 1 impact: 2 confidence: 0.7 effort: 3 · base: 0.47 · interest: 0.5 · **rank: 0.50**
proposal: null · outcome: null
> Notify/approve T3 gates + trigger batches from Discord (autonomy plan B4, not built). Depends on the autonomy loop being live.

### idea-0005 — Phase 4: token-aware batching + estimation-accuracy research
state: active · source: user · created: 2026-06-14 · updated: 2026-06-14
gate: pass · moscow: could · reach: 2 impact: 1 confidence: 0.8 effort: 2 · base: 0.8 · interest: 0.4 · **rank: 0.85**
proposal: null · outcome: null
> `cost: S/M/L` on plan steps + post-hoc calibration; auto-pilot reads `cost` not a fixed step count. Research confirmed
> a-priori token forecasting is unreliable (r≈0.39) → enforcement (p99 + hard cap), not prediction. Modest payoff; lower rank.

### idea-0006 — Playwright E2E suite (deferred from compliance-sync)
state: deferred · source: user · created: 2026-06-14 · updated: 2026-06-14 · revisit_when: after a UI-regression scare or before a risky multi-app release
gate: pass · moscow: could · interest: 0.3
> E2E coverage for the web apps (skill `/playwright-e2e-builder` ready). Deferred earlier; revisit when regression risk rises.

### idea-0007 — journal /guide page (deferred from compliance-sync)
state: deferred · source: user · created: 2026-06-14 · updated: 2026-06-14 · revisit_when: when journal gets active end-users
gate: pass · moscow: could · interest: 0.3
> In-app `/guide` for the journal app (per `/user-guide`). Deferred; low urgency while single-user.

### idea-0008 — Autonomy B5: full unattended window
state: deferred · source: agent · created: 2026-06-14 · updated: 2026-06-14 · revisit_when: after B4 (idea-0004) ships and is trusted
gate: unknown · moscow: wont · interest: 0.4
> A bounded fully-unattended run window. Gated on B4 + accumulated trust in the gate. Not now.

---

## Tombstones (dead — kept so we don't re-litigate)

_None yet._
