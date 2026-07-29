---
title: Proposal — a rule for verifying a live write path without touching a real user's data (+ the model-in-the-loop routing row, folded)
kind: system-change # edits platform/standards/testing.md, which became governance 2026-07-29 → propose-only
status: draft # draft → accepted → rejected | superseded
created: 2026-07-29
related:
  [
    platform/registries/idea-queue.md (idea-0018 — top-1 after the 2026-07-29 sort, rank 6.05; idea-0020 folded here),
    platform/standards/testing.md (the file this edits — 138 lines, §1 pyramid + §2.5 mutation),
    platform/registries/knowledge-ledger.md (the 2026-07-06 sakubun incident this codifies),
    .claude/skills/behavioural-eval/SKILL.md (already exists — the reason idea-0020 shrank),
  ]
---

## Problem

**In plain language: proving that "saving works" is currently allowed to damage the thing being saved.**

On 2026-07-06 a live verification of `submit_review` in `sakubun` wrote a **fake rating onto the user's real item**
「中」, corrupting its FSRS schedule. Recovery worked only by luck of schema: `ReviewLog` happens to be append-only, so
the injected rows could be deleted and the rest replayed through `ts-fsrs`. **An app without an append-only log would
have lost the data.**

That lesson was written into the knowledge ledger scoped **platform-wide** — "every app with user state / any live
verification" — and then never became a rule. `platform/standards/testing.md` is the canonical routing doc, and a grep
for `sacrificial` / `fixture` / `seed` / `production-data` returns **nothing**. Four apps (`todo`, `journal`,
`yakudoku`, `sakubun`) have user-writable state plus a live/MCP verification step, and **not all of them have an
append-only log to recover with.**

There is a second, smaller hole in the same file, folded in here (see §Fold): nothing routes *"does the calling model
handle this tool result correctly"* to the skill that already exists for it.

## Prior art & sources

- [Microsoft — Code-With Engineering Playbook, *Synthetic Monitoring Tests*](https://microsoft.github.io/code-with-engineering-playbook/automated-testing/synthetic-monitoring-tests/)
  — a synthetic test injects behaviour using **synthetic data and dedicated testing accounts**, then validates the
  effect. Confirms the shape: the verification is real, the *subject* is not. **Avoid:** reading it as "so make a test
  account" — see the next source, which contradicts exactly that.
- [Cloud Security Alliance — *Test Accounts: Another Compliance Risk*](https://cloudsecurityalliance.org/blog/2011/10/07/test-accounts-another-compliance-risk)
  — **cuts against the obvious fix.** The preferred practice is test accounts **only** in test/staging, *never* in
  production; if one must exist there, least privilege. So "create a permanent test user in prod" trades a data-corruption
  risk for a standing-credential risk. This is why the rule below is built on a **short-lived record**, not a persistent
  identity.
- [The Green Report — *Techniques for Effective Test Data Cleanup in CI/CD*](https://www.thegreenreport.blog/articles/techniques-for-effective-test-data-cleanup-in-cicd/techniques-for-effective-test-data-cleanup-in-cicd.html)
  — three mechanics worth stealing verbatim: cleanup must be **idempotent** (tolerate an already-deleted record),
  deletion follows **reverse creation order** (children before parents), and a **transaction rollback** is the strongest
  form where the harness allows it. **Avoid:** its assumption of a disposable CI database — the case here is a live app
  with one real user, where rollback is often not available.

**In-repo (binding):** `standards/testing.md` §2.5 already establishes the house pattern for this kind of rule — a short
prose rule plus a *"what to run"* table, no framework, no new tooling. This proposal follows that shape rather than
inventing a second one.

## Options considered

| | Option | Benefit | Cost / drawback |
| --- | --- | --- | --- |
| **A** | **A short §2.6 rule + a 4-row technique table, in the §2.5 shape** *(khuyến nghị)* | Reaches all 4 apps at once; costs one human commit; matches a section pattern already proven to get followed; names the escape hatch (`sacrificial record`) so the honest path is also the easy one | It is prose — nothing enforces it. Relies on the standard being read |
| B | A shared helper package (`@thiengthb/test-fixtures`) with `withSacrificialRecord()` | Executable, not advisory; one implementation to review | Rule-of-three is **not met** (this pattern has been *needed* 1× and *wanted* 3×, never built twice), so `/code-reuse` forbids extracting it; each app's schema differs enough that the helper would be mostly per-app anyway |
| C | A hook/gate that blocks a live verification against a record it did not create | Actually enforced, in the spirit of `enforce-rules-with-gates` | The agent cannot see "is this record real?" from a tool call — the decision lives in intent, not in the artifact. This is the *unenforceable* half of the rulebook by construction (idea-0023's Step 0 measured exactly this distinction) |
| D | Do nothing — the ledger line already exists | Zero cost | The ledger is the *archive*; `testing.md` is what a session reads when deciding how to test. A lesson filed where nobody looks at decision time has already failed once |

## Recommendation

**Option A (khuyến nghị).** Add **§2.6 — "Verifying a write path against live data"** to `standards/testing.md`, in the
same shape as §2.5: one short rule, one table of what to actually do, no new tooling.

The rule, in plain language: *if a check has to write, it writes to a record you created for the purpose and then remove
— never to a record the user cares about. If you cannot create one, you do not have a verification, you have a gamble.*

Four rows, drawn from the sources and from what actually happened:

| Situation | What to do |
| --- | --- |
| The write path can be exercised on a new record | Create a **sacrificial record** (marked, e.g. `__verify__` in a name field), verify, delete. Deletion is **idempotent** and in **reverse creation order** |
| The harness offers a transaction | Wrap and **roll back** — the strongest form, and free where available |
| Only a real record can exercise it (a real schedule, a real streak) | **Stop and ask the human.** Do not proceed on the assumption that recovery exists — `sakubun` recovered by luck of an append-only log |
| It already happened | Record what was written *before* attempting repair; replay rather than hand-patch where an append-only log exists |

Why A over C, stated plainly because C is the option this platform's instincts would reach for: **a gate needs to see
the violation in the artifact, and "this row belongs to a real user" is not in the artifact.** That is the same dividing
line idea-0023 measured — a rule that shapes what you *do* must be transmitted, because it leaves no trace to check
afterwards. Writing it as prose is not laziness here; it is the only tier that can carry it.

### Fold: idea-0020 rides along, or does not — your call

`idea-0020` asked for a model-in-the-loop eval rule in the same file. **Its evidence has gone stale**: it claims
`testing.md` has "zero mention of model-in-the-loop or eval", which was true on 2026-07-17 and is not now — the
`/behavioural-eval` skill exists and §2.5 cites it by name. What is genuinely missing is **one row in the §1 pyramid**:

| Tier | What it covers | Test-first? | Technique / skill |
| --- | --- | --- | --- |
| **Model-in-the-loop seams** | Whether the *calling model* handles a tool result / a rejected argument correctly — paraphrasing, reordering, dead-ends. A contract test checks the shape; this checks the behaviour | no | `/behavioural-eval` |

Both are one-row additions to one governance file needing one human commit, so folding is cheaper than two rounds.
**Accepting A can mean "A only" or "A + the fold" — say which.**

## Pre-mortem

- **It gets written and never read.** Most likely failure by far. The standard is 138 lines today; every addition raises
  the odds the next section is skimmed. *Mitigation:* §2.6 stays under ~15 lines and lives immediately after §2.5, which
  is already the section sessions land on when they ask "how do I prove this check works". If it grows past that, it has
  become a different document and should be cut.
- **The escape hatch becomes the default.** "Stop and ask the human" is the row someone will reach for to avoid the work
  of building a fixture. *Mitigation:* it is scoped to *"only a real record can exercise it"*, and the row above it makes
  the cheap path (create → verify → delete) the obvious one. Worth re-reading at the next audit: if that row is being
  cited often, the rule is being used as permission rather than as a limit.
- **A sacrificial record leaks into user-visible state.** A marked row that the delete step misses shows up in a list, a
  count, or an export. *Mitigation:* the marker is required precisely so it is greppable afterwards, and deletion is
  specified idempotent so a re-run finishes the job. The residual risk is real and not designed away.

## Counter-case

**The strongest argument against: this is one incident, three weeks old, in one app, and it is already written down
twice** — the knowledge ledger and that app's decision log. Adding a third home for it is exactly the "too much
machinery per unit of shipped value" disease this platform named on 2026-07-28. A solo operator who has already been
burned once does not forget it.

The answer is that the ledger is an *archive* — read at wrap-up, not at decision time — and `testing.md` is what gets
read *while deciding how to test*. The lesson has already failed the only test that matters: it existed, in writing,
scoped platform-wide, and did not change what the next session would do. **But if you judge that a fourth app hitting
this is unlikely enough, "reject — the ledger is enough" is a defensible answer, and cheaper than this proposal.**

A second honest deduction: RICE put this at 6.05 partly on **reach 3** (four apps). Only `sakubun` has actually been
bitten. If reach is really 1, the base drops to ~1.8 and this is no longer the top of the queue.

## Decision (human) — the human-accept gate

**This is the human-accept gate of `/idea` → `/project-plan` (propose-don't-execute).** Accept ⇒ I write the `.proposed`
drop-in for `standards/testing.md` and you commit it (that file became governance on 2026-07-29, so the agent may not
install it). Reject with a reason ⇒ idea-0018 goes `deferred`/`dead` and the reason becomes Reflexion memory that biases
future gap-analysis. No response is **not** approval.

- **Decision:** _(supervisor — accept A only · accept A + the idea-0020 fold · reject (reason) · deferred (until …))_
- **Date / by:**
- **Why:**
