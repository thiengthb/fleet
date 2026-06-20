---
name: direct-over-subagent-for-known-context
description: For internal investigation I already hold context for, work directly (targeted Read/Grep/Bash) — don't fan-out subagents
metadata:
  type: feedback
---

When investigating something INSIDE the system I already have context for (this repo, its docs, a thread already in
context), do it DIRECTLY with targeted Read/Grep/Bash — do NOT spawn subagents to "research" it.

**Why:** 2026-06-20, asked to re-examine token usage, I reflexively fanned out 2 Sonnet subagents (diagnose auto-pilot +
audit token footprint); both hit the session limit and returned **0 tokens of usable output** — pure waste, and ironic
given the task was token efficiency. The fan-out added overhead + a failure mode (session-limit, classifier-unavailable)
with no payoff, because I already held most of the context. Then doing it directly (one `wc -c`, two targeted Reads)
produced the whole diagnosis cheaply.

**How to apply:** Default to direct work for any internal investigation I can scope myself (a known file set, the repo's
own docs, a thread in context). One cheap `Bash` (`wc`/`grep`) often replaces an entire subagent. Reserve subagents for
genuinely WIDE + UNKNOWN + ISOLATABLE reads (broad grep across files I haven't mapped, bulk transforms) per the
`CLAUDE.md` §Model routing "real token lever" — this is its caveat: **don't delegate what you already hold.** Pairs with
[[verify-end-state-not-upload]] (don't claim a subagent "did it" when it returned nothing). See [[user-profile]].
