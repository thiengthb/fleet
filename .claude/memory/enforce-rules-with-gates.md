---
name: enforce-rules-with-gates
description: The user wants UI/code rules ENFORCED by an automated gate (test/hook/CLAUDE.md invariant), not just written in a doc, so he doesn't have to repeat them
metadata:
  type: feedback
---

When the user states a rule (esp. a UI/layout convention), he expects it to be **enforced automatically**
so he never has to repeat it. A rule that lives only in a doc/skill is, in his words, something he has to
"nhắc lại liên hồi" — unacceptable. He explicitly asked "bạn có cơ chế nào không?" after a layout rule
regressed twice.

**Why:** he is the solo operator and can't police every change by eye; the platform already does this
(`lib/no-emoji.test.ts` gates the no-emoji rule). Documentation is a reminder; a failing test is a gate.

**How to apply:** when the user gives a rule that could regress, don't just document it — add a
**gate**: a source-scanning vitest test (like `sakubun/lib/no-emoji.test.ts` /
`lib/layout-standard.test.ts`) that fails `npm test`/CI on violation, PLUS a `CLAUDE.md` invariant
(loaded every session so the agent applies it by default), PLUS the reference doc. The trio =
written + agent-read-each-session + machine-blocked. Prefer making the wrong thing structurally
impossible (required types, one shared component) over a lint message. Related:
[[apply-features-across-all-surfaces]], [[practice-first-lean-ceremony]].

**Extension (2026-07-23, his own words: "bị một vài lần tôi đã quá khó chịu"): him repeating a UI
pattern is a DEFECT SIGNAL, and the capture now has a home — skill `/ui-pattern-lock`.** The reason
rules kept staying prose was economic, not motivational: each gate cost ~80 lines of bespoke test, so
"write it in the doc" always won. Now a lock is one entry in `<project>/docs/ui-patterns.json`, run by
a generic gate, printed by a PreToolUse hook before the session's first `.tsx` write. **How to apply:**
the second time he states a UI preference — or the first time he says "tôi đã nói rồi" / "sao không
dùng X" — STOP the edit in progress and lock it FIRST, in his words, then resume; locking afterwards is
the order that has already failed. Do NOT seed the registry with rules he never asked for (he stops
trusting a noisy list) — ask him to name the ones that actually annoy him. If he raises an
already-locked pattern again, the check is too weak: tighten it, never just re-acknowledge.
