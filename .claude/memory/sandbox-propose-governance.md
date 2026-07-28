---
name: sandbox-propose-governance
description: How to change the agent's own governance — propose a tested copy in a sandbox, the human installs/commits; never edit the live gate directly
metadata:
  type: feedback
---

When a change touches the agent's OWN governance (the `autonomy-gate.mjs` hook, `.claude/settings*`, skills, the
orchestrator scripts, `CLAUDE.md`, CI, `.env`), do NOT edit the live file — even in a supervised session. Claude Code's
auto-mode classifier blocks it (self-modification), and the user explicitly CHOSE the strict "sandbox → I install" flow
over granting direct edit when offered.

**Why:** the self-modification prohibition (CVE-2025-53773 lesson) is enforced by the classifier, not just intention; and
keeping install = human-commits preserves the human-in-the-loop on the very guardrails that bound autonomy. Don't fight
the block or try to work around it (e.g. via `cp`/Bash) — that defeats its intent.

**How to apply:** build the proposed change as a full, install-ready copy in a sandbox dir (e.g.
`<project>/plans/<x>-sandbox/` mirroring the real import-path layout), TEST it there, then hand the user exact `cp` +
commit steps. App code in a *separate* repo (e.g. `nuc-ops-bot`) is NOT this repo's governance → edit it directly.
Contract: `platform/09-autonomy-contract.md`. Siblings: [[research-before-design]], [[extend-dont-rebuild]].
