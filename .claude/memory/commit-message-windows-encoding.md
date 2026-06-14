---
name: commit-message-windows-encoding
description: On Windows, write git commit messages via a UTF-8 file or the Bash heredoc — never pipe a PowerShell here-string to git (injects a BOM + mangles em-dashes in the subject)
metadata:
  type: feedback
---

Piping a PowerShell here-string to git for a commit message mangles the subject: it injects a UTF-16/BOM at
the start and turns `—` into `?`. Has happened **twice** — commit `c87ee3a` (PowerShell `@'...'@ | git commit -F -`)
and an earlier session (PowerShell here-string inside the Bash tool).

**Why:** the PowerShell tool emits UTF-16-with-BOM; git reads the subject bytes literally, so the BOM + bad
transcoding land in the *permanent* commit subject. Force-pushing `main` to fix a cosmetic subject isn't worth the
multi-machine history-rewrite risk, so the ugly subject ships and can't be cleanly undone.

**How to apply:** write the message to a UTF-8 file and `git commit -F msg.txt`, OR use the **Bash tool's heredoc**
(`git commit -F - <<'EOF' … EOF`) which is already UTF-8. Verify the subject after committing. Harmless guidance on
Mac/Linux (which use the Bash tool anyway). Kept in the shared tier — not strictly machine-bound, and the cost of
re-learning it (a permanent bad commit subject) outweighs tier-purity. Related: [[concise-commit-messages]].
