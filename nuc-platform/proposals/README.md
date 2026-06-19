# Governance proposals — agent proposes, human applies

The agent **must not** edit live governance (`CLAUDE.md`, `nuc-platform/05-*`, `.claude/hooks/**`, `.claude/skills/**`) —
autonomy contract §3 / CVE-2025-53773. It drafts a `.proposed` drop-in here; a **human** applies it.

## Status (2026-06-19) — all current proposals applied/installed

| Proposal | Target | Status |
|----------|--------|--------|
| `CLAUDE.md.proposed` (removed) | `CLAUDE.md` (Coding section) | ✅ APPLIED (PR #6) |
| `05-documentation-standard.md.proposed` (removed) | `05-documentation-standard.md` (§7.1) | ✅ APPLIED (PR #6) |
| `autonomy-gate.mjs.proposed` + `.test.mjs.proposed` (removed) | `.claude/hooks/autonomy-gate.mjs` (+ test) | ✅ INSTALLED (PR #8) — 34/34 |
| `auto-pilot-smoke-test` (staged, removed) | `.claude/skills/auto-pilot-smoke-test/` | ✅ INSTALLED (PR #8) |

The consumed `.proposed` drop-ins were deleted after applying; the changes live in git history (PRs #6, #8).
`2026-06-19-enrol-gate-hook-hardening.md` is **kept as the design-decision record** (Option A/B/C + why) — distil it
into `06-knowledge-ledger.md` / `decisions.md` at the next `/session-wrap`.

## Why this is gated

`09-autonomy-contract.md` blocks the agent from editing its own governance. **Agent proposes, human applies** — even in
an interactive session the auto-mode classifier enforces the `.claude/hooks|skills/**` boundary, so the final install is
a human-authorized move by design.
