# Skill proposals — the sandbox (NOT installed skills)

> **This directory holds DRAFT skills the agent proposes, never installed ones.** A drafted `SKILL.md` here is a
> *proposal awaiting a human security review* — it does **nothing** until a human reviews it and **moves** it into
> `.claude/skills/<name>/`. Produced by skill **`/skill-proposer`**; design + the why:
> `plans/2026-06-14-skill-proposer-induction-proposal.md`.

## Why a sandbox outside `.claude/`

A skill IS governance (it steers every future session). The platform's hardest invariant: **the agent never installs/edits
its own governance** (`autonomy-gate.mjs` hard-blocks any write under `.claude/skills/**`). So the agent drafts into THIS
directory — `platform/skill-proposals/`, which is **outside** the gate's `\.claude\/skills\/` lock and therefore a
normal T2 branch-local write (the same tier as `log/` and `plans/`). The human is the install gate.

This is the **propose-don't-install** line made *physical by path*: drafting = T2 (here), installing = T4 (a human moving
the file into `.claude/skills/`). Grounding: ADAS (arXiv 2408.08435) warns auto-generated artifacts need human-checked
safety; Anthropic's skill docs mandate "review skills before installation". Even Hermes gates its risky changes behind PR review.

## Lifecycle of a proposal

1. **`/skill-proposer`** detects a process repeated ≥3× (rule of three, over the recall-tier day-log + git), dedups it
   against the existing `.claude/skills/`, drafts a `SKILL.md` here grounded in the ≥3 concrete instances, and self-verifies it.
2. **The human reviews** (security audit per Anthropic: bundled scripts, dependencies, what it instructs) + edits.
3. **Install = the human moves** the draft to `.claude/skills/<name>/` and flips the proposal's `status: installed`. The
   agent NEVER performs this move (the gate would block it unattended; supervised, it's still the human's call).
4. **Reject** → `status: rejected` + a one-line reason (Reflexion signal — biases future drafts away from this shape).

## Proposal frontmatter

```yaml
proposed_name: <kebab-case skill name>
status: proposed # proposed → installed | rejected
created: YYYY-MM-DD
grounding: # the ≥3 concrete instances that justify generalizing (rule of three) — REQUIRED, not invented
  - <log/YYYY-MM-DD.md entry or git ref + one line: what recurred>
  - ...
self_verify: # Voyager-style check the drafter ran before filing
  generalizes: <yes/no — does it cover the instances without overfitting?>
  lean: <yes — SKILL.md core < ~500 lines, progressive disclosure?>
  description_what_and_when: <yes — does the description say WHAT it does AND WHEN to use it?>
  no_overlap: <which existing skills it was deduped against>
review: # filled by the human
  outcome: null # installed | rejected
  why: null
```

## Hard rules

- A proposal here is **inert** — it is not on any skill load path until installed.
- The agent **drafts** (here) and **proposes**; the human **reviews + installs** (moves to `.claude/skills/`). No closed loop.
- No proposal without the **≥3 grounding instances** (rule of three) — grounded, never invented.
- WIP cap: at most 1–2 fresh proposals per scan (anti-sprawl); dedup vs the existing skills first; "nothing worth proposing"
  is a valid outcome.
