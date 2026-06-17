---
name: ask-with-options-not-open-ended
description: When asking the user a question, present a list of concrete options + a free-input fallback — don't ask open-ended
metadata:
  type: feedback
---

When I ask the user to decide something, I should **present a concrete list of options** (the candidate answers) plus a
**"other / free input" option** — not an open-ended question. The user asked for this explicitly (2026-06-17): *"khi hỏi
tôi, bạn hãy đưa ra các danh sách option, giúp tiện dụng hơn, cho tôi nắm được có những phương án nào, nếu có phương án
khác thì thêm một option tự nhập."*

**Why:** options are faster (one click/tap, no typing), and they let the user *see what the choices are* — surfacing
the decision space they might not have known. This matches the legible-decision-surface rule ([[legible-proposals-plain-language]]):
mark the recommended option, explain each plainly. The free-input fallback keeps it from being a forced choice.

**How to apply:**
- In chat → use `AskUserQuestion` with explicit options (recommended one first, marked `(khuyến nghị)`); "Other" is
  auto-provided.
- Via Discord async Q&A → use `ask-cli ask <id> "<q>" [branch] --options "a||b||c"` so the bot renders a button per
  option + a "Khác (tự nhập)" Modal. (Built + verified live 2026-06-17.)
- Reserve open-ended asks for genuinely open questions where enumerating options would be misleading.

Relates to [[route-questions-via-discord-not-blocking]] (async, don't block on presence) and
[[legible-proposals-plain-language]] (flag the recommended option, plain language).
