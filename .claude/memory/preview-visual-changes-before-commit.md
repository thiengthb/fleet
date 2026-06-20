---
name: preview-visual-changes-before-commit
description: On UI/visual/color/design changes, show a preview and get approval before committing — the user reviews pixels, not just the diff
metadata:
  type: feedback
---

For **visual / UI / color / design** changes, the user wants to *see* the result and approve it before it is committed — reading the diff is not enough. In the slice-F session they asked to preview `/practice` ("xem thử UI mới"), then to tune the `--warn` amber "cho dễ đọc hơn", approving each step before it landed.

**Why:** pixels, contrast and color are taste calls the user (the supervisor/oracle) owns; a code diff doesn't convey how it looks or reads. This is the visual-work counterpart to [[execute-over-handoff]] — execute end-to-end on non-visual work, but on visual work insert a *look-and-approve* gate before committing.

**How to apply:** when the change is visual and the environment can't render the live app (no browser, or it needs a backend), build a faithful static **Artifact** that reproduces the real tokens + markup + sample data (light + dark), let the user eyeball it, then commit after approval. Pair with [[ask-with-options-not-open-ended]] and [[legible-proposals-plain-language]].
