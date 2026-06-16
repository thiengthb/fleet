---
title: Autonomous agent — governed self-execution + research-grounded self-proposal, human stays supervisor
kind: feature # feature | system-change | fix | refactor | chore
status: active # draft → active → done | abandoned
created: 2026-06-14
updated: 2026-06-16 # B5 PASSED — full unattended loop (throwaway plan, supervised from phone): 3 fresh-context batches, subagent-delegated wide read, phone-approved gate crossing (PR #2), zero T4 crossed (main untouched, verified independently). Finding #4 REPRODUCED on the cross step (1st Sonnet worker misdiagnosed approve→none; 2nd crossed) → SKILL-fix proposed. Operator re-hit the documented 2>&1-on-native-exe trap (ledger #60) on the first launch — run the orchestrator plainly/foreground. Layer B essentially complete; Layer C3 (unattended proposer) is the remaining optional residue
related:
  [
    nuc-platform/plans/2026-06-14-discord-control-plane.md (accepted RFC — B4 design),
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
- [ ] B4 — Discord two-way control plane. **Design = `plans/2026-06-14-discord-control-plane.md` (accepted, full scope).** `nuc-ops-bot` = gateway bot ⇒ no public endpoint. **Gate-token protocol (single source of truth both sides):** worker mints `gate_id = GATE-<branch>-<shortuuid>` on park; approval = RS256-signed `{gate_id, decision, iat, exp=iat+15m, jti}`; bot writes `gates/<gate_id>.json` to a private gates repo; worker pulls read-only, accepts iff sig✓ + gate_id match + not-expired + jti-unused, then consumes jti + deletes file. custom_id = closed enum `approve:<gate_id>`/`deny:<gate_id>` (no free-text → command).
  - **B4a — decision capture + worker read/verify (LOW risk, no hook change):**
    - [x] B4a.1 *(this machine)* — `gate-verify.mjs` pure verify-then-parse core (hard-coded RSA-SHA256 + pinned public key = no alg-confusion; fail-closed; gate_id+exp+jti checks) + self-pruning consumed-jti store · `.claude/scripts/gate-verify.mjs` + `.test.mjs` · **Verified 20/20** (accept approve/deny · reject expired/exp==now/wrong-gate/replay/tamper/wrong-key/bad-decision/missing-fields/non-JSON/malformed/garbage-key + nonce round-trip). Not committed (awaiting user; prettier on commit).
    - [x] B4a.2 *(this machine)* — worker CLI `gate-cli.mjs` (request/check/consume, reuses gate-verify) **built + full-stack tested** (real bot-signed token: approve→consume→replay-reject→deny). SKILL + both orchestrators now have **full drop-in sandbox copies** in `b4b-sandbox/` (SKILL Step 1.5 check→cross→consume + Step 5 request + carved Hard-never; orchestrators auto-sync gates repo + **removed `git push` from CLI-disallow** so the hook is sole push-arbiter). Verified: `bash -n`+dry-run (.sh), parse+dry-run (.ps1). **INSTALLED to live `.claude/` by human (cp) + re-verified 20/20·24/24 from live locations (2026-06-14).**
    - [~] B4a.3 *(nuc-ops-bot — NOW cloned)* — **CODE COMPLETE** `nuc-ops-bot/gate_approval.py`: `tasks.loop` polls the gates repo `requests/` (GitHub Contents API/aiohttp), posts Duyệt/Từ chối buttons, **reuses `guards.user_allowed`** (server-side allowlist), RS256-signs token (key b64 in `.env`), writes `gates/<id>.json` + deletes the request. Wired in `bot.py` (on_ready), `cryptography==44.0.0` pinned, `.env.example` documented. py_compile ✓; **Python↔Node sign/verify interop ✓**. Live discord/GitHub = test on deploy (B4b.3).
    - [x] B4a.4 *(ops — DONE 2026-06-15)* — provisioned + deployed: RSA keypair (pub `.claude/keys/gate-approval.pub.pem` committed), private `nuc-agent-gates` repo + clone, fine-grained PAT, approval channel id, bot deployed → logs `gate-approval ON`. **Signing key was ROTATED** mid-provision (a diagnostic `grep -o` over a malformed `.env` leaked the original → [[never-print-secret-file-contents]]). Env delivered by the new `/nuc-set-env` skill (local mirror → ssh STDIN, idempotent upsert + auto-heal of malformed lines). Remaining doc-sync: `INVENTORY.md` + `auth-apps.md` (gateway only, no endpoint).
  - **B4b — token-gated T3 release (HIGH risk; agent-proposes / HUMAN-COMMITS the hook):**
    - [x] B4b.1 *(this machine; HUMAN INSTALLED)* — **INSTALLED to live by human** (cp `b4b-sandbox/hooks/autonomy-gate.mjs` → `.claude/hooks/`, committed below) + re-verified **24/24** from the live location. Gate stays fully locked until provisioning (B4a.4) supplies the public key + a signed token. The live `autonomy-gate.mjs` reuses `gate-verify.mjs`; default-deny + fail-closed; HARD_DENY (force/merge/pr-merge/release/rm/docker/ssh/db/dep/power) checked first = never unlockable; only `git push <remote> auto/<branch>` (non-force, no metachars, ref==gate branch) + `gh pr create` (no metachars) are token-unlockable with a fresh APPROVE token. **T4 never reachable by any token.** ⚠️ Claude Code's auto-mode classifier (correctly) BLOCKED the agent editing the live gate → proposal lives in `plans/b4b-sandbox/hooks/autonomy-gate.mjs` (install-ready: import paths match), the human installs+commits. Live gate unchanged until then (safe: it only relaxes when a valid token exists, impossible pre-B4a).
    - [x] B4b.2 *(this machine)* — exhaustive e2e test `plans/b4b-sandbox/hooks/autonomy-gate.test.mjs` (spawns the hook, real keypair stands in for the bot) · **Verified 24/24**: allow push-auto/pr-create w/ approve token; block main/force/merge/docker/ssh/rm + metachar-smuggle + deny/expired/wrong-gate/replay/no-token/no-state/no-pubkey/bare-push even w/ token; governance-write still blocked; interactive stands down.
    - [x] (GATE) B4b.3 *(BOT+this, supervised — DONE 2026-06-15)* — **LIVE e2e PASSED.** park → `gate-cli request` → Discord card → **Duyệt from phone** → bot-signed token verified (live keypair consistent: signer pub == committed `gate-approval.pub.pem`) → under `CLAUDE_AUTONOMOUS=1` the hook **ALLOWED exactly** `git push origin auto/b4b3-e2e` + `gh pr create` (PR #1, since closed) → `consume` → a 2nd `auto/*` push **BLOCKED** (`no current-gate state` = single-use) and `git push origin main` **BLOCKED**. **Zero T4 crossed.** Throwaway plan `plans/2026-06-15-b4b3-e2e-smoke.md` + branch + PR cleaned up.
      - **Durable fixes applied:** ① `.claude/settings.local.json` allow += `Bash(node .claude/scripts/gate-cli.mjs *)` + `Bash(gh pr create *)` — the autonomous worker previously could NOT run the control-plane (permission-denied, headless). ② bot `.env` `GATE_APPROVAL_CHANNEL_ID` → ops-channel (the documented fallback) so the approval click passes `guards.user_allowed` (see finding 3); also removed a stray dead-key orphan line from the bot `.env`.
      - **Findings (4) — proposed follow-ups, human commits (governance):** _#1/#2/#3 **RESOLVED 2026-06-15** — sandbox
        `plans/b4b3-fixes-sandbox/` reviewed + installed to live by human (cp + verify), #3 pushed to `nuc-ops-bot`; sandbox
        removed. #4 (worker reliability) stays OPEN → watch in B5._
        1. ✅ **FIXED** (`nuc-set-env-remote.sh` KEYMAX=64 bound; verified: orphan base64 not listed + auto-heal drops it) — **`nuc-set-env-remote.sh` leaks values on a malformed `.env`** — its "names-only" `grep -oE '^...=' ` listing printed a base64 *private key* line (verified DEAD: orphan pubkey 86f5 ≠ committed a546 → harmless, no rotation) but a malformed `.env` carrying a *live* key would leak it. Fix: list keys via a parser that only emits the LHS of well-formed `KEY=` lines, and have auto-heal drop long-base64 orphan lines. Relates to [[never-print-secret-file-contents]].
        2. ✅ **FIXED — unblocks B5** (auto-pilot-run.sh/.ps1 now also spawn a batch + count progress when `gate-cli check == approve`; verified: dry-run + `none`→no-op) — **Orchestration gap — auto-pilot can't autonomously cross an approved gate.** The skill marks a parked gate `- [ ] (GATE) …`; `auto-pilot-run.*` `Get-UncheckedCount` *excludes* `(GATE)` lines → when the gate is the last step the loop sees 0 work → never spawns the crossing batch. The cross had to be driven by a constrained `CLAUDE_AUTONOMOUS=1` invocation. Fix: count an approved gate (or keep one non-GATE step), so Step 1.5 actually runs.
        3. ✅ **FIXED + DEPLOYED** (`guards.user_allowed(channel_id=…)` + `_decide` authorizes `APPROVAL_CHANNEL_ID`; backward-compatible — env stopgap still passes until reverted to a dedicated channel; pushed to `nuc-ops-bot` → Watchtower) — **gate-approval channel-authz mismatch** — `gate_approval._decide` reuses `guards.user_allowed`, which hard-binds `OPS_CHANNEL_ID`; the card is posted to `GATE_APPROVAL_CHANNEL_ID`. Different channels ⇒ every click rejected ("⛔ không có quyền duyệt gate"). Collapsed to ops-channel as a stopgap; proper fix = authorize the approval channel in code (logged in `nuc-ops-bot/docs/decisions.md`).
        4. **Worker reliability** — the Sonnet auto-pilot worker repeatedly misdiagnosed (claimed `node`/`~/.claude` writes "need approval" without retrying after the allowlist fix; re-marked `(GATE)`; dropped shell quotes around the PR title → bash parse error). The security HOOK held regardless; the worker's orchestration judgment is the weak link. "DEPLOYED" (B4a.4) was premature — the approval path had never been clicked until B4b.3.
           - **B5 REPRODUCTION (2026-06-16, still OPEN as a SKILL fix):** on the gate-CROSS step, the 1st fresh Sonnet worker received a valid `approve` from `gate-cli check` but then "re-verified" by hand against the WRONG relative path (`agent-gates/gates/` instead of `~/.claude/agent-gates/`), overrode the correct result to `none`, and parked. A 2nd fresh Sonnet worker crossed correctly. **Proposed mitigation (human commits — `/auto-pilot` SKILL is governance):** Step 1.5 must tell the worker to TRUST `gate-cli check`'s one-word output verbatim and NOT hand-re-verify the gates dir; and/or run the single crossing batch on Opus (R3). Pattern: the Sonnet worker over-thinks deterministic tool output — the fix is to forbid the re-verification, not to add more checks.
- [x] B5 — **DONE 2026-06-16 — full unattended loop PASSED.** Throwaway plan `plans/2026-06-16-b5-loop-smoke.md` (since cleaned up). 3 fresh-context batches via `auto-pilot-run.ps1` (Sonnet): **batch-1** advanced 4 safe-zone steps incl. a **subagent-delegated wide read** (Explore/sonnet read 36 `SKILL.md` → index) + parked at the PR gate + minted/published request `GATE-b5-loop-smoke-4f9e2a`; supervisor pressed **Duyệt from phone** → bot-signed APPROVE token verified; **batch-3** crossed **exactly** `git push origin auto/b5-loop-smoke` + `gh pr create` (PR #2) → `consume` (single-use). **Independently verified (NOT from the worker digest): `main` untouched local+origin (`d9c1cd8`), token consumed, only the `auto/` branch pushed → zero T4 crossed.** Two gotchas:
  - **(finding #4 reproduced — see below)** batch-2 = a 1st fresh Sonnet worker that misdiagnosed a valid `approve` as `none` and parked; a 2nd fresh worker (batch-3) crossed correctly. Hook held throughout.
  - **operator note (NOT a new defect — a RE-HIT of the documented 2026-06-15 trap, ledger #60):** the first launch failed because I piped the orchestrator through `2>&1 | Tee-Object`; `2>&1` on the inner `& claude` *native exe* under the script's `$ErrorActionPreference='Stop'` turns the benign "no stdin data in 3s" warning into a TERMINATING error → silently kills the worker ("no progress"). Remedy = run the orchestrator **plainly** (no `2>&1`/stderr-capture), foreground, `-MaxBatches 1` per call — exactly the prior session's fix. Lesson: read the day-log/ledger traps before re-running the orchestrator.

### Layer C — Autonomous proposer (research-grounded "what next" — most-dangerous, last)
> **SUPERSEDED by the `/idea` skill (Phase 1, shipped 2026-06-14) — do NOT build a separate `/feature-proposal`.** The
> dedup was resolved via idea-0009 (supervisor decision 2026-06-14, full scope): `/idea` already realizes C1+C2. The only
> genuinely-distinct residue is C3's *unattended* path (the orchestrator invoking gap-analysis inside a no-human batch).
- [x] C1 — *Realized by `/idea`*: `/idea sort` gap-analysis (grounded in INVENTORY drift / missing test coverage / a documented gap / prior-art, NOT opinion) + `/idea analyze` → research-then-design → RFC-lite `proposal.md` → halts. Skill `.claude/skills/idea/SKILL.md`; queue `nuc-platform/10-idea-queue.md`.
- [x] C2 — *Realized by `/idea`*: bounded backlog = WIP cap `active ≤ 5`; Reflexion accept/reject memory = the `outcome:` oracle (with *why*); **"nothing worth proposing" is now a first-class gap-analysis output** (anti-churn, added to the skill 2026-06-14).
- [ ] C3 — **Unattended** proposer integration (the residue, NOT yet built): the `auto-pilot` orchestrator invokes `/idea sort` gap-analysis inside a no-human batch, enforces the bounded-backlog throttle in-loop, surfaces 1–2 grounded `inbox` ideas via the digest, and **halts** — no proposal auto-enters build; rejected patterns not re-proposed. (Interactive C1/C2 above already work in a supervised session; this wires them into the unattended loop — gated on B4/B5 being live.)

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
