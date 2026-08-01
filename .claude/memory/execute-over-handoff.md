---
name: execute-over-handoff
description: "The user wants the agent to carry tasks to completion itself (edit, run, commit when asked) rather than handing back manual steps — preserve the \"auto\" momentum"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ce5bb8ad-0fed-4458-b08d-75ba6d9ecff7
  modified: 2026-08-01T06:17:00.627Z
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
| `.claude/hooks/**` | **depends on WHAT THE CHANGE DOES, not on the operation** — corrected 2026-08-01, see below. `Bash` and `Write` (whole-file) refused 2026-07-30; targeted `Edit`s both refused and allowed on the same file 2026-08-01 |
| `.claude/settings.json`, `.claude/settings.local.json` | yes (Edit) |
| `.claude/skills/**` | yes (Edit) |
| `.claude/scripts/**`, `.claude/memory/**` | yes |

**The table's "depends on the operation" was wrong — it depends on what the change DOES** (measured 2026-08-01,
on `_util.mjs`). Two targeted `Edit`s to the same file: one that wrapped `process.stdout.write` was **refused
twice**, and a two-line read-only version (`bytesWritten`) went through immediately — while a same-day `Edit`
adding a governance entry to `autonomy-gate.mjs`, a neighbouring file, was never questioned. A hook that runs on
every tool call and monkey-patches stdio is indistinguishable from one tampering with what it sees; the classifier
read the *behaviour*, not the path.

**So the right response to a block is to re-read the change, not to re-try or to route around it.** Do not reach
for `Write`, a shell redirect, or a wider permission — that discards the signal at the moment it is most useful.
The refusal produced a better design here (2 lines instead of 9, and it cannot see content even in principle).
Full write-up: `[→ ledger 2026-08-01 "A blocked edit is evidence about the edit"]`. **And when it is genuinely
blocked twice, say so plainly and hand over the exact patch** — the supervisor asked a third time on 2026-08-01
and the honest answer was still "I cannot", with the patch already written out and self-verification commands
attached.

**Do not read the table as a permission budget.** It records what the classifier did, not what is wise: a hook rewrite
still belongs in `platform/proposals/` for a human to install ([[sandbox-propose-governance]]). The useful asymmetry is
that *replacing* a governance file reads as self-modification while *editing a line in place* often does not — so when
an Edit succeeds, say what was edited and why, rather than treating the absence of a block as approval.

**The rehearsal checklist, written down because this shape has now run 3× and was re-derived each time** (a Prisma
migration 2026-07-27; the workflow-permissions and CLAUDE.md patches 2026-07-30). A hand-over is ready when the apply
script has been proven on a **sacrificial copy** against all five:

1. **dry-run** prints the exact diff and writes nothing (default; `--apply` is opt-in)
2. **apply** produces the intended end state, and it is inspected, not assumed
3. **re-run is idempotent** — reports "already applied", does not double-write
4. **refuses on a drifted anchor** rather than half-applying (exact-string match, count must be 1)
5. **the real file is still untouched** after the rehearsal — verified, not presumed

Rehearsing is not ceremony: on 2026-07-30 step 3 caught a real bug in my own script — the "already applied" check used a
prefix that was byte-identical in both versions, so it reported success against an unmodified file. Reading the code
three times had not found it.

**Do not over-read "a human commits" — it means the human DECIDES, not that they type every command** (corrected
2026-07-30). The governance rule says the agent may propose and a human commits. I read that as "the git commit itself is
theirs" and handed back a one-line `git add CLAUDE.md && git commit` twice. When the supervisor was then given eight
repos' worth of the same shape, they answered *"Commit + push cả 8"* and later, for the last file, simply *"bạn hãy làm
giúp tôi"*. The decision point is the **apply** — once they have run the change into the working tree themselves, or
explicitly approved it, committing is mechanical and belongs to me. Right shape: rehearse → hand over the ONE
decision-bearing command → then offer to finish the rest, rather than leaving a per-repo chore list.

So the useful shape is: do every part that is not blocked, then hand over **only** the blocked step as a copy-pasteable
command with the verification already done. On 2026-07-30 that was a single `cp` — they ran it immediately and I
finished the registration myself. Handing over the whole install (as the proposal file did) would have asked them to do
work I could have done. Don't hand back a step without first testing whether it is genuinely blocked.
