---
title: Autonomous agent — governed self-execution + research-grounded self-proposal, human stays supervisor
kind: feature # feature | system-change | fix | refactor | chore
status: active # draft → active → done | abandoned
created: 2026-06-14
updated: 2026-06-14 # Layer A done; B1-B3 done — first LIVE autonomous batch worked (advanced safe steps, parked at gate, clean digest on Sonnet); checkpoint before B4 (Discord, touches other repos)
related:
  [
    .claude/hooks/secret-guard.mjs,
    .claude/skills/project-plan,
    .claude/skills/session-wrap,
    .claude/skills/honest-critique,
    CLAUDE.md,
    nuc-ops-bot (repo — Discord buttons + user-ID allowlist),
    nuc-monitor (repo — Discord webhook),
    nuc-platform/INVENTORY.md,
  ]
---

## Goal

Let the agent (1) **advance an already-approved plan** unattended on the local PC inside a safe zone, and later
(2) **research and PROPOSE** what to build next — while the human stays a **supervisor, not operator**. "Done" =
both capabilities run without ever crossing a gate unattended, governed by a deterministic layer that makes
self-harm (push to prod, delete data, or editing its own guardrails) *impossible* without human sign-off.

This is the system's **most safety-critical feature**: once it leaves selective human control it can collapse the
platform if the governance is not complete from the start. Build order is therefore **Governance → Executor →
Proposer** (most-dangerous capability last, per the AWS Scope 1→4 "earn autonomy as audit trail accrues" model).

## Context

The user is burning out timing Claude's session/weekly reset windows; wants progress decoupled from presence, as
supervisor. Decided shape (AskUserQuestion, this session): objective = **balanced** (plan progress first; leftover
quota only on a pre-approved idle backlog, never churn); **runs local PC**; autonomy = plan+research+branch+docs,
**stop before PR**; channel = reuse Discord (`nuc-ops-bot` buttons+allowlist, `nuc-monitor` webhook). Then the user
raised the deeper questions this plan now answers: self-proposal, anti-bias research discipline, self-modification
risk, and subagent capability-matching.

## Prior art & sources (this plan obeys its own research-before-design rule)

- Decision tiers / autonomy levels: AWS Agentic Security Scoping Matrix (Scope 1–4); HITL/HOTL/HOoTL; Bezos Type-1/2.
- Guardrails are **architectural, not prompted**; self-modification is the killer risk: **CVE-2025-53773** (Copilot
  rewrote its own approval settings → unrestricted shell), Replit agent deleted 1200+ prod records ignoring a freeze.
- Self-direction: **propose-don't-execute** (Devin/Aider/OpenHands); **pure self-critique is harmful** (98%→57%),
  needs an external signal (Reflexion, CRITIC); bounded backlog + "nothing-worth-doing" return path; plan-level (not
  per-action) gating avoids 93% rubber-stamp fatigue.
- Research-before-design: Rust RFC (Prior art + Alternatives), Python PEP (Rejected Ideas), MADR (Considered Options
  ≥2), Google design-docs (Alternatives = the most important section).
- Delegation: Anthropic multi-agent (orchestrator delegates + LLM-judges output before accepting); route by
  signal; **single-threaded writes only** (Cognition); flat "bag of agents" amplifies error ~17x vs ~4.4x w/ a gatekeeper.
- Key sources: AWS Agentic Security Scoping Matrix
  (https://aws.amazon.com/blogs/security/the-agentic-ai-security-scoping-matrix-a-framework-for-securing-autonomous-ai-systems/) ·
  Anthropic "measuring agent autonomy" (https://anthropic.com/news/measuring-agent-autonomy) ·
  Reflexion (https://arxiv.org/abs/2303.11366) · Cognition "Don't build multi-agents"
  (https://cognition.ai/blog/dont-build-multi-agents) · MADR (https://github.com/adr/madr).

## Decision classification — the rule that operationalizes "important decisions through me"

Every agent action is classed by **reversibility × blast-radius**. Test: *"undo in < 5 min with no external
side-effect?"* No ⇒ T4. The `autonomy-gate.mjs` hook enforces this (permissioning > prompting).

| Tier | Examples | Unattended behaviour |
|---|---|---|
| **T1 read/analyze** | read, grep, web research, write a scratch/plan/proposal file | Autonomous · log only |
| **T2 reversible-local** | edit on a non-main **branch**, add tests/docs, local commit | Autonomous **within approved plan scope** · git-revertible |
| **T3 outward / semi-reversible** | open a PR, post Discord, install a dep, edit CI workflow, touch Authentik/`.env` handling | **NOTIFY the user + gate** (the "tell me when using an important privilege" rule) |
| **T4 irreversible / high-blast** | push/merge to **main**, **deploy**, delete data/volume/branch-with-work, docker down/prune, history rewrite, **edit own governance** | **HARD-BLOCKED unattended** · explicit human approval, no exceptions |

## Hard invariants (architectural, not advisory)

1. **Never push main / never deploy / never destructive** unattended (deployed apps auto-ship on push to main).
2. **Self-modification prohibition** (the CVE-2025-53773 lesson): the agent NEVER autonomously writes its own
   governance — `.claude/settings.json`, `.claude/hooks/*`, the autonomy-gate, the decision taxonomy, the autonomy
   boundary, the idle backlog. It may *propose* changes; a **human commits** them. (T4.)
3. **No lethal trifecta in one unattended run**: private data + untrusted input + outward comms never combined.
4. **Graceful degradation, never auto-escalation**: on anomaly (unexpected paths, repeated gate hits, low
   confidence) the run **downgrades to park-and-ask**; autonomy is only ever *raised* by the human.
5. **Headless = the hook is the SOLE gate** (no human per call) ⇒ it must be airtight + exhaustively tested.

## Research-before-design (the anti-bias rule the user demanded)

Any design / new-feature plan / proposal MUST be produced by **research-then-design**, enforced structurally (not
hoped): a non-skippable Research step (≥3 web searches, ≥2 fetched sources) BEFORE the recommendation, landing in a
mandated RFC-lite template whose REQUIRED sections gate completion:

```
Problem · Prior Art & Sources (≥2 external URLs) · Options Considered (≥2, w/ tradeoffs) ·
Recommendation (+ one-line "why not the others") · Pre-mortem (≥2 failure modes) · Counter-case (1 sentence)
```

Empty Prior-Art / <2 options ⇒ the skill refuses to emit a Recommendation. (Modeled live: this plan was written
after 4 research threads.)

## Delegation rubric (so a mis-matched subagent can't pollute the system)

- **Route by signal:** mechanical / read-only / bulk (grep, wide read, web research) → **Sonnet/Haiku** subagent;
  judgment / security / multi-file / ambiguous → **Opus** main loop (asymmetric risk: weak model contaminates).
- **Subagents READ / RESEARCH / ANSWER — they do NOT write to shared state.** All writes are single-threaded by the
  orchestrator/worker, **after Opus reviews** the subagent output (sanity/LLM-judge) before accepting it.
- Deterministic stopping guard (orchestrator caps iterations/agents); don't over-decompose (a >80%-solo task gets no fan-out).

## Execution model — stateless worker, fresh context per batch (prevents context overflow; verified)

A long session fills context, auto-compacts (~70–80%, NOT disableable, degrades, burns re-derive tokens). Instead: a
**dumb external orchestrator** (shell / Task Scheduler / n8n — NOT a Claude session, 0 agent tokens) relaunches a
**fresh `claude -p` worker** per batch. Each: reads durable state from disk (plan + 00-map + decisions) → runs one
bounded batch → delegates heavy reads to isolated subagents → writes state back (check off, commit branch,
`/session-wrap` log) → exits. The plan file is the cross-context memory. Never `--continue`/`--resume` (they reload
full history = re-pay tokens).

| Token/context sink | Fix |
|---|---|
| Long session → compact churn | Fresh `claude -p` per batch; state on disk |
| Per-batch cold reload | Thin CLAUDE.md/memory; right-size batches; minimal targeted reads |
| Heavy reads / wide grep / long output | Delegate to isolated subagents (conclusions, not dumps); line-ranged reads; `Grep head_limit` |
| Re-exploration each batch | Self-contained plan steps (`file:line` + verify) + 00-map = the map ⇒ no re-grep |
| Supervised-session sprawl | `/session-wrap` + `/clear` at task boundaries |
| Orchestrator idling | Orchestrator = dumb script, never a Claude session |

Model discipline: batch workers on **Sonnet**; heavy reads on **Haiku/Sonnet** subagents; **Opus** only supervised / hard reasoning.

Ruled out: auto-merge/deploy (ever); cloud routines (no local/NUC reach); NUC daemon (security + API billing);
programmatic quota-reset detection (none exists — crude time-trigger only); token-maximization as a goal.

## Steps — three layers, each gated by the user before the next

### Layer A — Governance foundation (build the locks before any autonomy)
- [x] A1 — Decision-taxonomy + hard invariants → durable reference `nuc-platform/09-autonomy-contract.md` + thin `CLAUDE.md` rule + hooks `README.md` row. Done.
- [x] A2 — `autonomy-gate.mjs` PreToolUse hook · `.claude/hooks/autonomy-gate.mjs` wired in `.claude/settings.json` (matcher `Bash|Edit|Write|MultiEdit`) · `CLAUDE_AUTONOMOUS=1`: T4/T3 deny (push/merge main, deploy, destructive, dep-install, PR-create, ssh, **writes to own-governance paths**), lenient when unset, fail-closed · **Verified 28/28** cases (block + pass + interactive-standdown). T3-notify→Discord deferred to B4 (currently blocked = fail-closed). NOT active until settings reload.
- [x] A3 — Autonomous-mode signal = env `CLAUDE_AUTONOMOUS=1` (fail-closed), documented in 09 + the hook. Durable record = 09 (formal decisions.md distillation at `/session-wrap`).
- [x] A4 — Research-before-design gate: RFC-lite `templates/proposal.md` + `kind:`-aware plan template + advisory `prior-art-check.mjs` hook (nudges when a `kind: feature` plan goes `active` with <2 external URLs) + rule baked into `/project-plan`. **Verified 6/6** (incl. this plan now passing). Hard enforcement lives in the proposer skill (Layer C); this is the in-loop backstop.

### Layer B — Autonomous executor (advance an approved plan, supervised → unattended)
- [x] B1 — `/auto-pilot` skill · `.claude/skills/auto-pilot/SKILL.md` · stateless one-batch contract (fresh context): load minimal state → next 1-3 safe-zone steps → delegate heavy reads to subagents (read/answer only, no writes) → branch + local commit → PARK at gate + digest → balanced idle rule + "nothing-worth-doing" exit. Done.
- [x] B2 — Dumb orchestrator · `.claude/scripts/auto-pilot-run.ps1` + `.sh` (root `scripts/` is gitignored — control-plane repo only tracks `/.claude/` + `/nuc-platform/`) · loop fresh `claude -p` per batch (sets `CLAUDE_AUTONOMOUS=1`, no `--continue`, `--disallowedTools` defense-in-depth, never `--bare`); stop on no-progress/no-steps/cap; `--dry-run` · **Dry-loop verified** on both (8 unchecked, identical; PS fixed: ASCII-only + literal `(GATE)`). CLI flags validated via `claude --help`.
- [x] B3 — First LIVE run validated (1-batch smoke test, user watching via report). A fresh Sonnet worker created branch `auto/<slug>`, did 2 safe-zone steps, **committed locally**, checked off the steps, and **PARKED on its own at the GATE step** (recognized "open a PR" as T3, didn't attempt it) + emitted a clean digest. Found+fixed a `.sh` `--disallowedTools` word-split bug (now a bash array; hook remains the authoritative gate). NOT yet exercised: multi-batch loop + subagent delegation on a wide read → watch in B5. Throwaway plan/branch cleaned up.
- [ ] B4 — Discord control plane (reuse): digest via `nuc-monitor` webhook; Approve/Deny + allowlist via `nuc-ops-bot` → flips a flag the next batch reads (**security review: no free-text → command**); T3 notify wired.
- [ ] B5 — Real unattended window on a low-risk plan, user supervising **from phone**: works → digest → park → approve from phone → PR step done in a supervised session. Test: full loop, zero gate crossed unattended.

### Layer C — Autonomous proposer (research-grounded "what next" — most-dangerous, last)
- [ ] C1 — `/feature-proposal` skill · gap-analysis grounded in **external standards** (INVENTORY, test coverage, docs, web best-practice) NOT self-opinion → research-then-design → emits a proposal in the RFC-lite template → **halts** (never builds).
- [ ] C2 — **Bounded backlog** (max ~5 unreviewed proposals; blocked from generating more while full = the user's review is the throttle) + **"nothing worth doing" valid output** (anti-churn) + Reflexion memory of accept/reject to bias future proposals.
- [ ] C3 — Supervised run: agent proposes 1–2 items, user accepts/rejects; accepted ones enter the normal `/project-plan` → Layer-B pipeline. Test: no proposal auto-enters build; rejected pattern not re-proposed.

## Out of scope

Auto-merge/deploy ever; the agent editing its own governance; cloud routines; a NUC daemon; programmatic
quota-reset detection; token-maximization; per-action approval (use plan-level); Agent-SDK rewrite (CLI `claude -p`
is v1 — SDK + context-editing/memory-tool betas are a noted later option).

## Open questions / risks

- **R1 — autonomous-mode detection** must be fail-closed (marker set by the skill; if unsure → interactive/lenient, but branch-only + never-push-main always hold).
- **R2 — nuc-ops-bot approval mechanism** (flag-file vs API) must not widen its existing Docker-control attack surface.
- **R3 — Sonnet quality** for plan-advancing + for grounded gap-analysis; some steps may need Opus → note per-step (validate in B3/C3).
- **R4 — batch sizing** sweet spot (cold-reload cost vs in-batch compaction).
- **R5 — proposer is the highest-risk layer**: even gated, a steady stream of plausible proposals can slowly steer the platform. Mitigate with the bounded backlog + the "nothing-worth-doing" norm + periodic human direction-setting; revisit whether Layer C is even wanted after Layer B is lived-in.

## Decisions to distill

- The autonomy contract + decision taxonomy (T1–T4); **self-modification prohibition** as a hard invariant (CVE lesson); headless = hook is sole gate.
- Stateless-worker / fresh-context-per-batch prevents context overflow; plan file = cross-context memory.
- Propose-don't-execute + external-grounded gap-analysis (pure self-critique is harmful); bounded backlog; plan-level gating.
- Research-before-design enforced structurally (RFC-lite, gated Prior-Art) — the anti-bias rule.
- Delegation rubric: subagents read/answer only, single-threaded reviewed writes; route by signal; no over-decomposition.
- Build order Governance → Executor → Proposer (earn autonomy as audit trail accrues).
