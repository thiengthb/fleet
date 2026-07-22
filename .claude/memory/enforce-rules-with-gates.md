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
