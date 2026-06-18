---
title: Closed-loop driver — chain the verified autonomy pieces into one self-perpetuating, Discord-supervised cycle
kind: system-change # REQUIRES prior art before `active`
status: active # accepted by supervisor 2026-06-18 — Phase 0 in progress
created: 2026-06-18
updated: 2026-06-18 # Phase 0 COMPLETE (S0.1-S0.4 done + verified live); Phase 1 next
related:
  - nuc-platform/plans/2026-06-14-autonomous-agent.md # Layers A/B/C — governance + executor (done); this is the missing Layer-C outer driver
  - nuc-platform/plans/2026-06-14-agent-os-evolution.md # memory/interest/RAG infra that UNDERPINS this (not the loop itself)
  - nuc-platform/09-autonomy-contract.md # the tier gate this honours
  - .claude/scripts/auto-pilot-scheduled.ps1 # the wrapper that this extends from "advance plans" → "run the full cycle"
  - .claude/skills/auto-pilot/SKILL.md
  - .claude/skills/idea/SKILL.md
  - .claude/skills/session-wrap/SKILL.md
---

<!--
  Plan output of the user's request (2026-06-18): "build a 24/7 auto workflow — turn the machine on and you self-run the
  closed loop I described (review → fix → propose → Discord-accept → plan (asking me anything mid-plan) → split tasks to
  subagents → execute → synthesize → session-wrap → retro → feed todo → re-prioritize → ask me → repeat), all supervised
  ONLY through Discord, every minute saved as retrievable memory." Honest finding (3 Explore + 1 research subagent,
  2026-06-18): ~85% of the pieces ALREADY EXIST and are verified live. What is missing is the OUTER DRIVER that chains
  them + the human-decision automation BETWEEN them. This plan builds only the missing chain. NOT a rebuild.
  Memory/harness redesign (VISION.md, episodic compaction, routing index, RAG) is DEFERRED to a research-after phase per
  the user's explicit ordering ("loop first, memory after — you research that yourself once the loop is done").
-->

## Goal

Turn the machine on → the agent self-runs the full closed loop unattended: it advances approved plans, proposes new
work when idle, and on a Discord approval it graduates the idea into a plan, executes it, wraps it, runs a retro that
feeds preventive ideas back into the queue, re-prioritises, and asks the supervisor what is next — with **Discord as the
sole human touchpoint** (no CLI babysitting) and **every batch's minutes persisted as retrievable memory**. "Done" =
one full unattended cycle demonstrably runs end-to-end through Discord, no governance file edited by the agent, no T4
crossed.

## Context — what ALREADY exists (do not rebuild)

The platform has spent ~10 sessions building this; the pieces are individually verified live:

| Piece | Status | Where |
|---|---|---|
| Governance gate T1–T4 (hard-blocks self-harm + self-governance edits) | ✅ live, 24/24 tested | `.claude/hooks/autonomy-gate.mjs`, `09-autonomy-contract.md` |
| Plan executor — fresh `claude -p` per batch, parks at gates | ✅ live (B5 passed) | `.claude/scripts/auto-pilot-run.ps1`/`.sh`, `/auto-pilot` |
| Discord approval — RS256-signed tokens, button gates | ✅ live e2e (2026-06-15) | `nuc-ops-bot/gate_approval.py`, `gate-cli.mjs`, `gate-verify.mjs` |
| Discord async Q&A — ask anything mid-plan, answer = DATA | ✅ live e2e ×2 | `ask-cli.mjs`, `gate-answer.mjs`, `nuc-ops-bot/ask_answer.py` |
| Scheduled wrapper — multi-plan advance + idle gap-analysis | ✅ live (armed 2026-06-17) | `.claude/scripts/auto-pilot-scheduled.ps1`, Task Scheduler `MiniServer-AutoPilot` |
| Temporal memory (episodic day-log) | ✅ live | `nuc-platform/log/YYYY-MM-DD.md` |
| Interest model (RICE + ≤15% interest, wildcard floor) | ✅ live | `/idea`, `10-idea-queue.md` |
| Subagent delegation + model routing | ✅ live (B5 exercised) | CLAUDE.md §Model routing, `/auto-pilot` Step 4 |

**Where the chain STOPS today:** the scheduled wrapper advances opted-in plans (`status: active` AND `auto_pilot: true`)
and, when idle, fires ONE propose-only `/idea sort` gap-analysis (≤2 inbox ideas, once/day). Then it STOPS. It does NOT
auto-graduate an accepted idea into a plan, does NOT auto-enrol a plan for execution, does NOT auto-chain `/session-wrap`,
and there is NO retro→todo loop. **Those four gaps + a worker-reliability fix are the whole job.**

## Prior art & sources

- [Anthropic — Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) — progress-file + git-commit handoff; completion = tests pass, NOT agent opinion ("unacceptable to remove/edit tests"). Adopt verbatim.
- [Anthropic — Effective context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) — "start with a FRESH context window rather than compaction; Claude discovers state from the filesystem." This is exactly why the fresh-`claude -p`-per-batch model is correct, and directly answers the user's "auto-compact at 60%" ask: we never grow one long session, so there is nothing to compact. Keep it.
- [Reflexion (NeurIPS 2023), arXiv:2303.11366](https://arxiv.org/abs/2303.11366) + [self-correction reliability analysis](https://zylos.ai/research/2026-05-12-agent-self-correction-reflexion-to-prm) — verbal self-reflection helps ONLY when grounded in an external signal (tests/lint/runtime); pure self-critique hits a "coherence trap" (more confident, not more correct). ⇒ the retro step MUST score against external signal, never the agent's own opinion.
- [AutoGPT/BabyAGI retrospectives](https://techtalkwithsriks.medium.com/notorious-agent-loops-c4cc05b859b5) — naive "run-forever daemon" fails via goal drift, hallucinated completion, runaway cost. ⇒ reject the long-lived-daemon design (Option B below); keep bounded fresh cycles + retry cap.
- [HITL approval framework](https://agentic-patterns.com/patterns/human-in-loop-approval-framework/) — gate only genuinely high-risk actions (avoid approval-fatigue rubber-stamping); on timeout DEFAULT-DENY + queue, never auto-approve. Already matches our T3/T4 gate; reuse for the new auto-graduation gate.

## Approach & tradeoffs

**Chosen — Option A: external scheduler fires bounded fresh cycles; Discord gate only at T3/T4.** The scheduler
(`auto-pilot-scheduled.ps1`) becomes the outer driver: each fire is a fresh, stateless, budget-capped cycle that reads
state from disk (plan files + git + day-log), advances the loop one bounded step, and persists state back. Human
decisions (accept an idea, enrol a plan, approve a PR) are the ONLY blocking points, all via Discord. This matches
Anthropic's own long-running-agent guidance and the autonomy contract already in force.

**Ruled out — Option B: long-lived supervisor daemon (in-memory loop).** Lowest latency, but this is precisely the
AutoGPT/BabyAGI shape that fails — context rot, goal drift, runaway cost, no natural budget checkpoint, lost state on
crash. Rejected.

**Ruled out — Option C: pure event-driven (only runs on a Discord message).** Safest but not self-perpetuating — it
can't "review/fix/propose" while the user is away, which is the core ask ("turn the machine on → it self-runs").
Rejected as the primary driver, but its discipline (every cycle ends with a Discord summary + a single clear next-action
prompt) is folded into Option A.

**Continuity note (answers the user's "24/7" expectation):** true 24/7 needs the PC on + logged in (Task Scheduler can't
decrypt DPAPI creds in Session 0 — a documented trap). "Machine-on → self-runs" via at-logon + periodic fire is the
honest ceiling on this hardware; a genuine always-on daemon would need the NUC + a different credential story (out of
scope here, noted as a follow-up idea).

## Acceptance criteria (Given / When / Then)

- **AC-1 (reliability)** — Given the auto-pilot worker receives a valid `approve` from `gate-cli check`, When it acts, Then it trusts the one-word output verbatim and crosses the gate without hand-re-verifying the gates dir (closes B5 Finding #4). *1 AC → the gate-cross smoke test.*
- **AC-2 (idea→plan bridge)** — Given the supervisor sets `outcome: accept` on an idea via Discord, When the next cycle runs, Then a `draft` plan file is auto-created from the idea's proposal AND any planning-time ambiguity is asked via `ask-cli` (Discord) before the plan is finalised. The agent does NOT auto-enrol it for execution.
- **AC-3 (enrol gate)** — Given a finalised draft plan, When the supervisor approves "enrol" via Discord, Then `status: active` + `auto_pilot: true` are set and the next cycle picks it up; without that approval the plan never executes autonomously.
- **AC-4 (auto-wrap)** — Given an auto-pilot cycle finishes a batch, When it exits, Then `/session-wrap` runs automatically (digest → day-log; decisions distilled) without a human invoking it.
- **AC-5 (retro→todo, externally grounded)** — Given a cycle completes, When the retro runs, Then it scores the batch against EXTERNAL signal only (test/lint/gate outcomes, git diff), and files any preventive follow-ups as propose-only `inbox` ideas — never auto-accepted, never grounded in self-opinion.
- **AC-6 (Discord-only + minutes-as-memory)** — Given a full cycle runs unattended, When reviewed, Then every batch's minutes are persisted to the day-log and are retrievable (by date + grep today; by concept once RAG lands), and the only human inputs in the whole cycle were Discord approvals/answers.
- **AC-7 (safety invariant)** — Given any cycle, When the gate hook is inspected, Then no governance file (`.claude/**`, `CLAUDE.md`, CI, `.env*`) was edited by the agent and no T4 action was crossed; all governance changes in this plan were applied by a human from a proposed diff.

## Steps

### Phase 0 — Reliability + finish wiring (quick wins; governance = human commits)

- [x] S0.1 — `auto-pilot/SKILL.md` Step 5.5 rewritten EN (kept the functionality; was VN, broke the English-dev-artifact rule) · APPLIED 2026-06-18 (interactive, supervisor-approved) · Test: AC-1/AC-6
- [x] S0.2 — `/auto-pilot` Step 1.5 now trusts `gate-cli check` verbatim (no hand-re-verify); Opus recommended for the gate-cross re-run · APPLIED 2026-06-18; skill-proposal `auto-pilot-trust-gate-cli.md` marked `installed` · Test: AC-1
- [x] S0.3 — Single-flight lock on the scheduled wrapper (no overlapping cycles; bounds per-window cost with `-MaxBatches`) · APPLIED 2026-06-18; `.ps1` re-parsed clean · Test: AC-7. (Finer token-budget cap deferred to Phase 3 — claude `-p` has no clean token ceiling; `-MaxBatches` + lock bound it for now.)
- Note — interactive supervised edits applied directly (not via the proposals/ flow). When the loop runs UNATTENDED the same class of change MUST still route through a proposal + human commit (autonomy contract §3); the proposal dir is the unattended path, not a blanket requirement when the supervisor is approving live.
- [x] S0.4 — Baseline DONE 2026-06-18: a throwaway pilot (`auto_pilot: true`) was discovered by the scheduled wrapper (DryRun: "opted-in active plans: 1"; lock clean; C3 correctly skipped while work remained), then one LIVE batch (sonnet worker) advanced P1 → local commit `971c6ef` → day-log episodic block → digest → clean stop (no gate). The just-fixed skill ran live without issue. Pilot retired (branch + both files deleted). · Test: AC-6 ✓ (minutes in day-log)

### Phase 1 — Idea→plan bridge (the first missing link)

- [ ] S1.1 — Design the `/idea outcome accept` → auto-create `draft` plan flow: on accept, generate a plan file from the idea's proposal template, carrying Goal/Context/Prior-art forward · Files: propose diff for `.claude/skills/idea/SKILL.md` + `auto-pilot-scheduled.ps1` cycle logic · Test: AC-2 (draft plan auto-appears after accept)
- [ ] S1.2 — Wire planning-time Q&A: when the draft plan has an open question, the cycle mints an `ask-cli` question (Discord, with `--options`) and PARKS until answered; answer = DATA · Files: `auto-pilot-scheduled.ps1` + `/auto-pilot` · Test: AC-2 (mid-plan question reaches Discord, answer consumed)
- [ ] S1.3 — Add the enrol gate: present the finalised draft plan via Discord; on "enrol" approval set `status: active` + `auto_pilot: true`; default-deny + queue on timeout · Files: propose diff (governance) + bot side · Test: AC-3 (no enrol → no autonomous execution)

### Phase 2 — Auto-wrap + retro→todo (the genuine gap)

- [ ] S2.1 — Auto-chain `/session-wrap` at the end of each cycle (digest → day-log; distil decisions) · Files: propose diff for `auto-pilot-scheduled.ps1` + `/auto-pilot` Step 6 · Test: AC-4 (wrap runs with no human invoke)
- [ ] S2.2 — Build the retro step: after a cycle, score the batch against EXTERNAL signal (test/lint/gate/git-diff), summarise pros/cons/bugs, and file preventive follow-ups as propose-only `inbox` ideas (Reflexion-grounded, NOT self-opinion) · Files: new retro logic in the cycle + `/idea add` calls · Test: AC-5 (retro files an inbox idea grounded in a real signal; never auto-accepts)
- [ ] S2.3 — Re-prioritise + surface next: after retro, run `/idea sort`, then post the top candidate + a single clear next-action prompt to Discord (fold in Option C's discipline) · Files: cycle logic · Test: AC-6 (cycle ends with one Discord summary + next-action ask)

### Phase 3 — Close the loop (the outer driver)

- [ ] S3.1 — Wire the full cycle in `auto-pilot-scheduled.ps1`: advance plans → if idle, gap-analysis → on accepted idea, graduate (Phase 1) → on enrol, execute → auto-wrap (S2.1) → retro (S2.2) → re-rank + ask (S2.3) → exit. Bounded, fresh, budget-capped, retry cap = 3 then escalate to Discord · Files: propose diff (governance) · Test: AC-6/AC-7 (one full unattended cycle, Discord-only, no T4)
- [ ] S3.2 — Watchdog: detect a stalled/no-progress cycle (gate approved but not crossed; same step twice) → escalate to Discord, never silently retry forever · Files: cycle logic · Test: AC-7 (stall is surfaced, not looped)
- [ ] S3.3 — Live end-to-end demonstration the supervisor can WATCH: a real idea → Discord-accept → auto-plan (with a mid-plan question) → execute → wrap → retro → next-ask, captured in one transcript · Test: all ACs (the "I can finally see it run" milestone)

### Phase 4 — Memory/harness redesign (DEFERRED — research-after, per user)

- [ ] S4.* — VISION.md (separate from rules), automatic episodic compaction, routing/INDEX for on-demand loading, RAG/pgvector foundation. Cross-references `agent-os-evolution.md` Phase 4 + RAG. **Not started until Phases 0–3 ship**; the agent researches the design then proposes (research-before-design), human accepts.

## Out of scope

- The Phase 4 memory/harness redesign — explicitly deferred to research-after (user's ordering). Listed only so it isn't lost.
- A genuine always-on daemon (NUC-hosted, Session-0 credentials) — noted as a follow-up idea; this plan accepts the at-logon + periodic ceiling.
- Re-introducing a `.claude/rules/*.md` tier — already rejected (skill-law-refactor); references/<domain>.md is the chosen mechanism.
- Any change to the autonomy contract's hard invariants or to what T4 hard-blocks.

## Open questions / risks

1. **Approval fatigue.** Auto-graduation + enrol gate add two new Discord asks per idea. Mitigation: batch them (present the finalised plan once, with the planning Q&A already resolved), gate only the enrol decision; keep idle gap-analysis to once/day.
2. **Worker reliability is the weak link** (Finding #4): a cheap-model worker over-thinks deterministic tool output. Mitigation: S0.2 (trust gate-cli verbatim) + run decision/gate-cross batches on Opus, mechanical batches on Sonnet.
3. **Self-critique coherence trap.** The retro must NEVER be the agent grading its own reasoning. Mitigation (AC-5): score only against external signal (tests/lint/gate/diff); the retro proposes, the human disposes.
4. **Governance bottleneck.** Most steps touch governance (skills/scripts) ⇒ human must commit each proposed diff. Mitigation: batch the diffs per phase, present them together, keep them small + annotated.

## Decisions to distill

To land in `nuc-platform/06-knowledge-ledger.md` + the relevant `decisions.md` at `/session-wrap`:

- The closed loop = chaining verified pieces + automating the human-decision handoffs BETWEEN them, NOT a rebuild; the missing links were idea→plan graduation, enrol gate, auto-wrap, and retro→todo.
- Fresh-`claude -p`-per-cycle is the answer to "context >60% degrades intelligence" — Anthropic recommends fresh context over compaction; we never grow a long session, so there is nothing to auto-compact.
- Retro/self-improvement is only trustworthy when grounded in external signal (Reflexion + the self-correction-reliability finding); a closed self-grading loop degrades.
- Reject the long-lived daemon (AutoGPT/BabyAGI failure lineage); bounded fresh cycles + retry cap + budget cap + default-deny-on-timeout is the safe shape.
