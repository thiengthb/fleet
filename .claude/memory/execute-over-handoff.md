---
name: execute-over-handoff
description: The user wants the agent to carry tasks to completion itself (edit, run, commit when asked) rather than handing back manual steps — preserve the "auto" momentum
metadata:
  type: feedback
---

The user prefers the agent to DO the work end-to-end — make the edits, run the commands, run the baseline, commit when
asked — instead of producing a list of steps for them to do by hand. On 2026-06-18 they pushed back on being handed
manual apply-steps: "làm giúp tôi, đỡ mất công tôi phải thủ công chỉnh sửa, mất đi sự auto."

**Why:** they are a solo, hands-off supervisor who is often away from the keyboard; manual handoffs break the momentum
that makes an autonomous agent worth having. The value is the agent closing the loop, not narrating it.

**How to apply:** once they've approved the direction, carry it through (edit → verify → commit when asked → report the
result) rather than stopping at "here's what you should run." Still confirm before genuinely irreversible / outward
actions, and still surface real decisions as options. Pairs with [[ask-with-options-not-open-ended]] and
[[route-questions-via-discord-not-blocking]].
