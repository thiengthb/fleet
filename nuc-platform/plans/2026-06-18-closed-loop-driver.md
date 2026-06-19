---
title: Closed-loop driver — chain the verified autonomy pieces into one self-perpetuating, Discord-supervised cycle
kind: system-change # REQUIRES prior art before `active`
status: active # 2026-06-19 — Phases 1+2 COMPLETE; S3.3 enrol round-trip PROVEN LIVE via Discord; S3.2 watchdog + S3.4(a)(b) DONE; only S3.1 (retry-cap) + full-S3.3 (planning-Q&A + single-transcript chain) remain
created: 2026-06-18
updated: 2026-06-19 # Phases 1+2 COMPLETE. Phase 1 graduation+enrol RUNTIME-verified by a LIVE local smoke test (sonnet worker graduated synthetic idea-9999 → correct draft plan [draft/auto_pilot:false/enrol:pending], no spurious Q&A; enrol batch minted an ask + PARKED, plan NOT armed without a signed answer). The smoke test caught + fixed a real bug: Test-HasUngraduatedAccept matched the Rules-prose `## Done` substring → graduation never fired (commit 1dd928c; vindicates ledger #71 wiring≠runtime). Still open: Phase 2 reflect batch not yet runtime-run; live DISCORD round-trip (gate-clone) + branch-state coherence unproven (S3.x); enrol-arming hook-hardening proposed (proposals/2026-06-19-…)
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

- [x] S1.1 — `outcome: accept` → auto-create `draft` plan. APPLIED 2026-06-18 (interactive, supervisor-approved): `auto-pilot-scheduled.ps1` gained `Test-HasUngraduatedAccept` (line-anchored `outcome: accept` ABOVE `## Done`, prose-safe) + `Invoke-AutonomousClaude` helper + a graduation phase (one bounded batch → `draft` plan, `auto_pilot: false`, idempotent, parks for the enrol gate, NEVER auto-enrols) ahead of C3; `/idea` SKILL + `10-idea-queue.md` schema document graduation + the `graduated_plan:` field. Verified: parse OK, dry-run on the real queue skips correctly (false-positive on the header prose found + fixed), detection unit-tested True/False/False. · Test: AC-2 (draft appears, no enrol)
- [x] S1.2 — Planning-time Q&A wired. APPLIED 2026-06-19 (interactive, supervisor-approved): added gate-repo sync helpers (`Test-GateRepo`/`Invoke-GatePull`/`Invoke-GatePush`, mirroring the verified orchestrator) and wrapped the graduation batch in pull-before/push-after, so an `ask-cli` question reaches Discord and the answer is pulled back on a later cycle. Graduation prompt rewritten to a step-0 RESUME (consume a prior answer as DATA) → step-1 IDEMPOTENCY + **pending-ask guard** (no duplicate asks, no duplicate plans) → ask at most ONE question per draft via `ask-cli --options`, recorded in the plan's Open-questions. `/idea` SKILL updated. Verified: parse OK, dry-run clean (gate clone absent → pull/push no-op, graduation still skips correctly). · Test: AC-2. **Known constraint:** `ask-cli` `current-ask.json` is singular + shared with the `/auto-pilot` worker's asks — a graduation ask and a plan-advance ask cannot be pending at the same time (fine for the bounded sequential cycle; revisit if cycles parallelise).
- [x] S1.3 — Enrol gate shipped. APPLIED 2026-06-19 (interactive, supervisor-approved): graduation step 5 marks the finalised draft `enrol: pending`; a new wrapper phase (`Test-DraftAwaitingEnrol` + enrol batch, gate-sync wrapped) asks the supervisor via Discord (`ask-cli --options 'enrol||not yet||reject'`) and applies the SIGNED answer — enrol⇒`status: active`+`auto_pilot: true`, not-yet⇒`enrol: deferred`, reject⇒`abandoned`. **Decision:** used `ask-cli` (answer = DATA) NOT `gate-cli` — gate-cli's `approve` is wired to release a push+PR in the hook, so reusing it would conflate "approve push" with "approve enrol"; ask-cli has no hook side-effect and needs **no bot change** (the bot already renders options + signs answers). Verified: parse OK, dry-run skips correctly, `Test-DraftAwaitingEnrol` unit-tested True/False/False/False. · Test: AC-3 (no enrol answer → no `auto_pilot: true`). **Defense-in-depth deferred:** the "only arm with a signed answer" rule is prompt-enforced today; the hook-level enforcement (block `auto_pilot: true` writes without a valid enrol answer) is PROPOSED for human commit in `proposals/2026-06-19-enrol-gate-hook-hardening.md` (governance — agent must not self-edit `autonomy-gate.mjs`). Phase 3 is not "done" until that lands.

### Phase 2 — Auto-wrap + retro→todo (the genuine gap)

- [x] S2.1 — Auto-wrap shipped (APPLIED 2026-06-19, interactive). One end-of-cycle `reflect` batch runs the `/session-wrap` procedure to distil any NON-OBVIOUS decision into `decisions.md`/`06-knowledge-ledger.md` (per-batch day-log digests already written by `/auto-pilot` Step 6, so no `/auto-pilot` edit needed — not duplicated). · Test: AC-4 ✓ (runs with no human invoke; gated on `$didWork` so idle cycles skip)
- [x] S2.2 — Retro shipped (same `reflect` batch). Reviews the cycle's git diff + test/lint/gate FAILURES and files real preventive follow-ups as propose-only `inbox` ideas via `/idea add`; **prompt hard-binds the retro to EXTERNAL signal only, never self-opinion** (AC-5 / the coherence trap), and "file nothing" is the correct outcome when no grounded follow-up exists. Never auto-accepts. · Test: AC-5
- [x] S2.3 — Surface-next shipped (same batch): runs `/idea sort` (re-rank + wildcard) then pushes ONE Discord digest via `ask-cli report` with what the cycle did + top candidate + a single next-action (Option C discipline folded in). Batch is gate-sync wrapped so the digest reaches Discord. · Test: AC-6. Verified: parse OK, dry-run both branches (idle→skip; opted-in plan→reflection WOULD run).

### Phase 3 — Close the loop (the outer driver)

- [ ] S3.1 — Wire the full cycle in `auto-pilot-scheduled.ps1`: advance plans → if idle, gap-analysis → on accepted idea, graduate (Phase 1) → on enrol, execute → auto-wrap (S2.1) → retro (S2.2) → re-rank + ask (S2.3) → exit. Bounded, fresh, budget-capped, retry cap = 3 then escalate to Discord · Files: propose diff (governance) · Test: AC-6/AC-7 (one full unattended cycle, Discord-only, no T4)
- [x] S3.2 — Watchdog DONE 2026-06-19. New phase-4 block in `auto-pilot-scheduled.ps1`: progress fingerprint = sorted multiset of ALL local branch tips (`git for-each-ref refs/heads`); a "did work" cycle that moves no tip = no progress. Discriminates the two non-stall cases so it never false-alarms: (a) correctly PARKED on a human decision (`current-ask.json`/`current-gate.json` exists AND its `*-cli check` == none) → reset, expected waiting; (b) a human decision sitting UNCONSUMED (answered ask / `approve` gate not crossed) → treated as a stall (the stronger signal the AC named "gate approved but not crossed"). Escalates via `ask-cli report` → Discord only after `$StallThreshold=2` consecutive no-progress, not-parked cycles, and ONCE (an `escalated` flag, only set if the publish push actually succeeded → retries next cycle otherwise). State in `~/.claude/auto-pilot-logs/watchdog-state.json` (machine-bound runtime state). · Test: 10-scenario unit test of the decision fn ✓ (parked/unconsumed/no-progress/progress + escalate-once) + git-for-each-ref/JSON-roundtrip real-I/O ✓ + dry-run wiring ✓
- [~] S3.3 — Enrol round-trip PROVEN LIVE 2026-06-19 (the core HITL milestone). Provisioning was already in place (gate-clone → private `nuc-agent-gates`, bot `nuc-ops-bot` Up+healthy, polls every 25s). Ran a synthetic demo idea → graduation wrote a draft plan → enrol batch minted `ASK-enrol-b3e7d2` + pushed → bot posted the Discord card → supervisor clicked **enrol** → bot wrote the RS256-signed answer → `ask-cli check` verified it → next cycle ARMED the plan (`status: active` + `auto_pilot: true`, `enrol: pending` removed) + consumed the ask. Cleaned up (throwaway branches deleted, idea/plan/gates state cleared; authoritative dry-run confirms opted-in=0). **Still pending for full S3.3:** the planning-Q&A round-trip (demo idea had no ambiguity so S1.2's Discord ask path is wired-but-not-live-proven) and the single-transcript execute→wrap→retro→next-ask chain. · Test: AC-2/AC-3/AC-6 ✓ (enrol round-trip)
- [x] S3.4 (NEW, from S3.3 findings) — Reliability fixes the live demo surfaced: **(a) DONE 2026-06-19** — `Invoke-GatePush` no longer swallows a failed `git push`. Root cause was deeper than the `catch {}`: in PowerShell `git push` FAILS WITHOUT THROWING (sets `$LASTEXITCODE`, no exception), so the catch never fired. Fix checks `$LASTEXITCODE`, retries ONCE after `pull --ff-only` (the concurrent-bot non-ff case), and on final failure emits a LOUD `WARNING: gate push FAILED` line + returns `$false` (local commit preserved → next cycle retries). Runtime-verified in a temp-git sandbox: clean→no-op·True, good remote→True+reached, broken remote→False+warning+commit preserved. **(b) DONE 2026-06-19** — `Invoke-GatePush` now distinguishes "not provisioned" (gates dir absent → silent no-op is correct) from "provisioned-but-broken" (dir EXISTS with pending `asks/`/`reports/` JSON but no `.git` → those can never reach Discord): the latter now WARNS + returns `$false` instead of a silent no-op. Plus the watchdog's UNCONSUMED detector is the runtime backstop that catches a worker parked on an unpublished ask. Also fixed a self-introduced `2>&1`-on-native-git slip (ledger #60 trap under Start-Transcript) → plain `| Out-Null` + `$LASTEXITCODE`. · Files: `auto-pilot-scheduled.ps1` (gate-sync) · Test: temp-git sandbox 3-path ✓ + S3.4b pending-in-nonclone glob ✓

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
