---
title: Phase 2 — a bounded, evidence-grounded user-interest model for the idea queue (the 15% bonus, formalized)
kind: feature # feature | system-change — both REQUIRE prior-art before acceptance
status: accepted # draft → accepted → rejected | superseded
created: 2026-06-14
updated: 2026-06-14 # ACCEPTED — full Option A (incl. exploration floor); building this session
related:
  [
    platform/registries/idea-queue.md (idea-0001 — the candidate this analyzes),
    platform/plans/2026-06-14-phase1-idea-queue-proposal.md (Phase 1 — the queue this rides on),
    platform/plans/2026-06-14-autonomous-agent.md (Layer C "Proposer" — Reflexion oracle, C2 backlog),
    platform/standards/autonomy-contract.md (propose-don't-execute),
    .claude/memory/user-profile.md (the existing user model this extends),
  ]
---

<!--
  RESEARCH-GROUNDED proposal (research-before-design / anti-bias). Produced by `/idea analyze` on the top-1 active
  idea (idea-0001). Propose-don't-execute: queued for HUMAN approval; never self-enters the build pipeline.
  Contract: platform/standards/autonomy-contract.md · CLAUDE.md §"Autonomous agent".
-->

## Problem

Phase 1 shipped the idea queue with a ranking formula `rank = base × (1 + 0.15 × interest)` — but `interest` is
currently a number the agent or supervisor sets **by hand, ungrounded**. That is precisely the "tự biên tự diễn" failure
the platform's anti-bias rule forbids: a self-assessed signal in a closed loop degrades (the Reflexion result below —
pure self-critique drops accuracy, external feedback is required). The supervisor wants the interest signal **formalized
and grounded in their actual decisions**, so it stays a faithful nudge that keeps them engaged enough to steer, without
ever letting preference override feasibility. Why now: the queue is live and already accumulating its first oracle
signal (idea-0004 just graduated with `outcome: accept`), so the accept/reject history needed to ground a model is
beginning to exist — and formalizing the rule *before* the history grows avoids retrofitting a biased one later.

## Prior art & sources — REQUIRED: ≥2 external URLs (research BEFORE designing)

- [Intercom — RICE prioritization](https://www.intercom.com/blog/rice-simple-prioritization-for-product-managers/) — the
  base score the bonus modifies. **Reuse:** RICE's *Confidence* is a bounded multiplier that only ever *dampens* under
  uncertainty (100/80/50%). **Avoid:** RICE leaves Impact/Reach unbounded — a secondary factor modeled as an unbounded
  multiplier would swamp the primary value; the interest term must be **additive and capped**.
- [Reinertsen / Black Swan Farming — WSJF](https://blackswanfarming.com/wsjf-weighted-shortest-job-first/) — canonical
  bounded-secondary-factor pattern. **Reuse:** WSJF sums co-equal components on one shared scale so none dominates; the
  "soft" component (Risk/Opportunity) is structurally capped to ≤⅓ of Cost-of-Delay — direct precedent for a minority-share
  interest cap. **Avoid:** the author warns SAFe's extra sub-components made it "useless" — keep the secondary signal *few
  and same-scale*, don't grow it.
- [Kano model — must-be vs delighter tiers](https://www.productschool.com/blog/product-fundamentals/kano-model) — the
  tier hierarchy behind "gate first, interest second." **Reuse:** Must-Be is satisfied *before* any Delighter; interest is
  a Delighter-tier nudge applied **only within a feasibility tier, never across it**. **Avoid:** Kano categories drift
  ("today's delighter is tomorrow's must-be") → a learned preference goes stale; the model needs **decay / re-derivation**.
- [Hu, Koren, Volinsky 2008 — Collaborative Filtering for Implicit Feedback](https://blog.reachsumit.com/posts/2022/09/explicit-implicit-cf/)
  (ICDM, 2017 10-Year Highest-Impact award). **Reuse:** split a signal into *preference* (binary) × *confidence*
  (`c = 1 + α·r`, grows with repeated evidence) → a single accept/reject is **low-confidence**; a consistent pattern is
  stronger. **Avoid:** treating one reject as a hard negative — non-interaction is *uncertain*, not negative. **Number:** at
  the queue's data scale (~10–30 verdicts/quarter) confidence stays structurally low — which *independently* justifies a small cap.
- [Mansoury et al., CIKM 2020 — Feedback Loop & Bias Amplification](https://arxiv.org/abs/2007.13019) — the **headline
  risk**. **Reuse:** optimizing for past preference causes declining diversity + taste homogenization, and the effect
  **compounds across rounds** (not static). **Avoid:** a preference signal fed back into ranking with no diversity
  countermeasure collapses the visible pool toward the comfort zone; the 15% cap alone is insufficient — needs an
  **architectural exploration floor**. **Number:** harm is strongest for the *minority/novel* items — exactly the long-shot
  ideas most likely to be high-value discoveries.
- [Thompson Sampling — explore/exploit](https://www.statsig.com/perspectives/thompson-sampling-balance-exploration-exploitation)
  (+ [Shaped AI overview](https://www.shaped.ai/blog/explore-vs-exploit)) — the countermeasure. **Reuse:** uncertainty-driven
  exploration auto-scales — strong evidence ⇒ exploit, sparse evidence ⇒ explore — i.e. **confidence-weight the bonus**.
  **Avoid:** full TS is overkill + slow to converge at this data scale; a lightweight **wildcard carve-out** captures the
  benefit. **Number:** UCB gives "90% of the benefit at 10% of the cost" — favor a heuristic over a probabilistic model here.
- [Reflexion — verbal RL, Shinn et al. NeurIPS 2023](https://arxiv.org/abs/2303.11366) — the oracle architecture. **Reuse:**
  store the **external** evaluator's accept/reject as verbal memory that biases future behavior — the human verdict, not the
  agent's own confidence, is the training signal. **Avoid:** internally-simulated (self-scored) feedback accumulates drift
  (the CVE-2025-53773 lesson, formalized). **Number:** external feedback lifted HumanEval pass@1 80%→91% — even ~10–20
  human verdicts meaningfully shift behavior, so the sparse queue history is a usable training set.

## Options considered — REQUIRED: ≥2, with tradeoffs

| Option | How it works | Benefit | Drawback / cost |
| --- | --- | --- | --- |
| **A — Lightweight, evidence-grounded heuristic on the existing queue + memory** *(recommended)* | `interest ∈ [0,1]` is **derived, never hand-typed**: (1) Reflexion signal = the user's `outcome: accept/reject` history on *similar* past ideas, count-based + **confidence-weighted** (Hu: one verdict = weak, a pattern = stronger); (2) explicit prefs tagged in `user-profile.md`. Capped at the existing 15%, **applied only after the absolute gate**. Add an **exploration floor**: every `/idea sort` surfaces ≥1 *wildcard* (novel/dissimilar) idea exempt from the interest term. **Re-derive** the score each sort (decay, don't freeze). | No new infra — extends Phase-1 queue + `user-profile.md` + the existing re-sort cadence. Matches the data scale (coarse, confidence-weighted). Bias is bounded by **both** the cap *and* the exploration floor (Mansoury). Oracle = human only (Reflexion). | The "similarity" of ideas is judged coarsely (no embeddings yet — that's idea-0002); heuristic, not principled explore/exploit. Needs discipline to actually re-derive (not let a stale number persist). |
| **B — Formal probabilistic model (Thompson sampling / bandit over idea features)** | Maintain a posterior over idea-feature preferences; sample to balance explore/exploit; could ride idea-0002's vector memory for feature similarity. | Principled explore/exploit; would scale if idea volume grows large. | **Data-starved**: ~10–30 verdicts overfits/cold-starts (Hu confidence stays low; TS slow to converge). New infra + tuning. **Premature** for a solo operator — sophistication the data can't yet support. |
| **C — Status quo: supervisor hand-sets `interest:` per idea** | Keep the Phase-1 field exactly as is; no model. | Zero added complexity; the honest baseline. | Doesn't deliver the *formalized, grounded* signal the user asked for; ungrounded hand-tuning is the "tự biên tự diễn" bias the anti-bias rule forbids. |

## Recommendation

**Adopt Option A.** It formalizes the interest signal as a *derived, human-grounded, confidence-weighted, capped*
nudge with an explicit exploration floor — delivering what the supervisor asked for while structurally bounding the
feedback-loop risk, and it rides entirely on Phase-1 infrastructure (no new services).

- **Why not B:** the queue's data volume (~10–30 verdicts) can't support a probabilistic model without overfitting; the
  research says so (Hu confidence stays low at this scale, TS converges slowly). Revisit only if idea volume *and*
  idea-0002's vector memory later make feature-level preference learning worthwhile.
- **Why not C:** it's the very ungrounded hand-tuning the user wants replaced; honest fallback, but it doesn't meet the goal.

## Pre-mortem — REQUIRED: ≥2 failure modes

- **If the bonus compounds across sorts (Mansoury feedback loop)** — the queue homogenizes toward past accepts and
  starves novel, high-value ideas (the harm hits *minority/novel* items hardest). Mitigation: the 15% cap is **necessary
  but not sufficient** — pair it with the **exploration floor** (≥1 wildcard surfaced per sort, exempt from interest) and
  keep the feasibility gate **absolute**. Without the wildcard, ship nothing.
- **If the model overfits sparse data** — a couple of rejects swing it. Mitigation: **confidence-weight** (Hu `c=1+α·r`),
  use coarse buckets not precise scores, and let one-off verdicts contribute weakly.
- **If a learned preference goes stale (Kano drift)** — yesterday's delighter is today's baseline. Mitigation: **re-derive
  interest at each `/idea sort`** with recency decay; never persist a frozen score.
- **If "interest" leaks from the agent's own enthusiasm, not the human oracle (Reflexion)** — the closed-loop self-scoring
  degrades. Mitigation: derive interest **only** from human signals (`outcome:` history + explicit `user-profile.md` prefs),
  never the agent's opinion of the idea; this is a hard rule, gate-enforceable.

## Counter-case

For a solo operator reviewing a handful of ideas at a time, the supervisor can simply eyeball and hand-set `interest:`
(Option C) — a derived model may be ceremony that costs more attention than a 15%-capped tie-breaker ever buys, and the
skill's own scope-discipline note warns against exactly this kind of machinery rotting into overhead.

## Decision (human) — ACCEPTED 2026-06-14

**accepted, full Option A** (derive + 15% cap + exploration floor + human-only oracle + re-derive/decay). The supervisor
explicitly kept the exploration floor over the lighter wildcard-less variant, prioritizing the feedback-loop guard. Shipped
this session by formalizing the rules in `platform/registries/idea-queue.md` §Rules, the derivation procedure in
`.claude/skills/idea/SKILL.md`, and a human-tagged `## Interest signals` section in `.claude/memory/user-profile.md`.
