# Proposal — harden the enrol gate in `autonomy-gate.mjs` (defense-in-depth)

> **Status:** PROPOSED (agent-authored 2026-06-19). The agent **must not** edit `.claude/hooks/autonomy-gate.mjs` —
> it is governance (autonomy contract §3, CVE-2025-53773 lesson). **Human reviews + commits.** This file describes the
> change + the tradeoff; it is intentionally NOT a drop-in `.proposed` because the design choice is the human's to make.

## Context

Closed-loop Phase 1 / S1.3 shipped the **enrol gate**: a draft plan marked `enrol: pending` is presented to the
supervisor via Discord (`ask-cli`, options `enrol | not yet | reject`); on a signed **enrol** answer the enrol batch sets
the plan's frontmatter `status: active` + `auto_pilot: true`, which arms it for unattended advancement on the next cycle.

The authorization today is **cryptographic**: the worker only flips `auto_pilot: true` after `ask-cli check` returns a
valid RS256-signed answer for that ask (the same trust core as gate approval — a worker cannot forge it). The "only act
on a signed answer" rule is enforced at the **prompt** layer (enrol prompt, step 3 HARD RULE).

## The gap

Prompt-layer enforcement is intention, not a gate. A buggy, confused, or prompt-injected enrol worker could write
`auto_pilot: true` to a plan **without** a valid enrol answer — which is exactly the "agent self-arms its own autonomous
execution" failure the propose-don't-execute model exists to prevent. Per the CVE-2025-53773 lesson, a security-critical
action should be enforced by the gate hook, not by good intentions in a prompt.

## Proposed change

In `.claude/hooks/autonomy-gate.mjs` (PreToolUse), when `CLAUDE_AUTONOMOUS=1`, treat a write (Edit/Write) that introduces
`auto_pilot: true` into a `nuc-platform/plans/*.md` file as a **gated action**: allow it **iff** a valid, signed,
unconsumed **enrol** answer currently exists for a plan (verify via the same `gate-verify`/`ask` path the CLIs use).
Otherwise hard-block it (same as any T4). This makes "arming a plan" enforceable, not merely promised.

Sketch (the human decides the exact predicate):
- Detect the tool input mutates a plan file and the new content adds `^\s*auto_pilot:\s*true`.
- Require: a current `ASK-enrol-*` answer that verifies (public key, ask_id, exp, jti) and is not yet consumed.
- No valid enrol answer → block with a clear reason; the worker stays parked.

## Tradeoffs / options

- **Option A (recommended) — add the hook predicate.** Strongest: arming is gate-enforced, matches the contract's
  "enforce, don't trust." Cost: ~30–50 lines of hook logic + tests; the hook must read the gates clone (it already has
  the verify primitives available in `gate-verify.mjs`).
- **Option B — accept cryptographic-answer-as-enough, keep prompt enforcement only.** Cheapest, and the signed answer is
  genuinely unforgeable; the residual risk is only a *buggy* worker, not an attacker minting authority. Weaker against
  prompt-injection that makes the worker skip the check.
- **Option C — make the *write itself* go through a tiny signed CLI** (`enrol-cli apply`) that verifies the answer before
  touching the plan, and have the hook block raw `auto_pilot: true` writes entirely. Cleanest separation, but adds a new
  CLI surface.

**Recommendation: Option A (khuyến nghị)** — it closes the gap with the least new surface and reuses the existing verify
core; the enrol decision is high-blast (arms autonomy) so it deserves gate-level enforcement, not prompt-level.

## Until this lands

S1.3 is functional and safe in the common case (the signed answer is real authorization). This proposal is the
defense-in-depth hardening; the closed-loop Phase 3 (outer driver + watchdog) should not be declared "done" until the
enrol arming is gate-enforced. Tracked in `plans/2026-06-18-closed-loop-driver.md`.
