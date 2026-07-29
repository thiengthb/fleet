# Governance proposals — agent proposes, human applies

The agent **must not** edit live governance (`CLAUDE.md`, `platform/05-*`, `.claude/hooks/**`, `.claude/skills/**`) —
autonomy contract §3 / CVE-2025-53773. It drafts a `.proposed` drop-in here; a **human** applies it.

## Open — awaiting a human

| Proposal | Target | Status |
|----------|--------|--------|
| `2026-07-29-quarantine-promotion-gate.md` + `autonomy-gate.mjs.proposed` + `autonomy-gate.quarantine.test.mjs` | `.claude/hooks/autonomy-gate.mjs` (+ test) | ✅ **INSTALLED 2026-07-29** (verified in place: 76/76 + 26/26) — blocks quarantine→governance promotion, and closes a **pre-existing shell bypass** of the governance write-block (`cp x .claude/hooks/y.mjs` was ALLOWED). 26/26 on the proposed gate, 10/26 on the live one. Install steps in the doc. |

## Status (2026-06-19) — earlier proposals, all applied/installed

| Proposal | Target | Status |
|----------|--------|--------|
| `CLAUDE.md.proposed` (removed) | `CLAUDE.md` (Coding section) | ✅ APPLIED (PR #6) |
| `standards/documentation.md.proposed` (removed) | `standards/documentation.md` (§7.1) | ✅ APPLIED (PR #6) |
| `autonomy-gate.mjs.proposed` + `.test.mjs.proposed` (removed) | `.claude/hooks/autonomy-gate.mjs` (+ test) | ✅ INSTALLED (PR #8) — later simplified 2026-07-28, now 67/67 |
| `auto-pilot-smoke-test` (staged, removed) | `.claude/skills/auto-pilot-smoke-test/` | ⛔ RETIRED 2026-07-28 with auto-pilot |

The consumed `.proposed` drop-ins were deleted after applying; the changes live in git history (PRs #6, #8).
`2026-06-19-enrol-gate-hook-hardening.md` is **kept as the design-decision record** (Option A/B/C + why), but the
mechanism it hardened — the signed enrol gate — was **removed on 2026-07-28** with the auto-pilot orchestrator and its
Discord control plane. Read it as history, not as current behaviour.

## Why this is gated

`standards/autonomy-contract.md` blocks the agent from editing its own governance. **Agent proposes, human applies** — even in
an interactive session the auto-mode classifier enforces the `.claude/hooks|skills/**` boundary, so the final install is
a human-authorized move by design.
