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
**gate**: a source-scanning vitest test (like `projects/sakubun/lib/no-emoji.test.ts` /
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

**Extension (2026-07-28): the same standard applies to a rule aimed at ME, and to WORK ITSELF, not just
UI.** After I listed his pending tasks, he asked for "một cơ chế nào đó (và cho thêm những dự án sau
này)" so that a plan needing time-based testing carries a reminder plus "một bản các bước thực hiện đầy
đủ … mà mỗi lần không cần phải hỏi lại các bước rồi phải nhớ đến ngày nào" — and that I should
**proactively offer to continue an unfinished plan in any session, whatever project he happens to be
in.** Built as `.claude/hooks/plan-checkin.mjs` (`checkin:` frontmatter + a REQUIRED `## Check-in
runbook`, surfaced at SessionStart across every project, with dangling-plan drift and config defects).

**How to apply:** two things he considers unacceptable to leave to human memory — (1) a DATE he must
remember, and (2) STEPS he must re-ask for. Whenever work depends on either, build the reminder and
write the runbook in the same change; never answer "I'll remind you" or re-explain steps in chat that
should live in a file. Same for behavioural rules I write into a prompt: ask what would OBSERVE a
violation, and if nothing would, move it into code (2026-07-28 quiz — three protocol rules all drifted
because nothing could see them). Related: [[legible-proposals-plain-language]], [[execute-over-handoff]].

**Extension (2026-07-25): be PROACTIVE, not just reactive — and fix-while-passing.** He asked that ANY UI
pattern recurring many times be turned into a strict rule to tighten it, **especially layout-related UI**,
without waiting for him to complain; and that **while editing code I also fix spots currently violating the
existing strict UI rules** (don't walk past a violation). So: during a refactor/extraction, when a pattern
hits rule-of-three (esp. layout — the `standards/ui-layout` concern), extract the shared component AND lock
it (`docs/ui-patterns.json` + a gate where mechanically checkable); and repair any strict-rule violation found
in a file I'm already touching. This is captured as a standing principle in
`projects/sakubun/docs/plans/2026-07-24-optimization-maintainability-v2.md` (P1.8 + AC-8).

## Refinement (2026-07-28, measured — not argued)

A gate is not the only escalation, and it is not always the right one. The ledger's "one line + a pointer" rule had
been written down since 2026-06-12 and violated 203 times. What fixed it was **not** a gate and **not** restating the
rule harder — it was **restructuring so the compliant action became the obvious one**: a `ledger/YYYY-MM.md` to append
detail to, and an index table whose `Detail` column wants a link.

Measured with `.claude/scripts/eval-ledger-rule.mjs` (`/behavioural-eval`, 3 runs × 4 cells, one variable): control
index rows 340–738 chars with the reasoning pasted in, every trial; treatment 156–199 chars with a separate detail
entry, every trial. First claim on this platform backed by measurement rather than argument.

**So the escalation order is:** ① make the compliant path the path of least resistance · ② measure whether that held ·
③ add a gate only when the measurement says prose lost. A gate layered on top of good structure is machinery for its
own sake — and this platform's actual disease is too much machinery per unit of shipped value
([[practice-first-lean-ceremony]]).

**What does NOT change:** a rule the user has had to state twice still needs enforcement, and safety-critical rules
(secrets, self-governance writes, destructive commands) stay gated in code regardless of how good the structure is —
there, a single silent violation is too expensive to learn from.
