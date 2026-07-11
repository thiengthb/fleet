---
name: check-prior-decisions-early
description: "During a design/brainstorm chat, cross-check the user's idea against existing plans/decisions/built code EARLY and surface any conflict before endorsing — the user iterates fast and may propose reversing their own recent work"
metadata:
  type: feedback
---

When the user brainstorms a feature direction, check it against existing `docs/plans/*.md`,
`decisions.md`, and already-built code **early — before endorsing it**, not only at plan-write time.
The user iterates fast and may propose something that **reverses their own recent decision**.

**Why:** 2026-07-11 the user proposed bringing vocab-SRS back into sakubun; I enthusiastically endorsed
it across several turns ("the missing half of the engine") and only caught — at `/project-plan` Step 1 —
that it reversed `drop-vocab-grammar-focus` (done) AND superseded `anki-vocab-push`, a feature he'd
**built that same morning** and forgotten. Endorsing first, discovering the conflict later, wastes turns
and risks silently reversing settled architecture. The user is the supervisor: he needs the continuity
check surfaced so he reverses **consciously**, not by accident.

**How to apply:** before agreeing with a design direction, glob `docs/plans/` + skim `decisions.md` for
the area it touches. If the idea reverses/overlaps a prior decision or a shipped feature, **name it
plainly, present options, flag the recommended one** (per [[legible-proposals-plain-language]]) and let
him decide — don't quietly build over it, and don't treat shipped code as sacred either (he WILL reverse
built work when the pedagogy/design is genuinely better). This is the INTERNAL-prior-art sibling of
[[research-before-design]] (which is about EXTERNAL sources). Related: [[extend-dont-rebuild]].
