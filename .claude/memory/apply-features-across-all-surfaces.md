---
name: apply-features-across-all-surfaces
description: When adding a control/behavior, apply it consistently to EVERY applicable surface via the shared component — don't ship it on just the one place asked
metadata:
  type: feedback
---

When I add a feature/control/behavior, the user expects it applied **consistently across every surface
where it's relevant**, through the **shared component** — not just the first place they mentioned.

**Why:** he flagged this directly — after I added the audio speed control only in `/history`, he said the
resources tables + settings "vẫn đang bị lỗi" and "có vẻ như bạn không reuse lại component". Same pattern
recurred with breadcrumbs (every page) and the DataTable (both tables). A feature living on one screen
reads as broken/inconsistent to him.

**How to apply:** build the behavior INTO the reusable component (sensible default ON), then verify it
shows up everywhere that component is used — enumerate the call sites and check them, rather than wiring
one spot. If a dense/edge surface should opt OUT, that's an explicit prop, not the default. Ties to
[[design-for-generality]] (parameterize, don't hardcode) and [[extend-dont-rebuild]] (one thing, reused).
