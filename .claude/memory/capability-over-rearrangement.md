---
name: capability-over-rearrangement
description: "Judge UI work by the capability it ADDS, not by how it reorganises a screen — the user reads restructuring of a page he already knows as loss, and rejected two consecutive redesigns for having 'no breakthrough'"
metadata:
  type: feedback
---

When working on a UI the user already uses daily, **the value has to come from a new capability, not
from a better arrangement of what is already there.** Restructuring a familiar screen reads to him as
loss (he knew where things were), even when the new structure is defensible.

**Why:** 2026-07-20 on sakubun's item page I replaced two tabs with a table-of-contents layout, added a
conjugation table, and added a "câu bạn đã dịch" section. His verdict: *"tôi chưa thấy sự đột phá và mới
mẻ gì… tôi cảm giác bạn chỉ đang đảo lại UI, mà thực UI còn xấu hơn đợt trước"* — and the new section
duplicated data the review log already showed. I then researched properly, produced a mockup he
**approved**, built it — and he still asked for the original two-tab layout back, ending the session
with *"phiên này bạn làm việc không vừa ý sự kỳ vọng của tôi"*. What survived both reverts were only the
things that added something absent before: audio on an example, a link to a related pattern, a button
that did not exist. Note that mockup approval did **not** rescue a change that was fundamentally a
rearrangement — approval of a design is not evidence that the work is worth doing.

**How to apply:** before restructuring a screen, answer in one sentence what the user can now DO that he
could not before. If the answer is "the same information, arranged differently", it is a cost, not a
feature — propose it as a separate, explicitly-labelled cleanup rather than folding it into a feature
pass, and expect it to be declined. Prefer additive changes to the shared component (per
[[apply-features-across-all-surfaces]]) over moving containers around. When a page already displays
some data, **read what that surface actually renders** before building a second view of it — related:
[[check-prior-decisions-early]] (internal prior art) and [[research-before-design]] (external, which on
this occasion would have stopped the conjugation table before it was written).
