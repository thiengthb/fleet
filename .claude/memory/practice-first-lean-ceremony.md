---
name: practice-first-lean-ceremony
description: User wants practice-first then cheaper — match process ceremony to the change's stakes (P-tiers), build a thin working slice before governance; treats over-engineering as the enemy
metadata:
  type: feedback
---

The user explicitly ranks **practice/working-result FIRST, token-saving SECOND** — "đúng với practice luôn đặt trên
đầu tiên rồi mới đi tới sự tiết kiệm token". A cheap process that never produces a working experiment is 100% waste, not
savings. They see their own harness (built FOR token efficiency) as having drifted into over-engineering: heavy
per-session context + multi-skill ceremony per task → features delay across many sessions without shipping (auto-pilot =
the canonical example: built to completion, never run on real work).

**Why:** Ceremony applied uniformly (full idea→brainstorm→research→plan→docs spine on every task, mandatory web research
on every feature) costs more than it returns on small/reversible work. The user wants the machinery sized to the stakes,
and wants to reach a runnable end-to-end result fast.

**How to apply:** Match process weight to the change via the **P-tiers** (P1 trivial/reversible → `/coding-convention`
only, skip the spine · P2 medium → + tests · P3 large/irreversible/novel → full spine + research-before-design). See
`CLAUDE.md` §Thinking & process. **Thin-slice first:** build the smallest END-TO-END thing that runs before
governance/docs/exhaustive tests. When proposing process/infra, lead with "does this earn its ceremony?" and cut what
doesn't. Bias toward CUTTING over adding. Complements [[research-before-design]] (now P3-only), [[extend-dont-rebuild]]
(reuse not rebuild), [[direct-over-subagent-for-known-context]] (don't over-delegate). See [[user-profile]].
