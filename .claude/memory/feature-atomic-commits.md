---
name: feature-atomic-commits
description: "Prefers separate feature-atomic commits even when features are tangled across shared files"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 756796f7-ca12-4547-8832-29cce28aebbf
---

When one working tree holds several features whose edits are interleaved across the same files, the user
prefers splitting into **feature-atomic commits** (one commit per feature) over a single lump commit —
even though separating tangled shared-file edits costs extra work. Asked for it explicitly:
"hãy commit thành 3 commit tách bạch."

**Why:** The user values a reviewable, bisectable git history where each commit is one coherent feature.
This complements [[concise-commit-messages]] (each subject still short) — it's about commit *boundaries*,
not message length.

**How to apply:** BEST — **commit each feature AS you finish it** (build → gate → commit) so the tangle
never forms; this is the real fix and avoids the reconstruction entirely. Only when a multi-feature batch
has ALREADY piled up: reconstruct each intermediate state (back up final files → revert to feature-1's
state → stage+commit → restore next feature's state → commit → restore all → commit the rest) rather than
staging hunks blindly — `git add -p` isn't available interactively here and can't split a single rewritten
function. Verify with a per-commit leak-grep + a clean final `git status`.

**Cost lesson (2026-07-11):** at 5 features across 12 shared files (some edited on the SAME line — e.g. a
catalog summary), reconstruction took ~40 fragile edits — disproportionate. That's what makes commit-as-
you-go the default, not the fallback. Also: do NOT use `--no-verify` (let the commit-msg/pre-commit hooks
run; hooks here only warn, never block). Keep commit subjects ≤72 chars. Recipe detail: ledger #92 + #(commit-as-you-go), 2026-07-10/11.
