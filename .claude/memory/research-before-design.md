---
name: research-before-design
description: User strictly insists on grounding any design/proposal in external research FIRST (anti-bias), before designing
metadata:
  node_type: memory
  type: feedback
  originSessionId: ce0dce5a-3949-422b-8e31-e4a49dd05d35
  modified: 2026-07-29T22:40:11.074Z
---

The user has a strict ("khắc nghiệt") rule: research external prior art thoroughly (web, GitHub repos, established
practice) and use it as reference BEFORE starting to design — to avoid bias / "tự biên tự diễn" (making it up from
one's own opinion). Applies especially to important / system-changing features.

**Why:** Designing from one's own opinion bakes in bias; pure self-assessment is empirically unreliable (a critic
primed to judge invents flaws / hallucinates gaps). The user wants designs grounded in what already exists and works.
This is now also a platform rule (research-before-design gate + `plan-audit.mjs --hook` + RFC-lite proposal template).

**How to apply:** This is the rule for **P3 changes** (architecture / new dependency / security / schema / topology) and
for autonomous proposals — NOT a tax on every task. P1 (trivial/reversible) and P2 (medium) skip external research unless
a real unknown is hit (then a token-disciplined Quick lookup, not a fan-out). See the P-tier table in `CLAUDE.md` §Thinking
& process and the research tiers in §Model routing. When it DOES apply: run REAL external research first (tiered, capped),
cite ≥2 sources + ≥2 ruled-out options with tradeoffs, THEN recommend — lead with prior art, not opinion. This is the
*external-research* half; [[extend-dont-rebuild]] is the *internal-reuse* half (check what the platform already has). See
[[user-profile]].

**2026-07-30 — broadened from "before DESIGNING" to "before WRITING", and the user said why.** Their words: when
asked to build something, *"điều bạn nghĩ đầu tiên không phải là code làm sao để hoàn thành giúp tôi"* — the first
thought should be whether it already exists out there (GitHub, Reddit, personal blogs, big-company open source), whether
it is good enough, then bring the good parts back and improve the rest; **only then** write original code. They added a
reason that matters more than the rule: *"nhiều khi tầm nhìn tôi hạn hẹp không biết mình muốn gì"* — an outside source
may exceed what they were able to ask for, **and surfacing that is encouraged, not scope creep**. So bringing back
something they did not request, with a verdict attached, is doing the job; silently building exactly the spec is the
failure. Pairs with [[originate-and-challenge-my-premises]].

**But NOT as an unconditional search-first tax — they rejected that themselves in the same breath.** They named
pre-building patterns for software they might never write as *"FOMO tốn tài nguyên"*, and the evidence agreed: `commons`
holds 27 proven items with **0 installs into any app** so far. So the shape they actually want is **pull, not push**:
1. **Probe the tools already installed BEFORE searching prose** — the cheapest and most likely-usable source. Measured
   2026-07-30: 8 `shadcn search` calls found ~3,400 external items already reachable with zero config and replaced a
   whole vendoring pipeline. This is now a ledger lesson.
2. Web search only when the probe is inconclusive **and** the work is P2+; keep the P-tier budget above.
3. What gets recorded is a **verdict row** (cheap, and refusals with reasons count); what gets built or vendored is
   expensive and waits for a real project to need it. Verdict log: `commons/docs/external-patterns.md`.
4. Say the refusals out loud. Of 8 candidate registries exactly 1 fit, and naming why the other 7 did not was the part
   they got value from.
