---
name: route-questions-via-discord-not-blocking
description: User is often away from the machine — route questions to Discord async, never block in an interactive chat; always leave readable session minutes; do not overclaim autonomy
metadata:
  type: feedback
---

When the agent needs the user's input it should ask via **Discord** (the `nuc-ops-bot` channel), NOT block waiting in an
interactive chat — the user frequently cannot sit at the machine. The user is the **supervisor of a self-running agent**,
not an operator who babysits each turn. Every session must leave a **readable record / biên bản** (`platform/log/`,
`decisions.md`, `06-knowledge-ledger.md`) the user can read later and use as evidence to know where to fix.

**Why:** the user is burning out on being present / timing session windows; the entire point of the autonomy work is to
**decouple progress from presence**. Treating Layer B (the supervised loop that runs only when manually launched) as "the
autonomous agent is done" misreads the expectation — the user expects a **self-triggering** agent that **sources its own
work** (finds gaps, proposes features) and only pings Discord when it needs a decision. Stated explicitly 2026-06-16:
"this is not yet my expectation."

**How to apply:** don't present an in-chat AskUserQuestion as the default Q&A channel for unattended work — build/use the
Discord ask-path. Don't overclaim: be explicit about what truly self-runs vs. what still needs a manual launch or a
one-time human install (the trigger/settings are governance → propose, human installs). Always run `/session-wrap` so the
minutes exist on disk. Related: [[verify-end-state-not-upload]], [[legible-proposals-plain-language]],
[[research-before-design]].
