---
title: Build — /skill-proposer (induce a skill from a repeated process, PROPOSE only; governance-safe)
kind: system-change # feature | system-change | fix | refactor | chore
status: done # draft → active → done | abandoned — all 6 steps shipped 2026-06-14 (supervised); propose-only, Phase-2 hook deferred
created: 2026-06-14
updated: 2026-06-14
related:
  [
    platform/plans/2026-06-14-skill-proposer-induction-proposal.md (accepted RFC — design + sources + the why),
    platform/registries/idea-queue.md (idea-0011 done),
    .claude/skills/skill-authoring/SKILL.md (the authoring standard this CALLS, never duplicates),
    .claude/skills/code-reuse/SKILL.md (the rule-of-three detection heuristic),
    .claude/skills/idea/SKILL.md (sibling Proposer for FEATURES — same propose-don't-execute spine),
    .claude/skills/session-wrap/SKILL.md (the cadence this hooks into),
    platform/log/README.md (recall-tier day-log = the raw material the detector mines),
    .claude/hooks/autonomy-gate.mjs (blocks .claude/skills/** → install is human-only; skill-proposals/ is T2),
    platform/standards/autonomy-contract.md (propose-don't-install — the load-bearing constraint),
  ]
---

## Goal

A skill `/skill-proposer` that turns a process repeated ≥3× into a DRAFT skill and files it into a sandbox
(`platform/skill-proposals/`) for a human to security-review + install — capturing Hermes' detect+draft value while
the agent NEVER installs its own governance. "Done" = the skill exists, the sandbox + its convention exist, the autonomy
gate provably blocks `.claude/skills/**` while allowing `skill-proposals/`, and `/session-wrap` knows to run the scan.

## Prior art & sources

Full research + the ≥2-options tradeoff live in the accepted proposal `2026-06-14-skill-proposer-induction-proposal.md`
(all sources verified 2026-06-14). Load-bearing:

- [Hermes Agent — self-evolving skills (SSOJet)](https://ssojet.com/blog/hermes-agent-self-evolving-skills) — detect on
  ≥5-tool-call task; Curator archives unused skills; even Hermes gates *risky* rewrites behind PR review. Adapt: gate EVERY install.
- [Voyager (arXiv 2305.16291)](https://arxiv.org/abs/2305.16291) — self-verify a skill before it enters the library; compositional skills.
- [ADAS (arXiv 2408.08435)](https://arxiv.org/abs/2408.08435) — archive-driven novelty; its own warning: auto-generated artifacts need human-checked safety/interpretability ⇒ the install gate.
- [Anthropic Agent Skills best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices) — when to make a skill; SKILL.md lean <500 lines, description=what+when; **review skills before installation**.

## Approach & tradeoffs

Chosen: **Option A** — a propose-only skill on the existing spine. Ruled out: **B** full Hermes closed loop (auto-install =
violates the self-modification invariant; ADAS/Anthropic both warn); **C** detection-only hook (omits the drafting the user
asked for — folded in as deferred Phase 2). Sandbox = `platform/skill-proposals/` (outside the `\.claude\/skills\/`
gate-lock ⇒ provably T2-writable), install = a human moving the SKILL.md into `.claude/skills/` (the gated, human-only step).

## Acceptance criteria (Given / When / Then)

- **AC-1** — Given a process recurred ≥3× across the day-log/git, When `/skill-proposer` runs, Then it writes exactly one
  draft `SKILL.md` into `platform/skill-proposals/`, citing the ≥3 concrete instances — and NEVER into `.claude/skills/`.
- **AC-2** — Given an unattended run (`CLAUDE_AUTONOMOUS=1`), When the agent attempts a Write/Edit under `.claude/skills/`,
  Then `autonomy-gate.mjs` blocks it (T4); a Write under `platform/skill-proposals/` is allowed (T2).
- **AC-3** — Given no process recurred ≥3× or every candidate duplicates an existing skill, When `/skill-proposer` runs,
  Then it reports "nothing worth proposing" and writes no file (anti-churn / anti-sprawl).
- **AC-4** — Given a drafted proposal, When the human approves it, Then THEY move it into `.claude/skills/<name>/` (the only
  install path) and mark the proposal installed; the agent never performs the move.

## Steps

- [x] C1 — Sandbox `platform/skill-proposals/README.md` (convention + proposal frontmatter + lifecycle: draft→human-review→install-by-move) + `_TEMPLATE.md`. Done (AC-1, AC-4 described).
- [x] C2 — Skill `.claude/skills/skill-proposer/SKILL.md`: detect (rule-of-three) → dedup → draft via `/skill-authoring` → self-verify (Voyager) → file into sandbox; propose-only invariant, WIP cap ≤1–2, "nothing worth proposing" first-class, Curator note. Done (AC-1, AC-3).
- [x] C3 — `standards/autonomy-contract §2`: documented `skill-proposals/` = T2 (draft) vs `.claude/skills/` install = human-only T4 (matches the gate's `\.claude\/skills\/` rule). Done (AC-2).
- [x] C4 — Wired `/session-wrap` Step 5.5: skill-induction scan cadence (like `/idea sort`), "nothing worth proposing" normal. Done.
- [x] C5 — `CLAUDE.md`: Proposer-for-SKILLS pointer (sibling of `/idea`, propose-don't-install). Done.
- [x] C6 — Ledger **#58** (draft-don't-install, made physical by path); plan marked `done`. Done.

## Out of scope

- The auto-detection **hook** (deferred Phase 2 — build only after the manual skill earns its keep, per the accepted proposal).
- Any auto-install / auto-use / self-patch loop (Option B — permanently rejected on governance grounds).
- A usage-telemetry Curator daemon (start with a manual "flag unused skills" pass; automate later if useful).

## Open questions / risks

- Review-burden flood → WIP cap ≤1–2 proposals/run + rule-of-three minimum + dedup (in C2).
- The detector firing on syntactic noise → detection is an LLM judgement grounded in day-log semantics, not a regex (C2).
- ~~Where do proposals live so the agent can write but not self-install?~~ Resolved: `platform/skill-proposals/` (T2), confirmed vs the gate's `\.claude\/skills\/` lock.

## Decisions to distill (at completion → ledger)

- A self-improving agent CAN draft its own skills — but the install stays a human gate; the sandbox lives OUTSIDE the
  governance-locked `.claude/` so "draft" is T2 and "install" is T4 (the propose-don't-install line, made physical by path).
- The Proposer pattern generalizes: `/idea` proposes features, `/skill-proposer` proposes skills — same spine, same oracle, same gate.
- Adapted Hermes (detect+draft+Curator) minus its dangerous half (auto-install), grounded in ADAS's own safety caveat + Anthropic's pre-install review rule.
