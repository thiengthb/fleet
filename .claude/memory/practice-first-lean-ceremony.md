---
name: practice-first-lean-ceremony
description: User wants practice-first then cheaper — match process ceremony to the change's stakes (P-tiers), build a thin working slice before governance, and run longer between approval gates; treats over-engineering as the enemy
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

**Gates are ceremony too — run longer between them.** Evidence (2026-07-19 optimization pass): across 5
`AskUserQuestion` checkpoints the user picked my flagged recommendation **5/5**, and twice answered a status report
with just "tiếp tục theo khuyến nghị của bạn". Reinforced again 2026-07-27 (executing three sakubun plans): **7/7**
flagged recommendations accepted across two `AskUserQuestion` calls, and **three** separate turns answered a full
status report with only "tiếp tục theo khuyến nghị" / "bạn hãy rebuild rồi tiếp tục" — spanning 5 commits, a live
schema migration and a container redeploy. Reinforced 2026-07-25 (opt-v2 execution): a **9-step** autonomous
batch (perf + dedup + dead-code + e2e, each self-gated with lint/test/build/knip + a per-step commit) ran across one
turn with the user repeatedly answering "làm theo khuyến nghị" — they are comfortable with LONG autonomous runs
*provided* I checkpoint at the genuine forks (a folder-reorg grouping, a `practice.ts` split boundary) and preview
visual deltas. The pattern that works: execute + commit-as-you-go through the reversible mechanical steps, pause only
where their decision or eye is actually needed. Stopping to confirm a _scope_ decision I've already justified with
evidence is the ceremony tax in another form. So: when a call is **reversible, local, and backed by something checkable**
(a diff, a hash, a measured LOC, a verified vendored-file comparison) → decide it, state the reasoning, and keep going;
batch several such steps before reporting. **Still gate on:** anything irreversible/outward (push, deploy, deleting
data), a **visual/design** change (they want a preview + approval — see [[preview-visual-changes-before-commit]]), or a
genuine fork where I'd need _their_ knowledge (e.g. "is this feature still in flight?"). Keep offering options when
asking (see [[ask-with-options-not-open-ended]]) — ask less often, not less clearly.

**An ACCEPTED plan is standing authorization for its phases** (2026-07-26, sakubun guide/landing plan). After approving
the plan he said **"hãy đi hết đến g giúp tôi mà không cần hỏi"** and, before that, answered five consecutive
phase-completion reports with just **"tiếp"** — never once redirecting. So once a plan file is accepted: execute
phase → gate (tsc/lint/test/build) → rebuild+verify → record in the plan → commit, then move to the next phase without
asking. Report per phase (he reads them), but a question at each boundary is the ceremony tax. Still stop for: a genuine
BLOCKER (his F1 screenshots — no browser here, and faking them with mockups would defeat the step), anything
irreversible/outward (push/deploy), and a real fork needing his knowledge. Deviating from the plan's own text is fine
when the plan is wrong — but say so out loud and record why in the plan file (e.g. dropping its 14-day "Mới" badge
because it would have marked 12 of 17 rows and meant nothing).

**How to apply:** Match process weight to the change via the **P-tiers** (P1 trivial/reversible → `/coding-convention`
only, skip the spine · P2 medium → + tests · P3 large/irreversible/novel → full spine + research-before-design). See
`CLAUDE.md` §Thinking & process. **Thin-slice first:** build the smallest END-TO-END thing that runs before
governance/docs/exhaustive tests. When proposing process/infra, lead with "does this earn its ceremony?" and cut what
doesn't. Bias toward CUTTING over adding. Complements [[research-before-design]] (now P3-only), [[extend-dont-rebuild]]
(reuse not rebuild), [[direct-over-subagent-for-known-context]] (don't over-delegate). See [[user-profile]].
