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

> **Status 2026-08-01: INSTALLED — and the refusal that delayed it improved the design, so the record of it
> stays.**
>
> The first implementation wrapped `process.stdout.write` / `process.stderr.write` inside `recordRun()`. The
> permission layer **refused it twice**, and rather than route around it the question was asked properly: *what
> about this edit is objectionable when the `agents/**` patch to a neighbouring hook went through?* The answer
> is that a hook running on every tool call, monkey-patching stdio, is indistinguishable from the outside from
> one tampering with or exfiltrating what it sees. That is a correct thing to refuse.
>
> **What shipped is read-only.** `process.stdout.bytesWritten` is a counter the stream already keeps, so the
> output is observed without being touched — it cannot see content even in principle. Verified before being
> relied on (piped stdio, five modes): silent `0/0` · a stdout write `30` · a stderr write `9` ·
> `console.log` `16` · a bare newline `1`. Two lines of code instead of nine, and no interception.
>
> **The refusal was a better reviewer than the author.** It is left in this file deliberately: the lesson is not
> "the gate was annoying", it is that a blocked edit is evidence about the edit.
>
> Proven end to end, with the same hook on both branches so it cannot be a per-file artefact:
> `secret-guard` on a synthetic AWS key → `code:2, spoke:true` (353 bytes printed) · on a clean file →
> `code:0, spoke:false` · `prettier-on-edit` on a `.txt` → `code:0, spoke:false`. Then read back through both
> readers: `secret-guard 1/2`, `prettier-on-edit 0/1` — a measured zero, not `?`.

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

### What shipped — two lines, inside the exit handler that already existed

```js
const spoke = (process.stdout.bytesWritten || 0) + (process.stderr.bytesWritten || 0) > 0;
// …then `spoke` is added to the object already being appended.
```

The doc comment above `recordRun` no longer claims *"the exit code is the finding"*: it is the finding for a
fail-closed guard and not for the other seven.

**Known limit, stated rather than hidden:** a hook that writes only whitespace counts as having spoken. `> 0` is
used instead of a threshold because a magic number would be a second thing to be wrong about, and a hook
printing a bare newline is a defect either way.

### Re-verifying it — the same hook must give BOTH answers

Point `HOOK_USAGE_LOG` at a scratch file and fire `secret-guard` twice: once on a file containing a synthetic
credential, once on a clean one. Expected: `code:2, spoke:true` then `code:0, spoke:false`. If both come back the
same, the observation is in the wrong place and the column is worthless.

Build the synthetic value as `AKIA` followed by sixteen uppercase alphanumerics. **Do not use one containing
`example`, `xxxx`, `changeme` or angle brackets** — `secret-guard`'s `PLACEHOLDER` pattern exempts those on
purpose, so an obvious-looking fake will not fire the guard and the probe will silently prove nothing.

> **This section was itself blocked by `secret-guard`, mid-edit.** The first draft pasted the literal probe
> value into this file; the hook refused the write, named the pattern and the file, and pointed at Invariant #4.
> It was the **first real exit-2 block of the session** — every `fired` count had been 0 until then, which is
> the honest reading of those zeros: the guards had found nothing to catch, not that they cannot catch. The
> fix was to remove the literal, never to weaken the rule. A document about a guard is not an exemption from it.

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

1. A human edits `.claude/hooks/_util.mjs` (~15 lines with the comment). **This is the only step left.**
2. ~~`usage-census`'s hook table gains a `spoke` column…~~ **DONE 2026-08-01, before the producer exists.**
3. ~~Old log lines have no `spoke` key…~~ **DONE — and it is the case with the most tests on it.**

### The reading half is already built, and deliberately built FIRST

Both readers ship the column now, so the day the patch lands the answer appears with no further work — and,
more importantly, the dangerous case was pinned **while it could still be constructed**. Once real `spoke` data
exists, a fixture where *no* line carries the key can only be written on purpose; today it is the default.

| State | `usage-census` | `platform-report` | Means |
|---|---|---|---|
| some runs printed | `2/3` | `2‑of‑3` | measured, with its denominator |
| ran, printed nothing | `0/2` | `0‑of‑2` | **a measurement** — not the same as no data |
| no line carries the key | `?` | `?` | **UNKNOWN.** Never `0` |

The denominator is not decoration: mid-transition most runs predate the key, and a bare `2` would hide whether
it is 2 of 3 or 2 of 300. `usage-census` also prints, when every hook shows `?`, a line naming this proposal as
the reason — so the column reads as a pending patch rather than as a broken tool.

**Guards, because `spoke` is exactly the kind of number that gets misread into a deletion:**

- `typeof e.spoke === "boolean"`, not truthiness — `spoke: false` is a measurement and must land in the
  denominator. A mutant pins it: with `if (e.spoke)` a measured silence collapses into "no data".
- A second mutant pins absence → `?`: removing the guard makes UNKNOWN report as an object, i.e. as data.
- `platform-report` re-created this class once already with `?? 0`, in the one document the supervisor is told
  to audit the agent's judgement with. Its case was **proven red** by reverting the null check, not assumed.
- The LIMITS block states the rule that matters more than any count: **a guard with nothing to say is a guard
  finding nothing wrong.** `spoke` never justifies retiring a hook on its own.

12 mutants in `usage-census.test.mjs` (was 10), and `platform-report.test.mjs` covers both shapes in one pass.
