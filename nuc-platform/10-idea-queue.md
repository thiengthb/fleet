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
- **Graduation (`outcome: accept` → plan):** on accept the idea graduates to a `docs/plans/`/`nuc-platform/plans/`
  roadmap and moves under `## Done` with a **`graduated_plan: <path>`** link. Unattended, the auto-pilot wrapper does
  this automatically (Phase 1 / S1.1) but only to a **`draft`** plan (`auto_pilot: false`) — it parks for the **enrol
  gate** (a separate supervisor approval) before the plan can execute. Propose-don't-execute survives the automation:
  accept ⇒ a *draft* plan, never a running one.
- **Gate FIRST, score SECOND:** an idea enters `active` only after a feasibility+fit gate (`moscow: must|should|could|wont`
  + "does it fit the system?"). `wont` / no-fit → `deferred` or `dead`.
- **Ranking:** coarse RICE `base = reach×impact×confidence / effort` (ordinal HINT, not truth — real rigor lives in the
  proposal). `rank = base × (1 + 0.15 × interest)`. **Interest bonus is capped at 15%** — it breaks ties / nudges, it
  **never** lets a lower-value idea leapfrog a higher one. Gate is absolute; interest is a Delighter-tier bonus.
- **Interest model (Phase 2 — `interest ∈ [0,1]` is DERIVED, never hand-typed):** ground it ONLY in human signals —
  the supervisor's `outcome: accept/reject` history on *similar* past ideas (Reflexion oracle) + the explicit
  `## Interest signals` prefs in `.claude/memory/user-profile.md`. **Confidence-weight** it (Hu 2008): one verdict = a
  weak nudge, a consistent pattern = stronger; at this data scale (~10–30 verdicts) confidence stays low, which is *why*
  the cap is 15%. **Never** derive interest from the agent's own enthusiasm for an idea (closed-loop self-scoring degrades
  — Reflexion). **Re-derive each `/idea sort`** (recency-decayed); never freeze a stale score. Use coarse buckets
  (≈0.2/0.4/0.6/0.8), not false-precision. Grounding: `plans/2026-06-14-phase2-interest-model-proposal.md`.
- **Exploration floor (anti-feedback-loop):** the interest bonus + the gate would, over many sorts, homogenize the queue
  toward past accepts and starve novel ideas (Mansoury CIKM'20: the bias **compounds** per round — the cap alone is not
  enough). So every `/idea sort` MUST surface **≥1 "wildcard"** — a novel / dissimilar / orthogonal-to-history idea —
  exempt from the interest term (ranked on `base` only), and flag it as the wildcard. If none exists, say so explicitly.
- **WIP cap:** keep `active` ≤ 5 (Kanban). Over the cap → defer the lowest-ranked. Re-sort after every big feature ships.
- **Oracle = supervisor accept/reject.** Record it in `outcome:` with the *why* — that verbal signal (Reflexion) biases
  future agent proposals away from rejected patterns. Self-scoring in a closed loop is forbidden (it degrades — see proposal §Prior art).
- **Dedup:** new idea similar to an existing one → set `dedup_of:` + **flag the supervisor** to re-analyze jointly; don't silently merge.
- **Prune:** `deferred` that fails re-scoring twice, or is fundamentally unfit → `dead` (tombstone + reason).

## Queue

<!-- newest/active near top; sorted by rank within active. one block per idea, stable id.
     2026-06-19 SUPERVISOR GATE: idea-0014 (Restic backup) ACCEPTED → proposal → graduated to build plan
     nuc-platform/plans/2026-06-19-idea-0014-nuc-backup.md (status: active). idea-0013 (extract MCP OAuth)
     DEFERRED → revisit when journal/3rd app adds MCP.
     last /idea sort: 2026-06-19 (C3 autonomous gap-analysis); interest re-derived: idea-0005 stays 0.4.
     idea-0012 done (graduated 2026-06-17 → build plan). -->

## Inbox (captured — awaiting supervisor gate before entering active)

### idea-0005 — Phase 4: token-aware batching + estimation-accuracy research
state: active · source: user · created: 2026-06-14 · updated: 2026-06-14
gate: pass · moscow: could · reach: 2 impact: 1 confidence: 0.8 effort: 2 · base: 0.8 · interest: 0.4 · **rank: 0.85**
proposal: null · outcome: null
> `cost: S/M/L` on plan steps + post-hoc calibration; auto-pilot reads `cost` not a fixed step count. Research confirmed
> a-priori token forecasting is unreliable (r≈0.39) → enforcement (p99 + hard cap), not prediction. Modest payoff; lower rank.

---

## Done (graduated to an accepted plan / shipped — kept for the Reflexion trail)

### idea-0014 — NUC volume backup strategy (ops data-safety)
state: done · source: agent (C3 gap-analysis 2026-06-18, exploration-floor WILDCARD) · created: 2026-06-18 · updated: 2026-06-19
gate: pass · moscow: must · reach: 3 impact: 3 confidence: 0.9 effort: 3 · base: 2.7 · interest: n/a (wildcard — base only) · rank: 2.7
proposal: nuc-platform/plans/2026-06-19-idea-0014-nuc-backup-proposal.md
graduated_plan: nuc-platform/plans/2026-06-19-idea-0014-nuc-backup.md
outcome: **accept** (2026-06-19, supervisor) — Option B (Restic → Backblaze B2, app-consistent DB dumps via pg_dump/SQLite
.backup, systemd timer, nuc-monitor Discord alert). Graduated to the build plan above (status: active).
> **Reflexion signal:** an ops/data-safety gap accepted on real-risk grounds (the highest un-mitigated risk on the
> platform — zero backup of 8 data volumes on one machine). The exploration-floor WILDCARD (orthogonal to the prior
> autonomy/knowledge-OS/testing accepts) paid off — bias future sorts toward surfacing concrete data-safety/ops gaps.

---

### idea-0012 — nuc-monitor coverage gap: extend monitoring to journal + yakudoku
state: done · source: agent (C3 gap-analysis 2026-06-17) · created: 2026-06-17 · updated: 2026-06-17
gate: pre-assessed pass · moscow: should · reach: 2 impact: 2 confidence: 0.9 effort: 1 · base: 3.6 · interest: 0.3 · rank: 3.76
proposal: plans/2026-06-17-nuc-monitor-app-health-proposal.md
outcome: **accept — Option D** (2026-06-17, supervisor re-decided after the analysis surfaced the invariant conflict).
First chose A, then switched to **D** when the agent flagged (honest-critique) that A violates nuc-monitor's documented
"no edge/no port" invariant and that **D is strictly better**: read Docker's `State.Health.Status` over the *existing*
`docker.sock` (no network change), with the deep DB check living inside each app's `HEALTHCHECK`. Graduated → build plan
`plans/2026-06-17-nuc-monitor-app-health-build.md`. *Reflexion bias:* **read the TARGET's invariants/CLAUDE.md before
recommending an option** — propose at the layer that respects existing isolation (docker.sock) over one that relaxes a
guardrail (joining `edge`); prefer the option that needs no infra/network change when it's also more capable.
> The first C3-sourced idea promoted to a plan. Real gap: `check_docker` only sees container *running* state, never app
> liveness — D closes it by alerting on `unhealthy` (edge-triggered, recovery on `healthy`) via docker.sock; deep readiness
> (Postgres ping) is pushed into each app's in-container HEALTHCHECK. 2 external sources (K8s liveness/readiness; blackbox
> internal-vs-public probing). Exploration-floor WILDCARD for the 2026-06-17 sort (ops/reliability, orthogonal to prior accepts).

### idea-0010 — Testing & spec discipline: tiered SDD-lite + selective TDD + contract testing
state: done · source: user · created: 2026-06-14 · updated: 2026-06-14
gate: pass · moscow: should · reach: 3 impact: 3 confidence: 0.7 effort: 3 · base: 2.1 · interest: SKIPPED (wildcard) · rank: 2.1
proposal: plans/2026-06-14-testing-spec-discipline-proposal.md
outcome: **accept — Option A** (2026-06-14, "theo những gì bạn khuyến nghị") + **idea-0006 folded** (E2E = pyramid top tier).
Graduated → build plan `plans/2026-06-14-testing-spec-discipline-build.md`. *Reflexion bias:* extend-the-spine + evidence-
tiered testing over a parallel SDD tool (B) or a blanket-TDD mandate (C); the multi-user future overrides the solo anti-ceremony prior.
> The exploration-floor wildcard (quality engineering). AC (Given/When/Then, 1 AC→1 test) on the proposal/plan spine;
> selective TDD for pure logic (Nagappan 40–90% defect↓); consumer-driven contract tests for cross-repo seams; E2E sparse
> at the top (idea-0006). 5 verified sources (Nagappan/Spec-Kit/Kiro/Gherkin/Pact).

### idea-0011 — Skill proposer: induce a skill from a repeated process, then PROPOSE it (governance-safe)
state: done · source: user · created: 2026-06-14 · updated: 2026-06-14
gate: pass · moscow: should · reach: 3 impact: 3 confidence: 0.6 effort: 3 · base: 1.8 · interest: 0.6 · rank: 1.96
proposal: plans/2026-06-14-skill-proposer-induction-proposal.md
outcome: **accept — Option A** (2026-06-14, supervisor: "idea 11 phải theo A") — **separate skill** `/skill-proposer`, full
A, auto-detection **hook deferred to Phase 2**. Graduated → build plan `plans/2026-06-14-skill-proposer-build.md`.
*Reflexion bias:* supervisor wants Hermes-style self-improvement but strictly under propose-don't-install — never the closed auto-install loop (B).
> Detect a process repeated ≥3× (rule of three, over day-log + git) → draft SKILL.md via /skill-authoring → self-verify
> (Voyager) → PROPOSE into a sandbox queue; human security-reviews + installs (autonomy-gate blocks .claude/skills/**).
> Diversity + anti-sprawl via dedup + WIP cap + Curator. 4 verified sources (Hermes/Voyager/ADAS/Anthropic).

### idea-0003 — Phase 3: day-log + milestone-anchored memory
state: done · source: user · created: 2026-06-14 · updated: 2026-06-14
gate: pass · moscow: should · reach: 3 impact: 2 confidence: 0.7 effort: 3 · base: 1.4 · interest: 0.6 · rank: 1.53
proposal: plans/2026-06-14-phase3-daylog-memory-proposal.md
outcome: **accept** (2026-06-14) — Option A + folded idea-0002's schema-now half into this build. *Reflexion bias:* the
supervisor favours grounded recall-tier design that defers infra (embeddings) until a real volume trigger.
> Dated session digests `nuc-platform/log/YYYY-MM-DD.md` (recall tier, never auto-loaded), RAG-schema-ready frontmatter,
> milestone anchors FK-linking children, event-sourced immutability. **Graduated → build plan
> `plans/2026-06-14-phase3-daylog-memory-build.md`** (this session). 6 verified sources (Park/MemGPT/Zettelkasten/Fowler/RAG-threshold).

### idea-0009 — Resolve Layer-C overlap: does the shipped `/idea` skill already absorb planned C1 `/feature-proposal`?
state: done · source: agent · created: 2026-06-14 · updated: 2026-06-14 · dedup_of: (autonomy plan step C1/C2)
outcome: **accept the fold** (supervisor delegated the call 2026-06-14) — `/idea` already realizes C1+C2; **do NOT build a
separate `/feature-proposal`**. Marked C1/C2 `[x]` in `plans/2026-06-14-autonomous-agent.md` (superseded-by-/idea); kept C3
as the genuinely-distinct *unattended* integration. Added "nothing worth proposing" as a first-class output to the skill.
> GAP-ANALYSIS (grounded in two plan docs, not agent opinion): `plans/2026-06-14-autonomous-agent.md` Layer C **C1** spec'd a
> `/feature-proposal` skill = external-grounded gap-analysis → RFC-lite proposal → halt. The shipped `/idea` skill already
> does exactly that (`/idea sort` gap-analysis + `/idea analyze` → `proposal.md`; bounded backlog = WIP cap; Reflexion oracle
> = `outcome:`). Confirmed a real DUP and folded. *Reflexion bias:* before building a planned skill, check whether a shipped
> one already covers it (don't re-build).

### idea-0001 — Phase 2: user interest model (formalize the interest signal)
state: done · source: user · created: 2026-06-14 · updated: 2026-06-14
gate: pass · moscow: should · reach: 2 impact: 2 confidence: 0.7 effort: 2 · base: 1.4 · interest: 0.7 · rank: 1.55
proposal: plans/2026-06-14-phase2-interest-model-proposal.md
outcome: **accept** (2026-06-14) — supervisor chose full Option A *incl.* the exploration floor; valued bounding the
feedback-loop bias (Mansoury) over minimalism. *Reflexion bias:* future proposals → grounded + bounded + exploration-preserving.
> A per-idea interest *bonus* (≤15%) from a deeper user model. **Shipped 2026-06-14** (same session as accept): derivation
> rules in this file §Rules, the procedure in `.claude/skills/idea/SKILL.md` (`/idea sort`), and the human-tagged
> `## Interest signals` section in `.claude/memory/user-profile.md`. First live re-derive applied in this sort.

### idea-0004 — Autonomy B4: Discord control plane for auto-pilot
state: done · source: agent · created: 2026-06-14 · updated: 2026-06-14
gate: pass · moscow: could · reach: 1 impact: 2 confidence: 0.7 effort: 3 · base: 0.47 · interest: 0.5 · rank: 0.50
proposal: plans/2026-06-14-discord-control-plane.md
outcome: **accept** — supervisor took full scope (B4a+B4b) 2026-06-14; B4b's `autonomy-gate.mjs` edit stays agent-proposes / human-commits.
> Graduated to an accepted RFC now driving step **B4** of `plans/2026-06-14-autonomous-agent.md` (B4a+B4b code-complete +
> verified: gate-verify 20/20, hook 24/24, Python↔Node interop ✓; pending human provision B4a.4 + live e2e B4b.3). Moved out
> of `active` by /idea sort — the queue had drifted (this block still read `active · proposal:null · outcome:null`).

---

## Deferred (someday/maybe — has a revisit trigger)

### idea-0013 — Extract MCP OAuth shim to `@thiengthb/mcp-auth`
state: deferred · source: agent (C3 gap-analysis 2026-06-18) · created: 2026-06-18 · updated: 2026-06-19 · revisit_when: journal (or any 3rd app) adds an MCP server — the rule-of-three extraction trigger
gate: defer · moscow: could · interest: n/a
> **External signal:** `08-SHARED-ASSETS.md` row 1 explicitly flags "DUPLICATED — extract candidate (built 2×;
> extract at 3rd app **or now if churn has stopped**)". Churn check: both `todo` and `yakudoku/web` have had
> stable MCP OAuth since 2026-06-13 with no changes. Code is near-identical across repos (auth 38≈39, oauth
> 86≈89, token 63≈67, authorize 124≈129, register 32=32 lines). Security-sensitive glue — a shared package
> means one audit covers all consumers and prevents drift.
> **Deferred 2026-06-19** (supervisor): only 2 stable consumers → extracting now is premature coupling (rule of
> three); the security "one audit covers all" pull doesn't override until the 3rd consumer (journal MCP) makes it
> concrete. Revisit at that trigger.

### idea-0002 — RAG/vector memory MIGRATION (pgvector — build at volume trigger)
state: deferred · source: user · created: 2026-06-14 · updated: 2026-06-14 · revisit_when: corpus crosses ~200K tokens / ~150 files (RAG-threshold research)
gate: pass · moscow: could · interest: 0.8
> **Shrunk 2026-06-14** (idea-0003 decision): the "standardize frontmatter schema now" half is folded into Phase 3's build
> (the day-log defines + uses it, with a nullable `embedding`). What remains here = the *later* migration to journal's
> Postgres+pgvector — purely additive (populate `embedding`), deferred until the corpus is large enough to beat long-context
> (Redis/mmntm ~200K-token threshold; full-context still wins +15–20% under ~1M). No now-build.

### idea-0006 — Playwright E2E suite (deferred from compliance-sync)
state: deferred · source: user · created: 2026-06-14 · updated: 2026-06-14 · revisit_when: as the TOP TIER of idea-0010's testing standard — build the suite when regression risk rises
gate: pass · moscow: could · interest: 0.3
> E2E coverage for the web apps (skill `/playwright-e2e-builder` ready). **Folded into idea-0010** (2026-06-14) as the
> testing pyramid's top tier — no longer a standalone idea; the standard positions it, the suite itself gets built at the trigger.

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
