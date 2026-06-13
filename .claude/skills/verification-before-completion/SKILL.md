---
name: verification-before-completion
description: Use when about to claim work is complete, fixed, or passing — before committing, pushing, or reporting done. Requires running the verification command and reading its output FIRST; evidence before assertions, always. Pairs with /verify (run the app) and /honest-critique (truth over comfort).
---

# Verification Before Completion (platform-adapted)

> **Adapted from** `development/verification-before-completion` (`davila7/claude-code-templates`). Docs-only; aligns with
> the platform's existing honesty value (`/honest-critique`) and the "paste the run output" bar in `/vitest-server-actions`.

Claiming work is complete without verification is dishonesty, not efficiency.

**Core principle:** evidence before claims, always.

## The Iron Law

```
NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE
```

If you haven't run the verification command in this message, you cannot claim it passes.

## The gate function

```
BEFORE claiming any status or expressing satisfaction:
1. IDENTIFY  — which command proves this claim?
2. RUN       — execute the FULL command, fresh
3. READ      — full output, check exit code, count failures
4. VERIFY    — does the output confirm the claim?  No → state the actual status with evidence.
5. ONLY THEN — make the claim, WITH the evidence.
Skip a step = asserting, not verifying.
```

## What each claim actually requires

| Claim | Requires | NOT sufficient |
|-------|----------|----------------|
| Tests pass | Test output: 0 failures | a previous run, "should pass" |
| Linter/types clean | Linter/tsc output: 0 errors | a partial check, extrapolation |
| Build succeeds | Build command: exit 0 | linter passing, "logs look good" |
| Bug fixed | Re-test the original symptom: passes | code changed, assumed fixed |
| Deployed/working | The real URL responds / container healthy | "the image built" |
| Agent completed | The diff shows the changes | the agent reported "success" |
| Requirements met | Line-by-line checklist vs the plan | "tests pass, must be done" |

## Red flags — STOP

"should" / "probably" / "seems to" · expressing satisfaction before verifying ("Great!", "Perfect!", "Done!") · about to
commit/push/PR without running the check · trusting a subagent's success report · relying on a partial check · "just this
once" · tired and wanting it over · **any wording implying success without having run the verification.**

## Rationalization prevention

| Excuse | Reality |
|--------|---------|
| "Should work now" | RUN the verification. |
| "I'm confident" | Confidence ≠ evidence. |
| "Linter passed" | Linter ≠ compiler ≠ tests. |
| "Agent said success" | Verify independently (check the diff). |
| "I'm tired" / "just this once" | No exceptions. |
| "Different words, so the rule doesn't apply" | Spirit over letter. |

## When to apply

ALWAYS before: any success/completion claim or expression of satisfaction; committing, pushing, PR creation; marking a
task/plan-step done; moving to the next task; trusting a delegated agent. Applies to exact phrases, paraphrases, and any
implication of success.

**Bottom line:** run the command, read the output, THEN state the result. Non-negotiable — and it's why this platform
reports failures plainly (a failing test is stated with its output, a skipped step is named).
