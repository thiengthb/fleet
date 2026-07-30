---
name: skill-proposer
description: "Induce a DRAFT skill from a process the agent has repeated ≥3× and PROPOSE it for human review — never install it. Use after a session where a multi-step procedure recurred, at /session-wrap cadence, or when the user says \"should this be a skill / turn this into a skill / what skills are we missing\". Propose-don't-install: the agent NEVER writes to .claude/skills/; a human security-reviews and installs."
---

# Skill: Skill proposer (induce → propose, never install)

The self-improvement loop, made **governance-safe**. Hermes auto-creates *and auto-installs* skills (a closed loop, no
human); a skill here IS governance, so this skill captures Hermes' value — detect a repeated process, draft a skill for it,
check its own work — and **refuses Hermes' dangerous half**: it drafts into a sandbox (`platform/skill-proposals/`) and
a human reviews + installs. The agent **never** writes to `.claude/skills/` (the `autonomy-gate.mjs` backstop hard-blocks it).
Design + the why + sources (Hermes/Voyager/ADAS/Anthropic): `plans/2026-06-14-skill-proposer-induction-proposal.md`.

> Sibling of `/idea`: `/idea` proposes FEATURES into `registries/idea-queue.md`; this proposes SKILLS into `skill-proposals/`.
> Same spine (propose-don't-execute), same Reflexion oracle (the human's install/reject biases future drafts), same WIP cap.

## The one invariant

**Propose, don't install.** The agent may detect, dedup, draft, self-verify, and file a proposal **autonomously** (T2 — the
sandbox is outside the governance lock). Turning a proposal into an installed skill = a **human** moving it into
`.claude/skills/<name>/` after a security review. The agent NEVER performs that move. No closed loop, ever.

## Procedure

1. **Detect (rule of three).** Scan the recall-tier day-log (`platform/log/`) + git history for a *multi-step process
   that recurred ≥3×* (the `/code-reuse` rule-of-three, applied to procedure not code). A human-meaningful process, not
   coincidentally-similar tool calls — this is an LLM judgement grounded in the day-log "What happened", not a regex.
2. **Dedup.** Compare against the existing `.claude/skills/` (name + purpose). Overlaps an existing skill? → don't draft a
   duplicate; at most note a possible *extension* of that skill for the human. (Same anti-dup discipline as `/idea`.)
3. **Draft.** Write a `SKILL.md` using the **`/skill-authoring`** standard (do NOT re-derive it here): `description` =
   *what + when*, lean core (<~500 lines, progressive disclosure), cites which existing skills it complements. **Ground it
   in the ≥3 concrete instances** (cite them) — generalized from real recurrence, never invented.
4. **Self-verify (Voyager).** Before filing, check: does it generalize across the instances without overfitting? is the
   core lean? does the description carry what+when? what did it dedup against? Record these in the proposal frontmatter.
5. **File the proposal** into `platform/skill-proposals/<name>.md` (copy `_TEMPLATE.md`; `status: proposed`). **Stop
   there.** Tell the human it awaits their security review + install. Do not write to `.claude/skills/`.

## Guards (anti-sprawl — the platform already has 47 skills)

- **WIP cap:** at most **1–2** fresh proposals per scan. More candidates than that ⇒ propose the top 1–2, log the rest.
- **"Nothing worth proposing" is a first-class outcome** (anti-churn): if no process recurred ≥3×, or every candidate
  dups an existing skill, **say so and write nothing**. Never manufacture a filler skill to look productive.
- **Curator (lightweight):** when scanning, also flag any *existing* skill that looks unused/stale for the human to
  consider retiring (Hermes' Curator idea, human-confirmed) — keep the set lean, not just growing.
- **Diversity:** favour a skill that fills a *gap* in the current set over one near an existing cluster (ADAS archive-driven).

## When to fire

- At `/session-wrap`, as a cadence (like `/idea sort`) — "did a process recur enough to deserve a skill?"
- The user asks "should this be a skill / turn this into a skill / what skills are we missing".
- A procedure was clearly repeated this session and is worth capturing before it evaporates.

## Scope discipline

Stay the **proposer**, not the author-of-record: the *how to write a good skill* lives in `/skill-authoring` — call it,
don't copy it. And never cross the install line: drafting is yours (sandbox, T2); installing is the human's (`.claude/skills/`, T4).
If a scan finds nothing, that's success, not failure — a quiet proposer beats a noisy one.
