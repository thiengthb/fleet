# Proposal — record whether a hook SPOKE, not only what it exited with

**Status:** proposed, not applied. `.claude/hooks/_util.mjs` is governance (`CLAUDE.md` §Autonomous agent), so the
agent may propose and a human decides. Nothing in this file is installed.

**Date:** 2026-08-01 · **Raised by:** step D1 of `platform/plans/2026-07-30-second-brain-audit.md`

## The problem, measured

`_util.mjs`'s `recordRun()` appends `{ts, hook, code, ms}` per run, and its own comment says *"The exit code is
the finding"*. For a fail-closed hook that is true. For the rest it is not:

| Hook | How it speaks | `fired` (exit 2) |
|---|---|---|
| `secret-guard`, `autonomy-gate`, `invariant-warn`, `reuse-guard`, `legibility-lint`, `verify-claim-gate`, `guide-coverage-reminder` | exits 2 | a real measurement |
| `plan-checkin`, `compact-recap`, `tree-moved-notice`, `git-sync-check`, `memory-wiring-check`, `harness-drift-check` | prints `hookSpecificOutput.additionalContext` / `systemMessage`, exits **0** | **0 forever** |
| `prettier-on-edit`, `suggest-session-wrap` | side effect / `systemMessage`, exits **0** | **0 forever** |

Measured 2026-08-01 against `~/.claude/hook-usage.jsonl`: **2,874 events, 15 of 15 hooks ran, 7 of 15 have no
`exit(2)` path in their source at all.** So for seven hooks the log cannot distinguish *looked and spoke* from
*looked and stayed silent* — `plan-checkin` exits 0 both when a plan is due and when none is.

The reporting side has been corrected already (`usage-census` prints `n/a`, `platform-report` carries it through
the `--json` boundary, both tested). That stops the number being **misread**. It does not make the question
answerable.

## Proposed change — one line of data, in `_util.mjs` only

Record whether the hook wrote anything to stdout/stderr:

```js
appendFileSync(
  path,
  JSON.stringify({ ts: …, hook, code, ms: …, spoke: wroteAnything }) + "\n",
);
```

`wroteAnything` is set by wrapping `process.stdout.write` / `process.stderr.write` inside `recordRun()` — the same
place the exit hook already lives, so **no per-hook edit and no per-hook drift**, which was `recordRun`'s original
design argument.

**Privacy is unchanged and that is the point.** A boolean, never the text. The existing header promises *"a
timestamp, the hook's filename, and its exit code. No file path, no tool input, no line of source, no session
id."* — `spoke: true|false` keeps every one of those promises. Recording *what* was printed would break them, and
is not proposed.

## Why not do it another way

- **Infer from exit code.** That is the status quo and is what failed: 0 means both outcomes for seven hooks.
- **Have each hook log its own "I spoke" line.** Rejected: 15 edits, 15 chances to forget, and a new hook starts
  wrong by default. `recordRun` exists precisely to avoid this.
- **Parse the transcript instead.** Impossible by construction — a hook is not a tool call, which is the reason
  this log exists (`usage-census` header, axis 3).
- **Leave it.** Defensible, and cheaper: `n/a` already prevents the wrong conclusion, and no retirement decision
  is currently blocked. The cost of leaving it is that *"has this advisory hook ever actually said anything?"*
  stays a question you answer by reading code, and `platform-report` — the document meant to let the supervisor
  audit the agent's judgement — cannot answer it either.

## What it would buy, concretely

`compact-recap` has run 5 times and `harness-drift-check` 9. Whether either has ever produced a single line the
model or the user saw is currently **unknown**, and those are exactly the two hooks whose value rests entirely on
what they print.

## If accepted

1. A human edits `.claude/hooks/_util.mjs` (~6 lines).
2. `usage-census`'s hook table gains a `spoke` column beside `ran`, and `n/a` for `fired` stays — a hook that
   cannot block still cannot block. Agent work, tested, mutation-checked.
3. Old log lines have no `spoke` key. They must read as **unknown, never as `false`** — a missing field silently
   defaulting to "never spoke" would fabricate exactly the false-death verdict §3 of the audit plan is about.
