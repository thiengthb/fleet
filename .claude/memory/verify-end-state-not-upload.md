---
name: verify-end-state-not-upload
description: Verify the USER-FACING end state (does it render/work?), never claim done from an intermediate step (upload/build succeeded)
metadata:
  node_type: memory
  type: feedback
---

During the Claude Design `.design-sync` work I repeatedly said the cards were "live / đã lên" after only confirming
the *upload + structure* succeeded — the user then saw an empty pane ("tại sao tôi chưa thấy gì hết"). The intermediate
step (files uploaded) was green, but the end state the user actually cares about (cards visibly rendering) was never
checked. I had even flagged the gap myself, then claimed success anyway.

**Why:** "Upload succeeded" / "build passed" / "tool returned ok" is NOT "it works for the user." Claiming done from a
proxy signal erodes trust and hides the real failure. The user values honest status over optimistic reporting — when a
result is unverified, SAY it's unverified rather than rounding up to "done."

**How to apply:** Before claiming anything works, verify the actual user-facing end state, not the last green
intermediate step. If I genuinely can't verify (e.g. it needs the user to look at a UI I can't see), state plainly
"uploaded/registered but NOT yet confirmed rendering — please check" instead of "it's live." Reinforces
`/verification-before-completion` + `/honest-critique`. See [[user-profile]], [[research-before-design]].
