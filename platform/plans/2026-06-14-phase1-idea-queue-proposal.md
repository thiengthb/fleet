---
title: Phase 1 — platform idea-queue with lifecycle, pushback, and interest-bonus ranking (autonomy Layer C spine)
kind: feature # feature | system-change — both REQUIRE prior-art before acceptance
status: draft # draft → accepted → rejected | superseded
created: 2026-06-14
related:
  - platform/plans/2026-06-14-agent-os-evolution.md
  - platform/plans/2026-06-14-autonomous-agent.md
  - platform/standards/autonomy-contract.md
  - platform/registries/skill-candidates.md
  - .claude/skills/project-plan/SKILL.md
  - .claude/skills/brainstorming/SKILL.md
  - .claude/skills/honest-critique/SKILL.md
---

<!--
  Phase 1 of the agent-OS evolution (parent: 2026-06-14-agent-os-evolution.md). This IS the autonomy
  roadmap's unbuilt "Layer C Proposer" — built as an extension, not a parallel system. Propose-don't-execute:
  the queue surfaces and ranks ideas; a HUMAN accepts before anything becomes a plan.
-->

## Problem

The platform has a rich forward pipeline for **chosen** work (`/brainstorming` → `proposal.md` → `/project-plan` →
execute → `/session-wrap`) but **no living backlog for the platform's own ideas**. `registries/skill-candidates.md` is a
one-time evaluation ledger for *external community skills* — not a queue, no ranking, no re-prioritization cadence, no
defer-list, no duplicate detection, no dead-idea pruning, no user-interest signal. The supervisor (solo
architect/operator, multi-machine) wants: capture ideas → after each big feature re-sort the queue → deep-analyze the
top idea → the agent pushes back on biased/infeasible/duplicate ideas instead of building them blindly → rejected-but-
maybe ideas wait in a separate list → dead ideas get pruned → and an *interest* signal nudges ordering so the supervisor
stays engaged enough to actually steer the agent (not "tự biên tự diễn"). This is the spine the interest model (Phase 2),
day-log memory (Phase 3), and token-aware batching (Phase 4) all hang from. The autonomy roadmap already scoped this as
**Layer C "Proposer" (C1–C3), status: not built** — so the gap is concrete and pre-specified.

## Prior art & sources — REQUIRED: ≥2 external URLs (research 2026-06-14)

- [RICE scoring](https://www.featurebase.app/blog/rice-scoring-model) — `(Reach×Impact×Confidence)/Effort`; Confidence caps overconfidence. **Reuse:** the base ordinal score for a well-specified idea. **Avoid:** false precision — treat as a hint, not truth.
- [WSJF — ProductPlan](https://www.productplan.com/glossary/weighted-shortest-job-first) — `Cost-of-Delay / JobSize`. **Reuse:** alternative when time-criticality matters; "interest" can be a capped CoD component. **Avoid:** optimistic job-size (the classic abuse).
- [Kano model](https://www.productplan.com/learn/kano-model-prioritization) + [MoSCoW](https://www.productplan.com/glossary/moscow-prioritization) — Must-be/Performance/Delighter; Must/Should/Could/Won't. **Reuse:** the **feasibility+fit GATE** that runs *before* numeric scoring; "Delighter" is the legitimate home of an interest bonus. **Avoid:** classifying by builder excitement alone.
- [GTD Someday/Maybe](https://facilethings.com/blog/en/someday-maybes) — cadenced review or it becomes a guilt graveyard. **Reuse:** the `deferred` state with `revisit_when` + a cap + delete-after-N-failed-reviews. **Avoid:** an unbounded defer-list.
- [Kanban WIP limits](https://kanbantool.com/kanban-wip-limits) — cap concurrent work to force deliberate selection. **Reuse:** `active` set capped at ~3–5 (matches autonomy C2's "~5 max unreviewed"). **Avoid:** a cap so tight it starves the queue.
- [Huang et al. 2023 — "LLMs Cannot Self-Correct Reasoning Yet" (arXiv 2310.01798)](https://arxiv.org/abs/2310.01798) — intrinsic self-correction can *degrade* performance. **Reuse:** never let the agent self-score/self-validate ideas in a closed loop. **Avoid:** a self-improving ranker that learns only from its own prior rankings.
- [Reflexion — Shinn et al. 2023](https://arxiv.org/abs/2303.11366) + [CRITIC — Gou et al. 2023 (arXiv 2305.11738)](https://arxiv.org/abs/2305.11738) + [MIT TACL 2024 survey "When Can LLMs Actually Correct Their Own Mistakes?"](https://direct.mit.edu/tacl/article/doi/10.1162/tacl_a_00713/125177/) — self-critique works only with an **external/oracle signal**. **Reuse:** the supervisor's **accept/reject is the oracle**; store a verbal "why declined" memory to bias future proposals. **Avoid:** treating no-response as approval.

## Options considered — REQUIRED: ≥2, with tradeoffs

| Option | Benefit | Drawback / cost |
| --- | --- | --- |
| **A — New `platform/registries/idea-queue.md` (markdown, human-editable) + a `/idea` skill that owns its lifecycle; plugs into autonomy Layer C** | Single source of truth, git-synced (travels multi-machine), the supervisor edits it directly, slots into the numbered platform-doc series (07/08/09→10), is the natural C1/C2 home. Markdown = zero infra, diff-able history. | One more file + skill to maintain; scoring is hand-maintained (mitigated by keeping scores coarse/ordinal). |
| **B — Extend `registries/skill-candidates.md` into a general queue** | Reuses an existing file. | Conflates two different axes (external-skill verdicts vs platform-native ideas); 07's schema (`Tier/Gap/Ships`) doesn't fit idea lifecycle. Rejected. |
| **C — Extend `/project-plan` to also hold a backlog** | One skill for plans + ideas. | Plans are forward roadmaps of **accepted** work; a backlog of **un-accepted** ideas is a different lifecycle. Conflating bloats the skill and blurs accepted vs candidate. Rejected. |
| **D — Structured DB / SQLite queue now** | Queryable, scalable. | Premature (same verdict as RAG — tiny volume); loses human-editability + git-sync + multi-machine travel. Defer until volume warrants (parent plan's trigger). Rejected for now. |

## Recommendation

**Option A.** A markdown `registries/idea-queue.md` + a thin `/idea` skill, built as autonomy **Layer C**. Markdown keeps it
human-editable, git-synced across machines, and diff-able — and it's the lowest-infra thing that delivers the full
lifecycle. Not B/C (axis-conflation), not D (premature infra). The `/idea` skill owns intake, the gate→score→interest
ranking, the re-sort cadence, pushback, dedup, the defer-list, and pruning; the autonomy C1 "Proposer" behavior
(gap-analysis grounded in external standards) writes new ideas into the `inbox` and **always parks at the human-decision
gate** — propose-don't-execute, never self-accepts an idea into a plan.

## Design detail (the "thật chi tiết" part)

### Artifact: `platform/registries/idea-queue.md`

A header (rules + WIP cap + interest-cap) followed by one block per idea. Human + agent both edit it. Stable `id`s.

```markdown
## idea-0007 — Discord control plane for auto-pilot
state: active            # inbox → active → analyzing → proposed → done | deferred | dead
source: agent            # user | agent  (who raised it)
created: 2026-06-14
updated: 2026-06-14
gate: pass               # pass | fail | unknown  (MoSCoW/Kano feasibility+fit, run FIRST)
moscow: should           # must | should | could | wont
# coarse RICE (ordinal hints, NOT truth — real rigor lives in the proposal):
reach: 2  impact: 2  confidence: 0.8  effort: 3   # base = 2*2*0.8/3 = 1.07
interest: 0.6            # 0–1, supervisor signal (Phase 2 formalizes); bonus is CAPPED
rank: 1.17              # base * (1 + 0.15*interest)  → interest never leapfrogs higher base
pushback: null           # agent's counter-case if biased/infeasible/duplicate
proposal: null           # link to proposal.md once state=proposed
outcome: null            # accept/reject + why  (THE oracle signal, set by supervisor)
dedup_of: null           # id of the canonical idea if flagged duplicate
revisit_when: null       # for deferred: a date or a condition
> One-line description + why it matters.
```

### Lifecycle state machine

```
        ┌─ dedup? ──> flag + ASK supervisor (re-analyze) ─┐
inbox ──┤                                                 │
        └─ gate (MoSCoW/Kano) ── fail ──> deferred | dead │
                 │ pass                                    │
                 ▼                                         │
              active  ──(re-sort cadence)──>  pick top-1   │
                 │                                          │
                 ▼  analyzing (deep dive)                   │
            write proposal.md  ──>  proposed  ──(human)──>  accepted → /project-plan → done
                                          │                 rejected (+why) → outcome → deferred|dead
                                          └─ deferred (revisit_when)
```

- **inbox → active:** runs the **gate first** (feasibility + fit + MoSCoW). Fail with no fix → `deferred` or `dead`.
- **Re-sort cadence:** triggered (a) explicitly via `/idea sort`, and (b) as a `/session-wrap` add-on **after a big feature ships** — re-score the `active` set, re-rank, and run **C1 gap-analysis** (what does the platform lack — grounded in INVENTORY drift / test-coverage / a real doc gap, NOT the agent's vibes) to propose new `inbox` ideas for the supervisor to approve.
- **active → analyzing → proposed:** deep-analyze **only the top-1** (don't pre-analyze the whole queue — wasted tokens); produce a `proposal.md`; set `state: proposed`.
- **Human decision = the oracle:** `accepted` → `/project-plan` spawns the plan → `done`. `rejected`/`deferred` → record `outcome` (why) — this verbal signal (Reflexion) biases future C1 proposals away from the rejected pattern. **No-response is NOT approval.**

### Pushback (agent challenges bad ideas — the core of "don't let it tự biên tự diễn")

At intake and at analysis the agent applies `/honest-critique` + the proposal's Counter-case/Pre-mortem to the idea:
- **Biased / built on a misunderstanding** (supervisor doesn't yet see a system constraint) → agent writes `pushback:` with the reasoning **and proposes a better-fit alternative idea**, surfaces both, lets the supervisor decide.
- **Infeasible / doesn't fit the system** with no viable reshaping → `deferred` (if maybe-later) or `dead` (tombstone + reason; never silently deleted, like 07's `REMOVED` tombstones).
- **Duplicate** (title/semantic match vs active+deferred) → set `dedup_of`, **trigger a notification to the supervisor** to re-run joint deep analysis (per the explicit request), don't silently merge.
- **Persistently unfit** (deferred + failed re-scoring N≥2 times, or solves nothing / only burns resources) → `dead`.

### Interest bonus (Phase 2 preview, hook only now)

`rank = base_score × (1 + 0.15 × interest)`. **Hard cap 15%** — interest can break ties and nudge, never override a
higher-value idea. Gate (feasibility+fit) runs FIRST and is absolute; interest is a Delighter-tier bonus, not a primary
axis. For Phase 1 the supervisor sets `interest` manually (or the agent infers a draft from `user-profile.md`); Phase 2
formalizes the user model.

### Skill: `/idea`

Thin skill owning `registries/idea-queue.md`. Subcommands (mirrors how `/project-plan` is structured):
- `/idea add "<title>"` — capture to `inbox` (+ dedup check → flag if match).
- `/idea sort` — re-score + re-rank `active`; the post-feature cadence ritual; optionally run C1 gap-analysis to add `inbox` ideas (grounded, not vibes).
- `/idea analyze` — deep-dive the top-1 `active` idea → write its `proposal.md` → `proposed`.
- `/idea defer <id> [when]` / `/idea kill <id> <reason>` / `/idea revive <id>` — lifecycle moves.
- `/idea outcome <id> accept|reject "<why>"` — record the supervisor's oracle signal (and, on accept, hand to `/project-plan`).

### Integration with the autonomy layer (extend, don't duplicate)

- This **is** Layer C: `/idea sort`'s gap-analysis = C1 Proposer; the WIP-capped queue + Reflexion `outcome` memory = C2; C3 = the cadence wiring.
- **Propose-don't-execute is preserved:** the agent may add/score/rank/pushback autonomously (T1/T2), but turning a `proposed` idea into a plan **requires the supervisor's `accept`** — the `autonomy-gate.mjs` already blocks autonomous self-acceptance, and writing a plan from an idea is the human-gated step.
- **Governance:** `registries/idea-queue.md` is a normal doc (NOT under the governance-locked `settings/hooks/skills/memory/CLAUDE.md` set), so the agent may maintain it; the `/idea` skill file itself is governance-locked (human commits it), consistent with the contract.
- Feeds the existing pipeline: accepted idea → `/project-plan` → `docs/plans/…` → `auto-pilot` can advance it. The queue is the **front door**, not a replacement for plans.

## Pre-mortem — REQUIRED: ≥2 failure modes

- **The queue becomes a graveyard** (ideas pile up, never pruned, re-sort skipped) → it rots into noise. Mitigation: WIP cap on `active` (~3–5), a cadenced re-score tied to `/session-wrap`, and mandatory dead-pruning after N failed reviews.
- **Auto-generated ideas are self-assessed "vibes"** → low-quality, biased proposals flood the inbox (exactly the failure the research warns about). Mitigation: C1 gap-analysis MUST ground each idea in an **external standard** (INVENTORY drift, missing test coverage, a documented gap, prior-art) per research-before-design; the accept/reject Reflexion signal corrects the bias over time.
- **Interest score creeps into dominance** → the supervisor builds fun-but-low-value things. Mitigation: hard 15% cap + feasibility gate first; `interest` is never a primary sort key.
- **Scoring theater** (made-up RICE numbers create false confidence) → wrong ordering, trusted too much. Mitigation: scores are explicitly coarse ordinal *hints*; the real rigor is the `proposal.md` deep-dive, and the human decides regardless of the number.

## Counter-case

For a solo operator who usually already knows their next move, the full lifecycle machinery may be overhead — a plain
"next 3 ideas" scratch list could capture 80% of the value at 20% of the ceremony; we should keep the `/idea` skill thin
enough that it never costs more attention than the ideas are worth, and be willing to cut it if the ritual goes unused.

## Decision (human) — 2026-06-14

**ACCEPTED** by the supervisor. → Build per the Design detail above: create `platform/registries/idea-queue.md` + the
`/idea` skill, wire the CLAUDE.md pointer. Execution tracked in `2026-06-14-phase1-idea-queue-build.md`.
