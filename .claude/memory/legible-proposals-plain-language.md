---
name: legible-proposals-plain-language
description: When proposing/deciding, flag the recommended option explicitly, name the skill/process behind any approve gate, and explain in plain everyday language
metadata:
  type: feedback
---

When I surface a decision to the user, three things are mandatory:

1. **Flag the recommendation explicitly.** On every option list (in chat AND in proposal docs), mark the one I
   recommend with `(khuyến nghị)` / `(recommended)` so the user instantly sees my pick — don't make them infer it
   from prose.
2. **Name the skill and the process behind any approve/accept gate.** When I ask the user to approve/accept
   something, state which skill it belongs to and which step of which workflow it is — e.g. "đây là bước *human-accept*
   của quy trình propose-don't-execute (`/idea` → proposal → `/project-plan`)". The user must know what gate they're
   standing at and what their yes/no does next.
3. **Explain in plain, everyday language.** My chat explanations have been too technical — the user couldn't follow
   the flow. Lead with the plain-language "what this means / what happens next", keep jargon (RICE, MemGPT, T1–T4) as
   a labelled aside, not the main thread.

**Why:** the user is the supervisor/oracle in propose-don't-execute. If they can't tell what I recommend, which gate
they're at, or what the flow is in plain terms, they can't actually supervise — the governance is theatre. Legibility
of the decision surface IS the control surface.

**How to apply:** every proposal/option block → `(khuyến nghị)` on my pick + one plain-language sentence on why; every
"bạn duyệt nhé?" → name the skill + the workflow step it gates; explain flow conversationally first, technical terms
second. Relates to [[research-before-design]] (the proposal must be grounded) and [[sandbox-propose-governance]] (human
installs; so the human must understand). See also [[user-profile]] — values honest pushback + system-level clarity.
