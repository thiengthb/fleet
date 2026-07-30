# 11 — Testing & Spec Standard (platform-wide)

> The platform's **single testing & specification standard** — what to test, where, test-first or not, and how a spec
> becomes a test. Managed via skill **`/testing-standard`** (the router) + the existing `/vitest-server-actions`,
> `/playwright-e2e-builder`, `/coding-convention` skills. Design + evidence + ruled-out options:
> `plans/2026-06-14-testing-spec-discipline-proposal.md`. This doc is the *standard*; the skills are the *how-to*.
>
> **Why this exists:** the platform already had tests-as-a-guardrail (CI `build: needs: test` + `/verification-before-
> completion`), but no test-*first* discipline, no spec→test bridge, and nothing guarding cross-repo contracts. As the
> platform expands to **many people + many machines/repos**, those gaps become coordination failures. This standard adds
> *only* the coordination value (acceptance criteria + contract tests) and refuses blanket ceremony — it is **tiered and
> trigger-gated**, not "TDD everything".

## 0 — The one-paragraph version

Write **acceptance criteria** (Given/When/Then) for any non-trivial change *in the proposal/plan you already write*, one
criterion mapping to one test. Then test by **tier**: **test-first (TDD)** for pure logic, **test-alongside** for server
actions/components, **consumer-driven contract tests** for cross-repo HTTP seams, **Playwright E2E** sparingly at the top.
The CI test job and `/verification-before-completion` are the gates that make tests a guardrail, not a suggestion.

## 1 — The test pyramid (which tier for what)

Spend most effort at the base (cheap, fast, deterministic); least at the top (slow, brittle). Each tier names the
technique and the skill that owns its how-to.

| Tier (base→top) | What it covers | Test-first? | Technique / skill |
| --- | --- | --- | --- |
| **Pure logic** | Deterministic functions, no I/O (rule engines: `lib/streak.ts`, `dates.ts`, `capacity.ts`, `priority.ts`) | **YES — TDD required** | Vitest unit tests · `/vitest-server-actions` §1 |
| **Server actions / data layer** | Actions that validate + call Prisma + revalidate; Zod boundaries | No — test-alongside | Vitest + mocked Prisma/`next/cache` · `/vitest-server-actions` §2 |
| **Components** | UI behaviour a user observes (only where logic lives) | No — test-alongside | React Testing Library · `/vitest-server-actions` §3 |
| **Cross-repo HTTP seams** | One repo calling another's API (todo↔core, web↔core, MCP) | No — write the contract | **Consumer-driven contract tests** (§4) · `registries/shared-assets` template |
| **End-to-end (user flows)** | Critical multi-step journeys, sparse | No | Playwright · `/playwright-e2e-builder` (idea-0006 = this top tier) |
| **Model-in-the-loop seams** | Whether the *calling model* handles a tool result or a rejected argument correctly — paraphrasing, reordering, a dead-end it cannot recover from. A contract test checks the SHAPE; this checks the behaviour | No — write the eval | **Model-in-the-loop eval** · `/behavioural-eval` |

**Do NOT** chase a coverage %, test framework internals, or assert on a value you mocked yourself (carried from
`/vitest-server-actions`). A test worth keeping fails only when behaviour you meant to keep actually breaks.

## 2 — Test-first (TDD), but ONLY for pure logic

Evidence (Nagappan et al. 2008, 4 industrial teams): test-first cuts pre-release defect density **40–90%** but adds
**15–35%** to initial dev time — and the benefit concentrates in logic-dense code. So the platform mandates TDD **only
where the ROI is highest and the cost lowest**: pure logic.

**Pure logic = a function with NO I/O, deterministic, whose output is a function of its inputs only** (no DB, network,
filesystem, clock, randomness, UI). For these, write the failing test first → make it pass → refactor (red→green→refactor).

Anything that touches I/O (DB/network/fs/clock/UI) ⇒ **test-alongside** is enough (write the test in the same change, not
necessarily first). This is the platform's existing practice, kept.

> Retrofit rule: don't churn already-green code to add a test-first test. Apply TDD on the **next change** to a pure-logic
> unit, not as a backfill sweep.

## 2.5 — Prove the check can FAIL: mutation-test any gate you are going to trust

**A gate that has never failed is not evidence.** Added 2026-07-29 after the discipline had earned itself three times
in two days; folded in here rather than made a skill, because it is one rule and not a procedure.

> **When a green result is about to be believed — a new suite, an audit script, a security/confidentiality gate — break
> the specific mechanism the check exists to protect, and watch it go red. If it stays green, the check is measuring
> something else.**

This is the **deterministic** counterpart to `/behavioural-eval`'s "red-team a clean result" (that skill is scoped to
model-in-the-loop evals and excludes deterministic logic). The difference matters: there you *reason* about whether the
harness could have produced the number; here you can simply **delete the behaviour and re-run**, which is stronger and
takes minutes.

**Apply it to (in ascending order of how badly a false green hurts):**

| Target | The mutation to run |
| --- | --- |
| a new unit suite | make the function under test return a constant / do nothing |
| a rule-set with per-rule config (`applies`, severity, allowlists) | neutralise the config (`() => true`) — **this is the one that survives** |
| an audit/lint script | feed it an artifact that genuinely violates what it checks |
| a security or confidentiality gate | **plant a real instance of the thing it forbids**, confirm exit ≠ 0, remove it, confirm exit 0 |

**Measured, so the cost is known.** In one session: `always-return-empty` → killed (14 failures); `stop stripping
comments` → killed (1); **`replace the per-rule file-kind gate with () => true` → SURVIVED at 33/33** — every rule's
`applies` list was decoration and nothing asserted it. Separately, a leak gate reporting 0 hits was handed a planted
rulebook sentence and returned 11 hits, exit 1. Total cost: a few `sed` commands and four re-runs.

**Record the surviving mutant, not just the fix** — a mutant that survived is the one piece of evidence that the suite
had a hole, and it is what tells the next reader which part of the check was never real.

> Do **not** turn this into a coverage ritual or install a mutation-testing framework. It is a targeted question asked
> at the moment of trusting a green, on the mechanism that green is standing in for. Anti-ceremony (§7) still applies.

**Writing the suite for a hook or an audit script → §2.7**, which carries the required test shape, the sandbox recipe,
and the mutation traps (chief among them: a mutant that only *crashes* proves nothing).

**And point the same suspicion at the INSTRUMENT.** Added 2026-07-29 after four instances in a single session. §2.5 asks
whether the CHECK can fail; this asks whether the check RAN at all — a distinct failure, and the more common one:

> **"The harness did not run" must be a THIRD state, never folded into pass or fail.**

Measured, and note the directions, because there is no safe bias to assume:

| What happened | What it reported |
| --- | --- |
| a probe fed payloads to a hook saved as `*.mjs.proposed`; node refuses that extension, every case exited 1, and the probe scored "not 2" as ALLOW | **17 bypasses**, including every fix the change actually makes |
| `node --test test/` resolved `test/` as a module and failed to find it | `fail 1` — a resolution error as a failing test |
| a comparison `cd`'d before unzipping a RELATIVE path, so nothing was extracted | pandoc produces **0 headings, 0 images, 0 tables** — condemning the tool under evaluation |
| a generator created its output directory only inside its diagram loop | every document *without* a diagram failed on first write |

Once it invented catastrophe, once uselessness, once a test failure. **The guard is one line:** return an explicit
`ERR(exit)` for any exit code that is neither the expected success nor the expected failure, and confirm a runner
actually collected tests before believing its count. Cheapest version of all: before trusting a number, check that the
thing producing it did something at all.

## 2.6 — Verifying a write path: never against a record the user cares about

Added 2026-07-29 (idea-0018) from a dated incident, not a principle: a live `submit_review` check in `sakubun` wrote a
fake rating onto the user's **real** item and corrupted its FSRS schedule. It was recoverable only because that table
happens to be append-only.

> **A verification you cannot run on a sacrificial record is not a verification — it is a gamble on the schema being
> forgiving.**

| Situation | What to do |
| --- | --- |
| the write path works on a new record | create a **sacrificial record**, marked so it stays greppable (`__verify__` in a name field) → verify → delete. Deletion **idempotent** and in **reverse creation order** |
| the harness gives you a transaction | wrap and **roll back** — strongest form, free where available |
| only a REAL record can exercise it (a real schedule, streak, balance) | **stop and ask the human.** Cite this row rarely: reaching for it to avoid building a fixture turns the rule into permission |
| it already happened | record what was written **before** repairing, then replay rather than hand-patch |

**Not a permanent test account** — that is itself a [compliance risk (CSA)](https://cloudsecurityalliance.org/blog/2011/10/07/test-accounts-another-compliance-risk);
a short-lived record trades away no standing credential ([shape](https://microsoft.github.io/code-with-engineering-playbook/automated-testing/synthetic-monitoring-tests/) ·
[cleanup mechanics](https://www.thegreenreport.blog/articles/techniques-for-effective-test-data-cleanup-in-cicd/techniques-for-effective-test-data-cleanup-in-cicd.html)).
Prose, not a gate: *"this row belongs to a real user"* is in the intent, never in the artifact.

## 2.7 — Testing a repo guard (a hook or an audit script): the four-part shape

Added 2026-07-30 after writing **21 suites in one pass** (`plans/2026-07-30-tool-test-coverage.md`: 8/27 → 28/29 tools
tested). §2.5 says *mutation-test a gate you are going to trust*; this says **what a guard's suite has to contain** so
that mutation has something to bite on. It is here and not a skill because it is a contract plus a recipe, not an
interactive procedure — a guard's suite is written once per guard and read every time one is changed.

A guard is different from a function: its output is not a return value but a **triple — stdout, stderr, exit code** —
and it runs against *the real repo*. That makes four things testable, and all four are required:

| Part | What it asserts | Why it is not optional |
| --- | --- | --- |
| **① the silent path** | on input it must ignore: **exit 0 and NO output** | a guard that comments on everything gets muted, and then guards nothing. The quiet case is the one users experience |
| **② the acting path, asserted by MESSAGE** | the specific text/route it emits — never merely `exit !== 0` | exit codes are a 3-value alphabet; a crash and a correct block share one. Assert the sentence, and a crash can no longer pass for a catch |
| **③ ≥1 killed mutant** | break the mechanism, watch the suite go red (§2.5) | otherwise the suite's own value is unmeasured |
| **④ no repo mutation** | the guard left the working tree as it found it | a suite that writes into the repo it audits corrupts the thing under test and pollutes the operator's `git status` |

For ④ specifically: hooks in this repo honour **`HOOK_USAGE_LOG: "off"`** and reporters honour their own opt-out
(`--no-log`, `HEALTH_SWEEP_LOG=off`), so a suite sets those and then proves the tree is unchanged.

### Getting a guard under test at all (the sandbox recipe)

A guard reads the repo, so it must be pointed at a fake one. Which technique works is a property of **how the script
finds its root** — read that first, then pick the row. All five are in use (27 of 29 suites build a sandbox):

| How the tool locates the repo | The technique |
| --- | --- |
| `resolve(dirname(fileURLToPath(import.meta.url)), "..", "..")` | copy the script into `<tmp>/.claude/scripts/` (or `/hooks/`) so its *own* path lands inside the fixture |
| `resolve(".")` / relative paths | leave the script where it is and just set `cwd` |
| `argv[2]` as a root | pass the fixture path |
| `os.homedir()` (transcripts, `~/.claude/settings.json`) | redirect **`HOME`** in the child env — 4 suites do |
| real git state (ahead/behind, rename detection) | a real `git init` + backdated commits + a **bare** remote + a second clone as "another machine" (`git init -b main` — a bare repo without it leaves the clone with nothing checked out) |

### The law that cost the most: a mutant that only CRASHES proves nothing

Hit **5 times in that one pass, in 3 different mechanisms.** The failure is silent and self-congratulatory: the patch
unbalances a paren or hits a TDZ, the mutant dies on load, the probe sees "not the normal output" and records
**"mutant killed"** — and the suite is green having tested nothing. It is the worst available failure in the one
mechanism whose entire job is proving a check *can* be wrong.

> **Every mutation must assert the mutant still RUNS before its probe is believed** — an explicit exit-0 (or
> expected-code) sanity gate, per §2.5's "point the same suspicion at the instrument".

And mutate in the shape least likely to crash:

- **Redirect a side-effect instead of falsifying a condition** — `findings.push(…)` → `[].push(…)` keeps every
  binding live; `if (false)` falls through to code that then dereferences a null.
- **Replace a whole balanced expression / whole `new Set([...])`,** never a fragment — a fragment edit is how parens
  end up unbalanced.
- **Anchor the patch on code, not on the comment that explains it** — a docstring often contains the flag verbatim and
  gets patched instead (happened with `--name-status -M`).
- Then re-run: **the mutant must still produce a normal-looking run**, only a wrong one.

### Two more findings worth the same suspicion

- **The equivalent mutant.** A "protection" that cannot be observed: a fast path, a redundant flag, a coercion that
  already does the job (`null < 30` is `true`, so a null-age guard is unobservable unless *both* layers are mutated;
  `-M` is a no-op because git ≥2.9 detects renames by default). Five such were documented. The comment claiming the
  protection is not evidence the protection exists — **only a killed mutant is.**
- **"Assert the repo is clean" is the wrong guard for ④.** It failed **three times on other people's legitimate work**
  (a parallel session writing a memory; this very wrap writing ledger entries). Take a `git status --porcelain`
  **snapshot before and after** and compare — that asserts *the guard changed nothing* without asserting *nobody else
  is working*. A guard that fails on legitimate work is a guard that gets skipped.

### Declaring what is NOT covered (so a gap can be argued with)

Full coverage is not the goal (§7: no coverage-percentage target) — **a silent gap** is what is forbidden. Two devices,
both in `tool-check.mjs`:

- **A declared exemption** carries a written reason with an enforced minimum length (`EXEMPT_MIN_REASON = 40`, exit 1
  if shorter) and a **stale-exemption check** (an exemption naming a file that no longer exists is a warning). One
  exemption stands today: `eval-ledger-rule.mjs` — a model-in-the-loop eval whose result is non-deterministic *and*
  billable. *A declared gap is a gap you can argue with; a silent one is not.*
- **A declared backlog with a baseline.** A new detector that would fire on known debt reports a note and fires only
  when the number **RISES** (`recurrence-check.mjs` D4: `BASELINE = 11` unguarded mutation loops, dated in the code).
  A checker that is red on day one is a checker someone turns off; the baseline exposes the debt for subtraction while
  still catching the next violation. Lower the baseline as each is fixed. **Set that number from the tool, never by
  eyeballing output** — mine was off by two.

## 3 — Acceptance criteria: the spec→test bridge (SDD-lite)

The platform's `/idea → proposal → /project-plan` spine is already a proto-spec. This standard adds the missing structured
layer **without a parallel tool** (no Spec-Kit/Kiro): write acceptance criteria *in the proposal/plan you already author*.

- **Format: Given / When / Then.** `Given <context>, When <action>, Then <observable outcome>`. Implementation-agnostic,
  readable by a non-coder, and each one is directly testable.
- **Rule: 1 acceptance criterion → 1 named test.** An AC with no test is a visible gap, not prose. A plan step's `Test:`
  field references the AC id it satisfies (e.g. `Test: AC-3 (streak grace day)`).
- **Gate by change size** (Fowler's caveat): a `feature`/`system-change` writes ACs; a `fix`/`chore`/small same-session
  change is exempt — don't spec a typo fix.
- ACs live in the proposal/plan templates (`/project-plan templates/`), so there is **no new artifact** to keep coherent.

## 4 — Cross-repo contract testing (the multi-team guard)

Independent repos already call each other over HTTP (todo↔core patterns, web↔core, MCP servers). Nothing today verifies the
two sides still agree — only a human notices a break. As repos/teams multiply this is *the* failure mode.

- **Consumer-driven contract testing:** the **consumer** declares what it expects of a provider's API (shape, fields,
  status codes) as a contract; both sides test against it. A provider change that breaks the contract fails CI, not prod.
- **Start fixtures-first (no broker):** a plain contract fixture checked into the consumer repo + a CI check that the
  provider honours it. This is enough for one team owning both sides.
- **Defer a Pact Broker** until **≥2 independent teams** own the two sides of a seam (revisit trigger — not now). Template
  + how-to: `registries/shared-assets.md` (contract-test template).

## 5 — The gates that make tests a guardrail (already in place — reused, not rebuilt)

- **CI test job before build:** `build: needs: test` in `deploy.yml` — a red test blocks the image build/deploy. The NUC
  still only PULLs (tests run in GitHub Actions). Template: `/vitest-server-actions` §CI.
- **`/verification-before-completion`:** no "done"/"passing" claim without fresh test output pasted. The Iron Law already
  enforces "evidence before claims".
- **`/project-plan` step `Test:` → AC id:** ties each executable step back to the spec it satisfies.
- **pre-commit hook:** nudges (non-blocking) when code changes without docs/tests.

## 6 — Scaling to many people + many machines/repos

- A new contributor inherits **one doc (this) + the templates + the skills** — no tribal knowledge.
- A new repo copies the CI test job (`/vitest-server-actions` §CI) + the contract-test template (`08`) on onboarding
  (`/app-onboard`).
- ACs make a change **legible across people**: a reviewer reads the Given/When/Then, not the author's assumptions
  (Spec-Kit's "a clear spec aligns everyone; different developers make conflicting assumptions").

## 7 — What is explicitly NOT required (anti-ceremony guards)

- No ACs for fixes/chores/small same-session changes.
- No test-first outside pure logic.
- No coverage-percentage target.
- No Pact Broker / heavy contract infra under one team.
- No backfill sweeps (retrofit on next touch) — **except** the one class §2.7 covers: a **repo guard** is backfilled,
  because an untested guard is not neutral like untested app code. It is actively misleading — it reports green while
  guarding nothing, and everything downstream trusts that green.
- §2.7's four-part shape applies to a **guard** (a hook / an audit script that gates or reports on the repo), not to
  every script. A one-shot generator or a throwaway is out of scope; declare it exempt with a reason (§2.7) rather than
  writing ceremony for it.

> The litmus: this standard should make a multi-person/multi-repo platform *safer to change*, never make a solo change
> *slower for ceremony's sake*. If a rule here is costing more than it protects at the current scale, flag it (the same
> counter-case the proposal carries) — trigger-gate it, don't blanket it.
