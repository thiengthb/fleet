<!-- A DRAFT skill proposal — inert until a human installs it (moves it to .claude/skills/<name>/). Schema: README.md. -->

---
proposed_name: behavioural-eval
status: proposed # proposed → installed | rejected
created: 2026-07-28
grounding: # every one of these is a WRONG finding this platform actually produced and acted on
  - 'log/2026-07-27.md — `{TOOL_LIST}` was a listing that printed description LENGTHS; Scenario J "failed" 2/2 against descriptions no trial had read, and the indicated fix was one step from being applied to correct code'
  - 'log/2026-07-27.md — a flattened arg schema hid an enum casing, so every trial produced rejectable args and it read as a model failure'
  - 'log/2026-07-27.md — a `sed` capture began at the block content and cut the display-order envelope; trials were graded against an instruction they had never been given (0/2 → 3/3 once included)'
  - 'log/2026-07-28.md — Scenario G: a batch with no room for the variable to move made control and treatment identical by construction; recorded INCONCLUSIVE rather than firing the pre-written conclusion'
  - 'log/2026-07-28.md — Scenario A scored 5/5 twice and FAILED in the real client; the prompt made a tool call the only well-formed output, and a neutral rewrite still gave 5/5, so the harness itself was void'
  - 'log/2026-07-28.md — a 60-day replay never consumed its queue, so 420 "samples" were 7 draws counted 60 times; the clean 0% would have cancelled a planned feature'
  - 'log/2026-07-28.md — a loose-match floor left 3-character patterns untrimmed, so all 4 reported "unused pattern" misses were the scorer, not the tutor'
self_verify:
  generalizes: yes — every instance is "the instrument was wrong and the finding looked confident"; none of the rules mention sakubun specifics
  lean: yes — core is a 7-item checklist plus a short procedure
  description_what_and_when: yes
  no_overlap: >
    /testing-standard routes deterministic tiers and explicitly does not cover model-in-the-loop;
    /vitest-server-actions and /playwright-e2e-builder are unit and e2e; /verification-before-completion
    is "run it before claiming done" for a single change, not the design of a behavioural experiment;
    /honest-critique is the stance, this is the method. No existing skill covers evaluating MODEL
    BEHAVIOUR, which is now the enforcement surface for whole features on this platform.
review:
  outcome: null # installed | rejected
  why: null
---

# Proposed skill: behavioural-eval

> Draft — not installed. On approval, the human moves the section below into `.claude/skills/behavioural-eval/SKILL.md`.

## The proposed SKILL.md

````markdown
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

## Two failure shapes that keep recurring

- **A deterministic scorer removes MEASUREMENT noise and does nothing about GENERATION noise.** A pure
  scoring function pointed at a stochastic process still needs n. Two runs of the same prompt disagreed
  0/6 vs 4/4 on the same metric.
- **An absent measurement must never render as a passing one.** Return `null`, print "SKIPPED", and say
  out loud that it is not a clean result — otherwise "we didn't measure" silently becomes "it's fine".

Complements `/testing-standard` (which routes the deterministic tiers and stops where this begins),
`/verification-before-completion` (evidence before claiming, per change) and `/honest-critique` (the
stance; this is the method).
````

## Why this is worth a skill (the rule-of-three case)

Seven grounded instances in two days, all the same shape: **the finding was confident and the instrument
was wrong.** Four of them would have changed working code — one nearly cancelled a feature on a
measurement of nothing, one scored a flagship behaviour 5/5 that fails in the real client, one was a step
from rewriting a correct tool description.

The rules currently live as prose inside two project-specific eval files (`sakubun/eval/*.md`) and as
rows in the knowledge ledger. That is where they were learned, but it is the wrong home: the next project
to need a behavioural eval will not read sakubun's eval file, and the platform now has agent-behaviour
surfaces in `todo`, `yakudoku` and `nuc-ops-bot` whose value rests on exactly this kind of claim.

**Deliberately NOT proposed:** a second skill for migration rehearsal. That process also recurred (now 5×
— Item redefine, `ReviewLog.errorDetail`, `LearnerNote`, `Sentence.extraPatterns`, `CalibrationProposal`),
but it is already filed as `prisma-expert-migration-rehearsal.md` awaiting review; the extra occurrences
strengthen that pending proposal rather than justify a new one.
