# 09 — Autonomy contract (the governance the autonomous agent runs under)

The **durable** governance reference for any unattended/headless Claude Code run on this platform. Plans come and go
(`plans/2026-06-14-autonomous-agent.md` is the build roadmap); THIS file is the permanent contract the agent and the
`autonomy-gate.mjs` hook obey. Grounded in external prior art (AWS Agentic Security Scoping Matrix; Bezos Type-1/2;
CVE-2025-53773 where a Copilot agent rewrote its own approval settings; Anthropic "measuring agent autonomy").

## The marker: when is a run "autonomous"?

A run is autonomous **iff the env var `CLAUDE_AUTONOMOUS=1`** is set. Unset = interactive/supervised: a human + Claude
Code's own permission prompts are the gate, and `autonomy-gate.mjs` stands down. **Fail-closed:** in autonomous mode any
gate error blocks — a halted run is safe, an ungated one is not. (Reading an unparseable hook payload counts as an
error: the gate uses a strict parser, not the lenient shared one.)

> ### The trigger, and what is verified about it (2026-07-28)
>
> Enforcement fires when **either** holds:
>
> | Condition | Status |
> |---|---|
> | `CLAUDE_AUTONOMOUS=1` | explicit opt-in; always honoured |
> | `CLAUDE_CODE_ENTRYPOINT` is a known non-interactive entrypoint (`sdk-cli`) | **verified by probe** |
>
> The env var used to be the *only* trigger, set by the auto-pilot orchestrator retired earlier the same day —
> leaving nothing to set it. Rather than assume, a probe ran a real `claude -p` with an instrumented hook and settled
> what the harness exposes: an interactive terminal reports `CLAUDE_CODE_ENTRYPOINT="cli"`, a headless run reports
> `"sdk-cli"`. A non-interactive run is therefore **self-identifying**, and the gate no longer depends on anyone
> remembering a variable. (The hook payload also carries `permission_mode`, `session_id`, `cwd` and `tool_use_id`, if a
> future rule needs them.)
>
> ⚠ **Residual, honestly scoped:** that probe covered **local headless only**. What a scheduled or remote **cloud**
> agent reports is still unverified — it cannot be reached from a local session. So an **unrecognised** entrypoint does
> not silently pass: the gate stands down but says so **once per session**, as a `systemMessage` to the user *and*
> `additionalContext` to the model. Blocking on unknown was rejected deliberately — an unrecognised *interactive*
> entrypoint (an IDE, the desktop app) would break hands-on work, and a gate that obstructs gets switched off.
>
> **Therefore: set `CLAUDE_AUTONOMOUS=1` explicitly in the configuration of any scheduled or remote run.** When a cloud
> entrypoint value is observed, add it to `NON_INTERACTIVE` in `autonomy-gate.mjs` and record it here; if it is an
> interactive surface, add it to `INTERACTIVE` to silence the notice. Covered by `autonomy-gate.test.mjs` (75 cases,
> including the widened trigger, the once-per-session notice, and the no-entrypoint case).

## Decision tiers (reversibility × blast-radius)

Operational test for a tier: **"can this be undone in < 5 min with no external side-effect?"** No ⇒ T4.

| Tier | Examples | Unattended behaviour | Enforced by |
|---|---|---|---|
| **T1 read/analyze** | read, grep, web research, write a scratch/plan/proposal file | autonomous · log only | — |
| **T2 reversible-local** | edit on a non-`main` **branch**, add tests/docs, **local** `git commit` | autonomous **within approved-plan scope** · git-revertible | — |
| **T3 outward / semi-reversible** | open a PR, post Discord, install a dependency, edit CI, touch Authentik/`.env` handling | **NOTIFY + gate** (until the Discord approve path lands → currently **blocked**) | `autonomy-gate.mjs` |
| **T4 irreversible / high-blast** | push/merge to `main`, **deploy**, delete data/volume/branch-with-work, `docker` down/prune, history rewrite, **edit own governance** | **HARD-BLOCKED** · explicit human approval, no exceptions | `autonomy-gate.mjs` |

## Hard invariants (architectural, not advisory — the agent cannot prompt its way past these)

1. **Never push `main` / never deploy / never destructive** unattended (deployed apps auto-ship on push to `main` via
   Watchtower ≤60s; an unattended push = an unattended production deploy).
2. **Self-modification prohibition.** The agent NEVER autonomously writes its own governance — `.claude/settings*.json`,
   `.claude/hooks/**`, `.claude/skills/**`, `.claude/memory/**`, any `CLAUDE.md`, `.github/workflows/**`, `.git/**`,
   `.env*`. It may *propose* a change (a proposal artifact); a **human commits** it. (This is the CVE-2025-53773 lesson.)
   - **Skill induction (`/skill-proposer`)** is the sanctioned shape of "propose a change" for skills: the agent DRAFTS a
     skill into `nuc-platform/skill-proposals/` (outside the `.claude/skills/**` lock ⇒ a normal **T2** branch-local write)
     and **stops**. Installing = a **human** moving the draft into `.claude/skills/<name>/` after a security review (**T4**,
     hard-blocked for the agent). Drafting is T2, installing is T4 — the propose-don't-install line made physical by path.
3. **No lethal trifecta in one unattended run**: private data + untrusted input + outward comms are never combined.
4. **Graceful degradation, never auto-escalation.** On anomaly (unexpected paths, repeated gate hits, low confidence)
   the run downgrades to **park-and-ask**; autonomy is only ever *raised* by a human.
5. **Headless = the hook is the SOLE gate** (no human per call) ⇒ it must be airtight + exhaustively tested
   (`autonomy-gate.test.mjs`, 67 cases). Defence-in-depth is now the *runner's* job: whatever launches an unattended run
   (a scheduled cloud agent, a remote agent) should also restrict its tool allowlist and keep push credentials out of
   the run environment — the retired local orchestrator used to do this, and nothing replaces it automatically.

## What the agent MAY do unattended (the safe zone)

Read/grep/research · edit code on a dedicated non-`main` branch · add tests/docs · **local** commits · update
`docs/plans/*.md` (check off steps), `decisions.md`, `00-map.md` · delegate heavy reads to isolated subagents · run
tests / build / lint / prettier · post a status digest (once the Discord path lands). At a gate it **parks** the work,
records the intent as a step needing approval, and continues with other safe-zone work or stops.

> **How approval reaches the agent, since 2026-07-28:** it doesn't, mid-run. The signed-token Discord control plane
> (`gate-cli`/`ask-cli`, RS256 approvals synced through a private git repo) was retired with the orchestrator it served.
> A parked run now simply stops and reports; the human resolves it in a normal interactive session. If mid-run approval
> is wanted again, build it on the harness's own notification surface — not on a re-implementation of the old one.

## Enforcement & operation

- **Gate:** `.claude/hooks/autonomy-gate.mjs` (PreToolUse, matcher `Bash|Edit|Write|MultiEdit`), wired in
  `.claude/settings.json`. Test it standalone by piping a payload with `CLAUDE_AUTONOMOUS=1`.
- **Kill switch:** cancel/pause the scheduled run at its source (`/schedule` for a cloud routine; stop the remote
  agent) — there is no agent state to unwind, durable state lives in the plan file + git branch.
- **Audit trail:** every batch ends with a `/session-wrap` log + commits on the branch; the run is fully reviewable.
- **Research-before-design (anti-bias):** any new-feature / system-change design must be grounded in external prior
  art FIRST (≥2 sources + ≥2 ruled-out options) — `kind: feature` plans + the RFC-lite `templates/proposal.md`, nudged
  in-loop by `prior-art-check.mjs`. The agent **proposes, it does not self-build** — proposals queue for human approval.

> Changing THIS contract or the gate is itself a T4 governance change — it requires a human-reviewed commit. The agent
> may open a proposal; it may not self-apply.
