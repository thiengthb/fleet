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

**When a risky action is BLOCKED (permission classifier / a genuine irreversibility), the handoff still has a shape they
accept — REHEARSED, not asked** (2026-07-27, a Prisma SQLite migration that DROPs + recreates a table holding 581 real
items). What worked: rehearse it on a COPY of the real data and report the comparison (12 table counts identical,
indexes rebuilt, sampled rows intact), take a backup, then hand over the ONE exact command. Their reply was "hãy rebuild
rồi tiếp tục" — so they grant the permission when the evidence is already in front of them, and they expect the agent to
then proceed through the rest without re-asking. Do NOT stop at "I was blocked"; a blocked step is a request for
verification, not a request for instructions. Also observed repeatedly this session: they answer "tiếp tục theo khuyến
nghị của bạn", i.e. the agent's own recommended ORDERING is treated as the plan — see
[[practice-first-lean-ceremony]].
