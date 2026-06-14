---
name: concise-commit-messages
description: "Prefers short, concise commit messages"
metadata:
  node_type: memory
  type: feedback
  originSessionId: ce0dce5a-3949-422b-8e31-e4a49dd05d35
---

The user prefers commit messages kept short and concise — a tight Conventional Commits subject line, minimal
or no body. Don't pad with long explanatory bodies, bullet lists of every change, or restated context.

**Why:** Stated directly by the user. The "why" of a change already lives in `docs/decisions.md` / the
knowledge ledger, so the commit message doesn't need to carry it.

**How to apply:** Write `type(scope): short lowercase summary` and stop there unless a body is genuinely
needed (e.g. a breaking change or a non-obvious caveat). Still follow `/coding-convention` (Conventional
Commits, English, lowercase description).
