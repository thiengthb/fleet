<!-- Copy to platform/skill-proposals/<proposed-name>.md. A DRAFT skill proposal — inert until a human installs it
     (moves it to .claude/skills/<name>/). Schema + lifecycle: README.md. The body below is the proposed SKILL.md content. -->

---
proposed_name: <kebab-case-skill-name>
status: proposed # proposed → installed | rejected
created: YYYY-MM-DD
grounding: # ≥3 concrete instances (rule of three) — REQUIRED, grounded not invented
  - <log/YYYY-MM-DD.md or git ref — what recurred>
  - <…>
  - <…>
self_verify:
  generalizes: <yes/no>
  lean: <yes — core < ~500 lines>
  description_what_and_when: <yes>
  no_overlap: <existing skills deduped against>
review:
  outcome: null # installed | rejected
  why: null
---

# Proposed skill: <name>

> Draft — not installed. On approval, the human moves the section below into `.claude/skills/<name>/SKILL.md`.

## The proposed SKILL.md

```markdown
---
name: <name>
description: <what it does AND when to use it — the Anthropic what+when rule>
---

# Skill: <title>

<the procedural knowledge generalized from the grounding instances — workflow, steps, guardrails;
 lean core, defer detail to referenced files; cite which existing skills it complements, not duplicates>
```

## Why this is worth a skill (the rule-of-three case)

- Instance 1 — …
- Instance 2 — …
- Instance 3 — …
- What context/procedure was re-provided each time (the reusable pattern).
