---
name: apply-features-across-all-surfaces
description: Apply a control/behavior/rule consistently to EVERY applicable surface via the shared component — don't ship it on just the one place asked; the user audits for completeness and finds the gaps
metadata:
  type: feedback
---

When I add a feature/control/behavior, the user expects it applied **consistently across every surface
where it's relevant**, through the **shared component** — not just the first place they mentioned.

**Why:** he flagged this directly — after I added the audio speed control only in `/history`, he said the
resources tables + settings "vẫn đang bị lỗi" and "có vẻ như bạn không reuse lại component". Same pattern
recurred with breadcrumbs (every page) and the DataTable (both tables). A feature living on one screen
reads as broken/inconsistent to him.

**The same applies to a RULE, not just a feature — and he audits for it.** 2026-07-19: I established a
language boundary (model-facing text → English, user-facing → Vietnamese), applied it to the two protocols
and one renderer, and stopped. He came back with "tại sao trong lib/mcp/ vẫn còn tiếng Việt, tôi tưởng phần
đó chỉ có claude thấy" — and the part I'd skipped was the *largest* (21 tool descriptions, 3.9k tokens).
Same session he asked "còn gì tối ưu tiếp không? đã xong plan chưa". He checks whether a stated rule was
carried to completion, so a half-applied convention is worse than none: it reads as documented intent while
being false. When I announce a rule, I sweep the whole surface it claims to cover in the same pass, and I
name the exceptions explicitly (with the reason) so a gap never looks like an oversight.

**How to apply:** build the behavior INTO the reusable component (sensible default ON), then verify it
shows up everywhere that component is used — enumerate the call sites and check them, rather than wiring
one spot. For a rule: grep the whole surface, list every hit, decide each one, and state the deliberate
exceptions. If a dense/edge surface should opt OUT, that's an explicit prop (or a written exception), not
silence. Ties to [[design-for-generality]] (parameterize, don't hardcode) and [[extend-dont-rebuild]]
(one thing, reused).
