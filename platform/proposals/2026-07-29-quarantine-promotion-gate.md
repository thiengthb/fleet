# Proposal — block the quarantine→governance promotion path in `autonomy-gate.mjs`

**Status:** PROPOSED, awaiting a human commit. The agent wrote and tested this; it must not install it.
**Driver:** `platform/plans/2026-07-29-idea-0023-mcp-platform-server-build.md` Step 2.2 / **AC-5**.
**Drop-ins:** `autonomy-gate.mjs.proposed` · `autonomy-gate.test.mjs.proposed` (the existing suite with the one flipped
case already applied — 76/76 against the proposed gate) · `autonomy-gate.quarantine.test.mjs` (runnable now, 26 cases).
**Supervisor chose Option A (full) on 2026-07-29**; install remains a human commit.

## In plain terms

The `rulebook` MCP server just gained a way for **other projects to send text back into this repo** (`report_lesson` →
`platform/inbox/quarantine/`). That text is written by a model somewhere else, so it has to be treated as untrusted.
The inbox is inert by construction — nothing loads it. But "inert" only holds if the agent cannot **promote** a lesson
into the files that *are* loaded (a rule, a skill, a `CLAUDE.md`, a standard). Right now, in an unattended run, it can:
not through `Write` (that is already blocked) but through a **shell command**, which the gate never checked.

So this proposal does two things: it treats the quarantine inbox and the platform standards as governance, and it
closes the shell hole that made the existing governance block bypassable.

## What changes (three edits, all marked `PROPOSED 2026-07-29` in the drop-in)

1. **`platform/standards/**` joins the governance write-block.** It holds `autonomy-contract.md` — the policy this hook
   exists to enforce. An agent that can edit its own contract unattended has no contract.
2. **`platform/inbox/quarantine/**` joins it too.** Untrusted input; editing it is how it gets laundered into
   something that looks reviewed.
3. **Bash can no longer write to governance.** A new check blocks write verbs (`cp`, `mv`, `tee`, `sed -i`, `node -e`,
   …) and output redirects whose **target** is a governance path.

### The bug this uncovered, which is worth more than the feature

`cp evil.md .claude/hooks/autonomy-gate.mjs` was **ALLOWED** in autonomous mode before this change — verified, not
assumed (`10/26 passed` when the new suite is pointed at the live gate). The governance block lived only on the
`Write`/`Edit`/`MultiEdit` branch; the `Bash` branch denied ~23 command classes and none of them was "write a file".
The gate has read as airtight since 2026-06-19 because every test exercised it through the file tools.

**This hole predates quarantine and is independent of it.** Even if the backflow feature were abandoned tomorrow, edit
(3) should still land.

## Options considered

| | Option | Verdict |
|---|---|---|
| **A** | **Block `platform/standards/**` wholesale + quarantine + the shell path** | ✅ **Recommended.** The one behavioural cost is that an unattended run can no longer edit a standard — and *propose-don't-execute* is already the right path for changing law. |
| B | Block only `standards/autonomy-contract.md`, leave the other standards writable | Narrower, and tempting. Rejected: it makes the boundary a judgement call ("is `testing.md` law?"), and a boundary that needs judging is not a deterministic gate. |
| C | Also block *reading* quarantine files in autonomous mode | Rejected as **theatre**: this hook's matcher is `Bash\|Edit\|Write\|MultiEdit`, so the `Read` tool walks past it entirely. Blocking `cat` while `Read` sails through buys nothing and teaches a false sense of coverage. |
| D | Add a `promote_lesson` tool with an approval flag | Rejected outright. The flag becomes the thing that gets set. Promotion is a human commit or it is not a control. |

## Cost, stated plainly

One existing test case flips: `.claude/hooks/autonomy-gate.test.mjs` asserts
`autonomous: Write a doc → ALLOW` for `platform/standards/documentation.md`. Under this proposal that is a **BLOCK**.
Measured, not guessed:

- existing 75-case suite vs the **live** gate → **75/75 PASS** (baseline)
- existing 75-case suite vs the **proposed** gate → **74/75**, the single failure being exactly that case
- new 26-case suite vs the **proposed** gate → **26/26 PASS**
- new 26-case suite vs the **live** gate → **10/26** — i.e. the new tests genuinely measure the change rather than
  passing everywhere

## Residual risk — not papered over

- **`Read`, `Grep` and `Glob` are not gated at all**, so an autonomous session can still pull a quarantined lesson's
  text into its context and be influenced by it without ever writing a file. The mitigations there are the fenced body
  and the untrusted header (`rulebook/lib/report-lesson.ts`), which are *mitigation, not a wall*. Widening the matcher
  is a `settings.json` change — also governance, also a human move — and is **not** part of this proposal because
  blocking reads breaks the human-in-the-loop runbook ("summarise the inbox for me").
- **The write-verb list is a denylist**, and denylists leak. A determined agent could write a helper script and run it,
  or use an interpreter spelled differently. This raises the cost of an *accident* to near-certain-block and the cost of
  a *deliberate* bypass to "you had to try"; it does not make promotion impossible.
- The gate only fires in autonomous mode. In a supervised session everything above is ALLOW by design — the human and
  Claude Code's permission prompts are the gate there.

## How to install (human)

1. Read the diff: `diff .claude/hooks/autonomy-gate.mjs platform/proposals/autonomy-gate.mjs.proposed`
2. `cp platform/proposals/autonomy-gate.mjs.proposed .claude/hooks/autonomy-gate.mjs`
3. `cp platform/proposals/autonomy-gate.test.mjs.proposed .claude/hooks/autonomy-gate.test.mjs` — the flip is already
   applied in it (`Write a project doc → ALLOW` + `Write a platform standard → BLOCK`), 76 cases.
4. `cp platform/proposals/autonomy-gate.quarantine.test.mjs .claude/hooks/` — it resolves the live gate from there with
   no edit.
5. Run both: `node .claude/hooks/autonomy-gate.test.mjs && node .claude/hooks/autonomy-gate.quarantine.test.mjs`
6. Commit, then tick Step 2.2 in the plan and delete the three drop-ins (this record stays).

Copy-paste:

```bash
cd /home/thien/projects/fleet
diff .claude/hooks/autonomy-gate.mjs platform/proposals/autonomy-gate.mjs.proposed
cp platform/proposals/autonomy-gate.mjs.proposed        .claude/hooks/autonomy-gate.mjs
cp platform/proposals/autonomy-gate.test.mjs.proposed   .claude/hooks/autonomy-gate.test.mjs
cp platform/proposals/autonomy-gate.quarantine.test.mjs .claude/hooks/
node .claude/hooks/autonomy-gate.test.mjs && node .claude/hooks/autonomy-gate.quarantine.test.mjs
```
