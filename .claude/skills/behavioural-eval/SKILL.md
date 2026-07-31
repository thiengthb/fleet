---
name: behavioural-eval
description: Design, run and record a model-in-the-loop eval — when the thing being tested is what a MODEL does (does it reach for a tool, does the pushed context change its output, does an optional field ever get filled) and no unit test can reach it. Use when a feature's value depends on model behaviour, before trusting any eval result, and when a result looks clean. NOT for deterministic logic (/testing-standard routes that).
---

# Skill: Model-in-the-loop evaluation

A unit test can prove a tool WORKS. It can never prove a model REACHES for it. When a feature's value
rests on behaviour, the eval is the only instrument — and on this platform the instrument has been
wrong more often than the product. Seven times in two days a confident finding turned out to be a defect
in the harness; one of them nearly deleted a working feature, another scored a broken flagship 5/5.

**So the governing rule is: suspect the instrument first, especially when the result is clean.**

## Before you trust a number

1. **The fixture is the exact bytes production sends.** Never a summary, never a listing that prints
   description LENGTHS instead of descriptions, never a flattened schema. A fixture that SUMMARISES what
   the model sees produces confident findings about nothing.
2. **Capture a tool result from the START of its wrapper**, never from the first line you recognise. The
   envelope is usually the instruction being tested.
3. **Leave the variable under test room to move.** If other constraints already close the space, the
   control arm looks identical however well the treatment works.
4. **A control arm for any "this makes X better" claim.** One variable, same input, both arms. And run
   at least TWO fixtures that would fail for DIFFERENT reasons — a null result on one pair cannot tell
   "the mechanism is useless" apart from "this pair is unsteerable".
5. **Ask in the hypothetical** ("write what you WOULD do"). Telling a model to treat a file as its system
   prompt and emit calls that will not run reads as a request to fabricate evidence; a correct refusal
   costs a trial.
6. **Never let the prompt make one answer the only well-formed output.** "If you would call a tool,
   output the call, then stop" measures WHICH tool, not WHETHER.
7. **Prefer a metric a script can compute.** Count what is countable from the persisted row; reach for a
   judge only for what genuinely cannot be counted, and keep its score in its own column, blind to arm.
8. **On a machine that has never produced an eval result, prove the spawn FIRST:**
   `node .claude/scripts/eval-plan-execution-gate.mjs --smoke`. Measured 2026-07-31: `eval-ledger-rule.mjs`
   had **never been runnable on `TNT-Laptop`** — an env allowlist dropped `PATHEXT`, and Node refuses to spawn
   `claude.cmd` directly (its CVE-2024-27980 mitigation). Every test that eval had stayed green, because the
   spawn lives in the one half no test reaches. A whole run came back `ERROR × 4` and reported INCONCLUSIVE:
   a harness failure wearing the costume of a null result.
9. **"Created nothing" is not the same as "decided not to".** A metric that only sees absence scores a model
   no-op as a success. Pair every absence metric with a positive signal — did it edit anything, did it NAME
   the thing it was supposed to notice — and flag a run that created, edited and named nothing as SUSPECT
   rather than counting it. Then verify one such run by hand, per rule 4's spirit: read the sandbox.

## Procedure

1. **Write the question as a falsifiable sentence**, and pre-write what a NULL result obliges you to do.
   Pre-committing the consequence is what stops a null being explained away later.
2. **Put the arrangement in a committed script**, not in a chat message. A fixture nobody can re-run is
   a finding nobody can check — including you, tomorrow.
3. **Run the arms.** Record n. Small n is fine if the DIRECTION is unambiguous; say which it is.
4. **Red-team a clean result before reporting it.** Ask: could this number be produced by the harness
   doing nothing? Cheapest checks — print the first and last draw of a loop (identical ⇒ one sample);
   verify one "miss" by hand (all four were once the scorer); confirm the instruction under test was
   actually in the fixture.
5. **Record the defects too.** A harness defect log is worth more than the pass rate; it is what makes
   the next run trustworthy.

## What a harness can and cannot answer

- **CAN**: given input X, what does the model DO with it. Feeding a tool RESULT and grading the reply
  extrapolates reasonably to a real client.
- **CANNOT**: would the model have reached for something nobody mentioned. A subagent handed tool
  descriptions as conversation text over-predicts tool use no matter how you phrase the question —
  measured, twice. That class of question has ONE instrument: a live chat in the real client, run by a
  human. Budget for it, and mark the harness version VOID rather than "evidence".

## The live half needs a clean room, and a human

When the harness cannot answer, the live run is the instrument — so protect it the way you would protect
a fixture:

- **A blank chat is not a clean room.** A client that carries memory across conversations (Claude
  Desktop does) can produce the right-looking behaviour from a previous chat's habit rather than from
  the thing under test. Record which client, which surface (bare chat vs a Project with instructions),
  and whether prior conversations on the topic exist.
- **Grade the ACTION, never the intent.** "It offered to add this to sakubun" is not a tool call. A pass
  is a tool call in the transcript; an offer phrased in the right words is a FAIL with a good bedside
  manner, and it is the easiest false pass to hand yourself.

## Two failure shapes that keep recurring

- **A deterministic scorer removes MEASUREMENT noise and does nothing about GENERATION noise.** A pure
  scoring function pointed at a stochastic process still needs n. Two runs of the same prompt disagreed
  0/6 vs 4/4 on the same metric.
- **An absent measurement must never render as a passing one.** Return `null`, print "SKIPPED", and say
  out loud that it is not a clean result — otherwise "we didn't measure" silently becomes "it's fine".

Complements `/testing-standard` (which routes the deterministic tiers and stops where this begins),
`/verification-before-completion` (evidence before claiming, per change) and `/honest-critique` (the
stance; this is the method).
