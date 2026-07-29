---
name: research-before-design
description: User strictly insists on grounding any design/proposal in external research FIRST (anti-bias), before designing
metadata:
  node_type: memory
  type: feedback
  originSessionId: ce0dce5a-3949-422b-8e31-e4a49dd05d35
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
