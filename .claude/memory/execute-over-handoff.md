---
name: execute-over-handoff
description: "The user wants the agent to carry tasks to completion itself (edit, run, commit when asked) rather than handing back manual steps — preserve the \"auto\" momentum"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ce5bb8ad-0fed-4458-b08d-75ba6d9ecff7
  modified: 2026-07-29T21:32:13.775Z
---

The user prefers the agent to DO the work end-to-end — make the edits, run the commands, run the baseline, commit when
asked — instead of producing a list of steps for them to do by hand. On 2026-06-18 they pushed back on being handed
manual apply-steps: "làm giúp tôi, đỡ mất công tôi phải thủ công chỉnh sửa, mất đi sự auto."

**Why:** they are a solo, hands-off supervisor who is often away from the keyboard; manual handoffs break the momentum
that makes an autonomous agent worth having. The value is the agent closing the loop, not narrating it.

**When the remaining step is genuinely THEIRS, say it ONCE per session and then stop** (2026-07-27). Across
one long session I raised `git push` at the end of five consecutive reports; they never did it and never
objected — they simply kept saying "tiếp tục". Repeating an ask they have visibly parked does not make it
happen, it just spends the top of every report on the same paragraph. State it once with the stake ("N
commits including a live migration sit on one machine"), offer to do it ("bảo tôi push thì tôi push"), then
carry the count in the status table without the sermon. Same for anything else they alone can run (their
Claude Desktop gates).

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

**Know which governance paths the classifier actually blocks, so the handoff is one line and not a guess** (measured
2026-07-30, after asking me to install a hook they had approved). The autonomy gate only enforces when
`CLAUDE_AUTONOMOUS=1`, and the contract permits a T4 governance change on explicit human approval — but the harness
classifier is a separate, blunter layer:

| Path | Agent can write it? |
| --- | --- |
| `.claude/hooks/**` | **NO** — both Bash and Write were refused |
| `.claude/settings.json` | yes (Edit) |
| `.claude/skills/**` | yes (Edit) |
| `.claude/scripts/**`, `.claude/memory/**` | yes |

So the useful shape is: do every part that is not blocked, then hand over **only** the blocked step as a copy-pasteable
command with the verification already done. On 2026-07-30 that was a single `cp` — they ran it immediately and I
finished the registration myself. Handing over the whole install (as the proposal file did) would have asked them to do
work I could have done. Don't hand back a step without first testing whether it is genuinely blocked.
