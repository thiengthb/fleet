# Governance proposals — agent proposes, human applies

The agent **must not** edit live governance (`CLAUDE.md`, `nuc-platform/05-*`, `.claude/hooks/**`, `.claude/skills/**`) —
autonomy contract §3 / CVE-2025-53773. It drafts a `.proposed` drop-in here; a **human** copies it over the real file.

## Status (2026-06-19)

| Proposal | Target | Status |
|----------|--------|--------|
| `CLAUDE.md.proposed` | `CLAUDE.md` (Coding section) | ✅ APPLIED (interactive, supervisor-approved) |
| `05-documentation-standard.md.proposed` | `nuc-platform/05-documentation-standard.md` (§7.1) | ✅ APPLIED |
| `autonomy-gate.mjs.proposed` + `.test.mjs.proposed` | `.claude/hooks/autonomy-gate.mjs` (+ test) | ⏳ AWAITS HUMAN INSTALL — verified 34/34 |
| `2026-06-19-enrol-gate-hook-hardening.md` | (design record for the two `.proposed` above) | Option A chosen + implemented |

> The two doc `.proposed` files are kept after applying only as a diff record; they may be deleted.

## Apply the enrol-gate hardening (human)

```bash
cp nuc-platform/proposals/autonomy-gate.mjs.proposed      .claude/hooks/autonomy-gate.mjs
cp nuc-platform/proposals/autonomy-gate.test.mjs.proposed .claude/hooks/autonomy-gate.test.mjs
node .claude/hooks/autonomy-gate.test.mjs   # expect: 34/34 PASS
```

## Why this is gated

`09-autonomy-contract.md` blocks the agent from editing its own governance. **Agent proposes, human commits** — even in
an interactive session the auto-mode classifier enforces the `.claude/hooks|skills/**` boundary, so the final `cp` is a
human move by design.
