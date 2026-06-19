# Phase 5 governance proposals — skill-law refactor

Two files need a tiny edit each. Agent **must not** commit them (autonomy contract §3 — `CLAUDE.md` and the
docs-standard are governance). Apply manually:

## Files

- `CLAUDE.md.proposed` — replaces lines 50-59 (the "Coding" section body) of `CLAUDE.md`
- `05-documentation-standard.md.proposed` — adds a new §7.1 to `nuc-platform/05-documentation-standard.md`
  (between the existing §7 enforcement bullets and the `## 8. Quick checklist` section)

The `.proposed` files are **complete drop-in replacements** — diff them against the originals to confirm the change
is what you expect, then either copy-paste the section or replace the whole file.

## Quickest path (PowerShell, Windows)

```powershell
# Inspect the proposed change
Compare-Object (Get-Content CLAUDE.md) (Get-Content nuc-platform/proposals/CLAUDE.md.proposed)
Compare-Object (Get-Content nuc-platform/05-documentation-standard.md) (Get-Content nuc-platform/proposals/05-documentation-standard.md.proposed)

# Accept (overwrite the originals with the proposals)
Copy-Item nuc-platform/proposals/CLAUDE.md.proposed CLAUDE.md -Force
Copy-Item nuc-platform/proposals/05-documentation-standard.md.proposed nuc-platform/05-documentation-standard.md -Force

# Commit
git add CLAUDE.md nuc-platform/05-documentation-standard.md
git commit -m "docs(skills): codify SKILL=procedure / references=LAW pattern"

# Clean up the proposals dir (optional)
Remove-Item nuc-platform/proposals -Recurse -Force
```

## Alternative — `git diff` to review byte-by-byte

```powershell
git diff --no-index CLAUDE.md nuc-platform/proposals/CLAUDE.md.proposed
git diff --no-index nuc-platform/05-documentation-standard.md nuc-platform/proposals/05-documentation-standard.md.proposed
```

## Why this is gated

The `09-autonomy-contract.md` blocks the agent from editing its own governance (CVE-2025-53773 lesson).
That class includes `CLAUDE.md` and `nuc-platform/05-*`. **Agent proposes, human commits.**

## Reverting

If you decide not to apply, just delete the `.proposed` files:

```powershell
Remove-Item nuc-platform/proposals -Recurse -Force
```

The branch `auto/skill-law-refactor` already has the safe-zone work committed (`d0ec36d`); it is independent of
this Phase 5 step.
