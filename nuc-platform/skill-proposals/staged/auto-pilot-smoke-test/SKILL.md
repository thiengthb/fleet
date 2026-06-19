---
name: auto-pilot-smoke-test
description: Safely runtime-verify an auto-pilot autonomous batch (graduation, enrol, plan-advance, reflect) by staging a synthetic input on a THROWAWAY branch, running the real batch live, checking the produced artifacts, then cleaning up to zero residue. Use after changing the scheduled wrapper / a batch prompt / the gate wiring, when "parse + dry-run + unit-test pass" is NOT enough (ledger #71: wiring-verified != runtime-verified). NOT for normal code tests (that is /testing-standard).
---

# Skill: auto-pilot smoke test — prove an autonomous batch's RUNTIME behaviour, safely

Parse-checks, dry-runs, and detection unit-tests prove the *scaffolding*; they do NOT prove a batch actually DOES the
right thing when a real `claude -p` worker runs it. A live smoke test is the cheap way to catch what the wiring-checks
miss (it found the `## Done` substring bug in minutes after three layers of checks passed it). The hard part is doing it
WITHOUT leaving residue — an un-cleaned armed plan (`auto_pilot: true`) is work the scheduler will pick up.

Complements `/verification-before-completion` (this is its autonomy-specific application) and `/auto-pilot` (the batch
under test). Run it before claiming an autonomy change works.

## The 5 steps

1. **Stage a synthetic input on a NEW throwaway branch** (`git checkout -b test/<slug>` off the work branch). Pick the
   minimal trigger for the phase under test:
   - plan-advance → a throwaway plan with `status: active` + `auto_pilot: true` + one trivial safe step.
   - graduation → a synthetic `outcome: accept` idea ABOVE the `## Done` heading, with a clear self-contained option (so
     no planning question fires) + a `> SYNTHETIC, delete after test` note.
   - enrol → let graduation produce the `enrol: pending` draft, or hand-mark a throwaway draft.
   Commit the synthetic input on the throwaway branch.
2. **Run the real batch live (NOT dry-run).** `auto-pilot-scheduled.ps1` with phase isolation flags
   (`-NoPropose -NoReflect`, etc.) so only the phase under test fires; sonnet worker. ANNOUNCE the model (it is weaker
   than an Opus main loop). The wrapper spawns the worker in a hidden console (`-Wait`) and logs to
   `~/.claude/auto-pilot-logs/<tag>-*.out.log` — read that for the worker's digest + exit code.
3. **Verify the artifacts against expectations** by READING them (not the worker's self-report): the draft plan
   frontmatter (`status`/`auto_pilot`/`enrol`), idea-queue moves (`graduated_plan:`, block under `## Done`), the gate/ask
   state (`ask-cli check`), and — for enrol — that the plan is armed ONLY after a valid signed answer.
4. **CLEAN UP (the safety-critical step).** `git checkout <work-branch>` (so the tree is NOT left on a throwaway branch),
   then `git branch -D` the throwaway branch(es) (this deletes the synthetic plan/idea AND any armed plan with them).
   Clear stray control-plane state: `~/.claude/state/current-ask.json`, `~/.claude/agent-gates/{asks,answers,reports}/*`
   (commit+push the gates-clone deletion if it was pushed). **Never leave an armed `auto_pilot: true` plan behind.**
5. **Confirm zero residue + record.** Run an authoritative dry-run and confirm `opted-in active plans: 0` and the phases
   skip; grep the queue/plans for the synthetic ids (expect 0). Record the result + any bug found in the day-log; a bug
   becomes a fix commit, not a swept-under-the-rug "should work".

## Guardrails

- The gates clone is SHARED with real autonomy state + posts to the real Discord — label synthetic asks/ideas as DEMO,
  and clean the gates clone after. A live enrol demo posts a real card to the supervisor's phone.
- The Windows scheduled task can fire mid-test; keep the armed-plan window tiny and clean up promptly. The single-flight
  lock prevents overlap but not interleaving across the test window.
- This skill never installs/pushes anything to `main`; it works on throwaway branches and local commits only.
