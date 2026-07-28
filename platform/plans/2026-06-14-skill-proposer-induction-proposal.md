---
title: Skill proposer — induce a skill from a repeated process, then PROPOSE it (Hermes-style, governance-safe)
kind: system-change # feature | system-change — both REQUIRE prior-art before acceptance
status: accepted # accepted 2026-06-14 — Option A (separate skill, full A, Phase-2 hook deferred)
created: 2026-06-14
updated: 2026-06-14
related:
  [
    platform/registries/idea-queue.md (idea-0011 — the candidate this analyzes),
    .claude/skills/skill-authoring/SKILL.md (the HOW-to-write-a-skill standard this CALLS, does not duplicate),
    .claude/skills/code-reuse/SKILL.md (the "rule of three" detection heuristic this reuses),
    .claude/skills/idea/SKILL.md (the sibling Proposer for FEATURES; this is the Proposer for SKILLS),
    .claude/skills/session-wrap/SKILL.md (the cadence this hooks into),
    platform/log/README.md (the recall-tier day-log = the raw material the detector mines),
    platform/standards/autonomy-contract.md (governance: agent proposes, human installs — the load-bearing constraint),
    .claude/hooks/autonomy-gate.mjs (already blocks writes to .claude/skills/** — the backstop),
    .claude/memory/sandbox-propose-governance.md (never edit live governance; propose a tested copy),
    platform/registries/skill-candidates.md (external community-skill verdicts — the internal sibling queue),
  ]
---

<!--
  RESEARCH-GROUNDED proposal (research-before-design / anti-bias). Produced by `/idea analyze` on idea-0011.
  Propose-don't-execute: queued for the HUMAN-ACCEPT gate (/idea → /project-plan). The agent does NOT self-accept;
  status stays `draft` until the supervisor records `outcome: accept`. Sources verified 2026-06-14.
  THIS IS A GOVERNANCE-TOUCHING PROPOSAL: the feature literally manufactures governance artifacts (skills), so the
  safety design (propose-only, never auto-install) is the load-bearing part, not an afterthought.
-->

## Problem

The supervisor wants the platform to **get smarter by itself** — when a multi-step process recurs, the agent should turn
it into a reusable skill (à la Hermes), growing a *diverse* skill set instead of re-deriving the same procedure every
session. Today that loop is fully manual: `/skill-authoring` tells a *human-directed* session how to write one skill, but
**nothing detects that a process has recurred and is worth proceduralizing**, and nothing drafts the skill. So procedural
knowledge that repeats across sessions evaporates unless the operator notices and acts.

**The hard constraint that shapes everything:** a skill IS a governance artifact (`.claude/skills/**` is governance-locked;
`autonomy-gate.mjs` blocks writes to it; `standards/autonomy-contract.md` + memory `sandbox-propose-governance` forbid the agent
editing its own governance). So "an agent that writes its own skills" is, unguarded, the **CVE-2025-53773 risk class** —
self-modifying governance. Hermes does exactly this *with no human gate for ordinary skills* (see Prior art); we must not.
The design problem is therefore: **capture Hermes' value (auto-detect + auto-draft + a compounding, diverse skill set)
while replacing its auto-install with the platform's non-negotiable human-install gate.**

## Prior art & sources — REQUIRED: ≥2 external URLs (research BEFORE designing; all VERIFIED 2026-06-14)

- [Hermes Agent — *8 Self-Evolving Skills Hermes Writes on Its Own* (SSOJet)](https://ssojet.com/blog/hermes-agent-self-evolving-skills)
  + [Hermes Agent (Nous Research) overview](https://hermes-agent.org/) (verified by fetch). **Reuse:** the **detect-from-
  repetition** trigger (Hermes drafts a `SKILL.md` after a *complex task ≥5 tool calls*, after error-recovery, or after a
  user correction) and the **"Curator"** — a background grader that archives **unused** skills (30d stale → 90d archived)
  = a ready-made **anti-sprawl** mechanism. Note Hermes' OWN split: ordinary skill creation is autonomous, but its
  **GEPA** self-evolution gates *riskier rewrites behind PR review* — i.e. even Hermes puts a human gate on the dangerous
  path. **Avoid:** Hermes' autonomous *create + install + use + self-patch* loop with no human for ordinary skills — that
  is precisely the governance line our platform draws differently (we gate **every** install, because skills are governance
  and the operator is solo-now).
- [Wang et al. 2023, *Voyager: An Open-Ended Embodied Agent with LLMs*, arXiv 2305.16291](https://arxiv.org/abs/2305.16291)
  (NVIDIA/Caltech). **Reuse:** the **ever-growing skill library** of executable, *compositional, interpretable* skills +
  the **self-verification** step before a skill enters the library (the agent checks the skill works before keeping it) +
  "compounds abilities, alleviates catastrophic forgetting". Maps to: a self-critique gate on the draft + skills that build
  on skills. **Avoid:** Voyager runs fully autonomously in a *game sandbox* where a bad skill is harmless; our skills steer
  a real operator's platform — the human gate replaces the harmless sandbox.
- [Hu, Lu, Clune 2024, *Automated Design of Agentic Systems*, arXiv 2408.08435 (ICLR 2025)](https://arxiv.org/abs/2408.08435).
  **Reuse:** the **archive-driven** generation — a meta-agent proposes new designs from an *ever-growing archive of prior
  discoveries*, which is how to keep proposals **diverse** (build from what exists, target gaps). **Avoid / load-bearing
  caveat:** the paper *itself* warns that "significant challenges remain in ensuring the **safety and interpretability** of
  automatically generated agents" and that this "should be developed safely." This is the external grounding for the
  human-install gate — auto-generated governance must be human-interpretable and human-approved, full stop.
- [Anthropic, *Equipping agents for the real world with Agent Skills* (engineering)](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)
  + [Skill authoring best practices (Claude docs)](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
  (verified by fetch). **Reuse:** *when* to make a skill (run on real tasks, find the **gap**, notice the context you
  **repeatedly** provide — the same "rule of three" instinct), the SKILL.md standard (lean core <500 lines, progressive
  disclosure, `description` = **what + when**), and — decisively — **"thoroughly review skills before installation,
  particularly code dependencies and bundled resources"**: an explicit *security audit before install*. **Avoid:** the
  docs don't address skill-proliferation governance — so we must add the WIP cap + dedup + Curator ourselves.
- **Internal prior art (extend-don't-rebuild):** `/code-reuse`'s **rule of three** (1×build, 2×log, 3×extract) is the exact
  detection heuristic; `/skill-authoring` already owns the authoring standard (this skill *calls* it, never duplicates it);
  `/idea`'s propose-gate + Reflexion oracle + exploration-floor are the governance machinery to reuse wholesale; the new
  **recall-tier day-log** (`platform/log/`, shipped Phase 3) is the queryable record of "what happened repeatedly" the
  detector mines.

## Options considered — REQUIRED: ≥2, with tradeoffs

Mark the recommended option with **`(khuyến nghị)`** right in the table.

| Option | How it works | Benefit | Drawback / cost |
| --- | --- | --- | --- |
| **A — `/skill-proposer` skill: detect (rule-of-three over the day-log + git) → draft via `/skill-authoring` → self-verify → PROPOSE into a sandbox queue for human install. Never auto-installs.** *(khuyến nghị)* | A skill (the judgement-heavy part) that, at `/session-wrap` cadence: (1) **detects** a process repeated ≥3× across the recall-tier day-log + git history (rule of three); (2) **dedups** vs the 47 existing skills; (3) **drafts** a `SKILL.md` using the `/skill-authoring` standard, grounded by citing the ≥3 concrete instances it generalizes from; (4) **self-verifies** (Voyager: does it generalize? lean core? `description`=what+when?); (5) files it as a **proposal** in `.claude/skills-proposed/` (or a queue block) — the human runs a security review and *installs* (moves it to `.claude/skills/`). A lightweight **Curator** pass flags skills unused for N sessions. Hook for *automatic* detection is **deferred** (Phase 2) until the skill proves its keep. | Captures Hermes' value (auto-draft from repetition + compounding, diverse skill set) with **zero governance risk**: the agent literally cannot install — `autonomy-gate.mjs` already blocks `.claude/skills/**`; the proposal lands in a sandbox. Reuses 4 existing assets (rule-of-three, skill-authoring, idea propose-gate, day-log). Diversity + anti-sprawl built in (dedup + WIP cap + Curator). Agent-native and on-brand (extend-don't-rebuild). | A new proposer surface to keep coherent with `/idea`; review burden on the operator (mitigated by the WIP cap); the detector's "is this a *meaningful* repeated process?" judgement is non-trivial (kept in the LLM skill, not a dumb hook). |
| **B — Full Hermes-style closed loop: auto-detect → auto-draft → AUTO-INSTALL → auto-use → self-patch, no human gate** | Replicate Hermes literally inside the platform: the agent creates, installs, uses, and patches its own skills autonomously; a Curator prunes. | Maximal "intelligence"/autonomy; the longer it runs the smarter it gets, hands-off; exactly what was literally asked. | **Violates the platform's hardest invariant** (agent never installs/edits its own governance) — the CVE-2025-53773 self-modification risk; ADAS *itself* warns auto-generated artifacts lack safety/interpretability guarantees; Anthropic says audit skills *before* install. A bad/poisoned/over-broad auto-installed skill silently steers every future session. **Rejected on safety** — presented for honesty because it is what the request literally describes. |
| **C — Detection-only hook (no drafting): a `Stop`/session-end hook counts repeated procedures and nudges the human to write the skill manually via `/skill-authoring`** | A deterministic hook tallies recurring tool-call/process signatures and prints "this looks repeated — consider a skill". The human does all authoring. | Lightest + safest; pure signal; no governance surface at all; cheap to build. | Low "intelligence" — no auto-draft (the part the user asked for); a hook can't *judge* whether a repetition is a meaningful, generalizable process (semantic, not syntactic); risks noisy nudges. Is really just Phase-1 of A. |

## Recommendation

**Adopt Option A** *(khuyến nghị)*.

In plain terms: **build the half of Hermes that's safe — the agent watches for a process it has now done three times,
writes a draft skill for it, checks its own work, and hands you a finished draft to review and install — and refuse the
half that's dangerous: it never installs the skill itself.** That single line (propose, don't install) is what turns
"an agent that rewrites its own governance" (forbidden) into "an agent that drafts proposals for a human to approve"
(the platform's whole operating model). You still get the compounding, diverse skill set; the operator stays the gate.

- **Why not B:** it is the exact thing the platform's governance exists to prevent — the agent installing its own
  governance. ADAS's own authors flag the safety/interpretability gap; Anthropic says review skills *before* install;
  even Hermes gates its *risky* rewrites behind PR review. We adopt B's ambition and A's gate.
- **Why not C alone:** it omits the drafting — the actual intelligence the request asks for — and a dumb hook can't tell a
  meaningful repeated *process* from coincidentally similar tool calls. But C is a sound **Phase 2** of A (automate the
  detection signal once the skill has earned trust), so it's folded in as deferred, not discarded.
- **Diversity (the explicit ask "bộ skill đa dạng"):** reuse `/idea`'s exploration-floor instinct — the proposer favours
  skills that fill a *gap* in the current 47 (archive-driven, ADAS), dedups against them, and is capped so it can't flood
  you. "Nothing worth proposing" is a first-class outcome (anti-churn), exactly as in `/idea`.
- **Form factor (skill vs rule vs hook — the user offered all three):** **skill-first** (judgement lives in the LLM), a
  **thin rule pointer** in `CLAUDE.md`, and the **hook deferred** to Phase 2. Not all three at once.
- **Relationship to `/idea`:** this is the **Proposer for SKILLS**, the sibling of `/idea` (Proposer for FEATURES) — same
  propose-don't-execute spine, same Reflexion oracle (your accept/reject of a drafted skill biases future drafts). Surface
  for the supervisor: keep it a **separate skill** (skills have a higher, security-audit bar than feature ideas) vs. fold
  it as an `/idea` mode — recommend separate.

## Pre-mortem — REQUIRED: ≥2 failure modes

- **Skill sprawl / review-burden flood** (the platform already has 47 skills). Mitigation: a **WIP cap** (≤1–2 proposals
  per `/session-wrap`), a **rule-of-three minimum** (no proposal until a process recurs ≥3×), **dedup** vs existing skills,
  and a **Curator** pass that flags unused skills for retirement (Hermes' telemetry idea, human-confirmed).
- **Auto-drafted skills are generic / low-quality / hallucinated.** Mitigation: the draft MUST cite the **≥3 concrete
  instances** (day-log/git refs) it generalizes from — grounded, not invented; a **self-verify** gate against the
  `/skill-authoring` standard; and the **human security review before install** (Anthropic's rule) is the final filter.
- **Governance creep — the proposer is gamed to draft a skill that weakens governance.** Mitigation: the proposer **cannot
  write to `.claude/skills/**`** (autonomy-gate blocks it); proposals land in a sandbox; the human installs after review.
  The proposer is itself a skill and so is equally locked. No closed loop, ever.
- **The detector fires on syntactic noise, not meaningful processes.** Mitigation: detection is an LLM judgement in the
  skill (grounded in day-log "What happened" semantics), not a regex hook; require a human-meaningful, named process.
- **Echo chamber — only proposes skills like past accepts.** Mitigation: reuse the exploration-floor (favour gap-filling /
  orthogonal skills), archive-driven (ADAS), recency-decayed Reflexion.

## Counter-case

Maybe the bottleneck isn't skill *scarcity* but skill *sprawl*: 47 skills already exist, and a machine that proposes more —
each needing a careful security review — could *cost* the solo operator more attention than it saves, becoming a draft
graveyard. The genuinely cheapest version may be a **one-line `/session-wrap` nudge** ("this process recurred — want a
skill?") with the human authoring on demand (≈ Option C, no new machinery) — and only build A's auto-drafting if that nudge
repeatedly fires and the manual authoring is the real friction. The supervisor should weigh whether to start at the nudge
and earn the way up to A, rather than build A's full proposer now.

## Decision (human) — the human-accept gate

> **This is the human-accept gate of `/idea` → `/project-plan` (propose-don't-execute).** The agent has stopped here and
> does NOT self-accept — doubly so, since this feature manufactures governance artifacts. Your call:
> - **accept** (which option) → graduates to a `/project-plan` build roadmap; idea-0011 → `done`. (If A: confirm separate
>   skill vs `/idea` mode, and whether to start at the Phase-1 nudge or build the full proposer.)
> - **reject** (reason) → idea-0011 → `dead`/`deferred`; the *why* becomes Reflexion signal.
> - **defer** (until a trigger) → idea-0011 → `deferred` with `revisit_when`.

**ACCEPTED 2026-06-14 — Option A** *(khuyến nghị)*, explicitly ("phần idea 11 là phải theo A"). **Separate skill**
(`/skill-proposer`), full Option A with the auto-detection **hook deferred to Phase 2**. Graduates → build plan
`plans/2026-06-14-skill-proposer-build.md`. *Reflexion bias:* supervisor wants self-improvement (the Hermes value) but
strictly under the propose-don't-install governance gate — never the closed auto-install loop (B).
