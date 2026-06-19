<!-- Proposal: an EXTENSION (one-edit hardening) of the EXISTING /auto-pilot skill — NOT a new standalone skill.
     Inert until a human applies the edit to .claude/skills/auto-pilot/SKILL.md. Schema/lifecycle: README.md. -->

---
proposed_name: auto-pilot-trust-gate-cli # EXTENSION of existing /auto-pilot (Step 1.5), not a new skill dir
status: proposed # proposed → installed | rejected
created: 2026-06-16
kind: skill-extension # vs a new skill — install = a small edit to an existing SKILL.md, not a dir move
target_skill: .claude/skills/auto-pilot/SKILL.md # Step 1.5
grounding: # rule of three — the SAME pattern (worker over-thinks deterministic tool output) recurred ≥3×
  - log/2026-06-16.md (2026-06-16-01) — B5 batch-2: a fresh Sonnet worker got a valid `approve` from `gate-cli check`, then hand-re-verified by listing the WRONG relative path (`agent-gates/gates/`), overrode the result to `none`, and parked an APPROVED gate.
  - log/2026-06-15.md (2026-06-15-02, finding #4) — B4b.3: the Sonnet worker mis-diagnosed permissions (claimed writes "need approval" without retrying after the allowlist fix) and re-marked an already-handled `(GATE)` line instead of trusting the recorded state.
  - plans/2026-06-14-autonomous-agent.md (finding #4, B4b.3 + B5) — documented as the standing "worker reliability" risk: the security HOOK always held; the residual weak link is the worker's judgment over-riding deterministic machine output.
self_verify:
  generalizes: yes # the pattern (don't re-derive what a verified CLI already decided) generalizes beyond just gate-cli
  lean: yes # a ~6-line guard added to one existing step; no new skill
  description_what_and_when: n/a # extension — the host skill already carries what+when
  no_overlap: extends /auto-pilot Step 1.5; does NOT duplicate it or any other skill (deduped against the full set)
review:
  outcome: installed # installed 2026-06-18 (interactive, supervisor-approved) as part of closed-loop-driver Phase 0 S0.2
  why: B5 finding #4 fix — the Step 1.5 guard ("trust gate-cli verbatim, never hand-re-verify") was applied to .claude/skills/auto-pilot/SKILL.md; the Opus-for-gate-cross companion note recorded under the plan.
---

# Proposed extension: `/auto-pilot` Step 1.5 — TRUST `gate-cli check`, never hand-re-verify

> Draft — not installed. `/auto-pilot` SKILL.md is **governance**; the agent does not self-edit it. On approval, the
> human applies the small edit below to `.claude/skills/auto-pilot/SKILL.md` Step 1.5.

## The problem this closes (B5 finding #4)

`gate-cli check` already does the hard, security-critical work: it verifies the RS256 signature, the `gate_id` match, the
expiry, and the single-use `jti` against the **pinned** public key, then prints exactly one word (`approve`/`deny`/`none`).
The Sonnet worker, not trusting that, "double-checks" by hand — and gets it **wrong** (lists `agent-gates/gates/` relative
to the repo instead of `~/.claude/agent-gates/`, sees nothing, concludes `none`), then strands a legitimately-approved
gate. The fix is **not more checks** — it is to forbid the redundant hand-check and act on the CLI's word.

## The proposed edit (Step 1.5)

**Add this guard sentence right after the `node .claude/scripts/gate-cli.mjs check` line** (before the `approve`/`deny`/
`none` bullets):

```markdown
**Trust this one word verbatim — it IS the authoritative decision.** `gate-cli` has already verified the signature,
`gate_id`, expiry, and single-use `jti` against the pinned public key, and the orchestrator pulled the latest approvals
before this batch. Do **NOT** "double-check" by listing `~/.claude/agent-gates/` or reading the gates/state files by hand
— a hand-check (especially from the wrong relative path) returns a false `none` and strands an approved gate (B5 finding
#4, 2026-06-16). Act on the printed word; if it errors/absent, treat as `none` (Step 1.5's existing fail-safe).
```

**And tighten the `approve` bullet's opening** to be imperative:

- before: ``**`approve`** — the supervisor approved (from Discord) the exact gate you parked at last time. You are cleared to cross **only that gate now**: …``
- after: ``**`approve`** — cross **immediately and only that gate** (do not re-confirm): `git push <remote> auto/<branch>` then `gh pr create`. …`` (rest unchanged)

## Optional companion note (R3 — model routing)

If a Sonnet crossing-worker still mis-handles the cross after this guard, the orchestrator may run **the single crossing
batch on Opus** (`-Model opus` for that one re-run) — the safe steps stay on Sonnet. Record under plan R3. (Not part of
the SKILL edit; an operator option.)

## Install (human — the propose/install line)

1. Review the edit above against the live `.claude/skills/auto-pilot/SKILL.md` Step 1.5.
2. Apply it (insert the guard sentence + tighten the `approve` bullet). Keep the rest of Step 1.5 unchanged.
3. Optional: re-run a B5-style throwaway loop to confirm a fresh Sonnet worker now crosses on the first approved batch.
4. Set this file's `review.outcome: installed` (+ `why`) — the Reflexion oracle for future proposals.
