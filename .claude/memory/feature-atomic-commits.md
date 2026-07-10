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

**How to apply:** When about to commit a diff spanning multiple features, offer/do the split by feature.
For tangled shared files, reconstruct each intermediate state (back up final files → revert to feature-1's
state → stage+commit → restore next feature's state → commit → restore all → commit the rest) rather than
staging hunks blindly — `git add -p` can't cleanly split a single rewritten function. Verify with
`git show --stat` per commit + a clean final `git status`. Full recipe: ledger 2026-07-10 line.
