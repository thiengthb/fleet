# 09 — Autonomy contract (the governance the autonomous agent runs under)

The **durable** governance reference for any unattended/headless Claude Code run on this platform. Plans come and go
(`plans/2026-06-14-autonomous-agent.md` is the build roadmap); THIS file is the permanent contract the agent and the
`autonomy-gate.mjs` hook obey. Grounded in external prior art (AWS Agentic Security Scoping Matrix; Bezos Type-1/2;
CVE-2025-53773 where a Copilot agent rewrote its own approval settings; Anthropic "measuring agent autonomy").

## The marker: when is a run "autonomous"?

A run is autonomous **iff the env var `CLAUDE_AUTONOMOUS=1`** is set (the orchestrator / `/auto-pilot` skill sets it).
Unset = interactive/supervised: a human + Claude Code's own permission prompts are the gate, and `autonomy-gate.mjs`
stands down. **Fail-closed:** in autonomous mode any gate error blocks — a halted run is safe, an ungated one is not.

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
3. **No lethal trifecta in one unattended run**: private data + untrusted input + outward comms are never combined.
4. **Graceful degradation, never auto-escalation.** On anomaly (unexpected paths, repeated gate hits, low confidence)
   the run downgrades to **park-and-ask**; autonomy is only ever *raised* by a human.
5. **Headless = the hook is the SOLE gate** (no human per call) ⇒ it must be airtight + exhaustively tested, and the
   orchestrator adds defence-in-depth (restricted `--allowedTools`, no push credentials in the run environment).

## What the agent MAY do unattended (the safe zone)

Read/grep/research · edit code on a dedicated non-`main` branch · add tests/docs · **local** commits · update
`docs/plans/*.md` (check off steps), `decisions.md`, `00-map.md` · delegate heavy reads to isolated subagents · run
tests / build / lint / prettier · post a status digest (once the Discord path lands). At a gate it **parks** the work,
records the intent as a step needing approval, and continues with other safe-zone work or stops.

## Enforcement & operation

- **Gate:** `.claude/hooks/autonomy-gate.mjs` (PreToolUse, matcher `Bash|Edit|Write|MultiEdit`), wired in
  `.claude/settings.json`. Test it standalone by piping a payload with `CLAUDE_AUTONOMOUS=1`.
- **Kill switch:** stop the orchestrator loop (it is a dumb external script, not a Claude session) — no agent state to
  unwind; durable state lives in the plan file + git branch.
- **Audit trail:** every batch ends with a `/session-wrap` log + commits on the branch; the run is fully reviewable.
- **Research-before-design (anti-bias):** any new-feature / system-change design must be grounded in external prior
  art FIRST (≥2 sources + ≥2 ruled-out options) — `kind: feature` plans + the RFC-lite `templates/proposal.md`, nudged
  in-loop by `prior-art-check.mjs`. The agent **proposes, it does not self-build** — proposals queue for human approval.

> Changing THIS contract or the gate is itself a T4 governance change — it requires a human-reviewed commit. The agent
> may open a proposal; it may not self-apply.
