# Native instruments + reconciliation — 2026-08-01

**What this is.** Batch 0 of `platform/plans/2026-08-01-harness-upgrade.md`: the instrument pass that runs *before*
anything is changed, because the audit it extends was scored against a smaller vendor surface than exists. Every
number here was read from a tool on 2026-08-01 on `TNT-Laptop`, not recalled. Where a figure could only come from an
interactive slash command the agent cannot invoke, it says **user-owned** rather than guessing.

It also carries the part the plan could not: **a reconciliation against what already shipped.** The plan was drafted
on 2026-07-31 from the *original* rows of `2026-07-31-harness-reexamination.md`, and several of those rows were
retracted or refuted **the same day**. Executing the plan verbatim would re-do finished work and, in one case, do
active harm. That case is §5.1.

---

## 1. `/context` — captured verbatim (Batch 0.1, the half the agent can read)

Session on `claude-opus-5[1m]`, 627.5k/1M tokens.

| Category | Tokens | Note |
|---|---|---|
| System prompt | 5.2k | vendor |
| System tools | 22.3k | vendor |
| MCP tools (deferred) | 16.2k | **loaded on demand — see below** |
| System tools (deferred) | 14.8k | idem |
| Custom agents | 103 | `reviewer.md`, the only one |
| **Memory files** | **9.9k** | `CLAUDE.md` 4.7k + `CLAUDE.local.md` 2.3k + `.claude/memory/MEMORY.md` 2.9k |
| **Skills** | **6.6k** | 48 entries: **33 project** + 15 built-in |
| Messages | 583.3k | the session itself |

**Five things this measures that no fleet tool reports:**

1. **The always-loaded governance surface is 9.9k tokens, not 4.7k.** Every prior measurement of "how fat is the
   always-on instruction layer" was taken on `CLAUDE.md` alone. `agnix` called `CLAUDE.md` 2.6× a third party's
   1,500-token limit; the honest multiple for what actually loads every session is **6.6×**. This does not mean
   `CLAUDE.md` should shrink further — `L1` established a structural floor of ~1,700 words — it means the *number
   fleet quotes about itself* was measuring one of three files.
2. **MCP tool schemas cost 0 tokens here.** `46 tools · 0 tokens`, deferred. This is **F-new-4 proven by direct
   measurement on this machine** rather than by quoting a doc page. The corollary is narrow and must not be
   over-read: the *session-start* cost of an MCP server is gone; the per-call `ToolSearch` round trip is not.
3. **`deep-research` is listed among the skills, and it is a workflow.** `.claude/workflows/deep-research.js` is
   fleet-authored ("Ported from bughunter architecture"), 5 phases, adversarial 3-vote verification. So the claim
   that fleet has never used dynamic workflows is **false** — see §5.4.
4. **The custom-agent tier costs 103 tokens.** `A4`'s downgrade said "keep `reviewer`, add nothing"; this is the
   price of the thing that was kept, and it is nothing. The argument against adding more was never cost.
5. **What `/context` cannot tell us, and the agent cannot run:** `/doctor`, `/hooks`, `/mcp`, `/usage`.
   **User-owned** — the exact commands are in §7.

## 2. Auto memory — measured, and the plan's headline finding does not survive it (Batch 0.2)

The plan calls F-new-1 *"the most important finding in this plan"*: that fleet runs **two** memory systems and
governs only one, with an uncommitted self-written instruction file loading into every session unreviewed.

**Measured:**

| Fact | Value |
|---|---|
| `~/.claude/projects/C--project-fleet/memory/` | **does not exist** |
| `autoMemoryDirectory` (`.claude/settings.local.json`) | `C:\project\fleet\.claude\memory` — the **committed** tier |
| `autoMemoryEnabled` | unset anywhere ⇒ default (on) |
| Foreign auto-memory dirs still on this box | `C--project-miniserver-platform-yakudoku/memory` (5 files, **12.7KB, last written 2026-06-20**) and `C--Users-trann/memory` (**empty**) |

**So there is one tier, not two, and it is the curated one.** fleet did not merely avoid the second system — it
**redirected the vendor's auto-memory rails at its own git-synced directory**, and then wrote
`.claude/hooks/memory-wiring-check.mjs` (SessionStart) which reads all three settings layers in precedence order and
complains if `autoMemoryDirectory` is unset, points elsewhere, or is disabled, plus enforcing the 200-line/25KB load
cap and naming memory files the index never references.

**F-new-1 as written is false, and the direction of the error is the one to be suspicious of:** it accused fleet of
the exact sin fleet's constitution is built around, which is a satisfying finding to write and was never checked
against the hook sitting in the same directory. `memory: check-prior-decisions-early`, fourth instance in this plan
family.

**What genuinely remains of it, and it is small:**

- **`.claude/agent-memory/<agent>/MEMORY.md` is a different tier** and `memory-wiring-check` does not know about it.
  `reviewer.md` sets no `memory:` key, so nothing is accumulating — but nothing would report it if it were.
- **The stale `yakudoku` tier** (12.7KB, June) is outside every fleet instrument. It is not loaded into fleet
  sessions, so it is litter, not a governance hole. `CLAUDE.local.md` already records that the equivalent
  `miniserver-platform` directory was deleted 2026-07-30; this one was missed because it carries the app's name.
- **`usage-census` still does not report auto-memory size** — true, and worth a line, but the wiring check makes it
  a reporting gap rather than an unreviewed instruction surface.

**Consequence for Batch 1.1:** the "keep-and-declare vs disable" decision the plan calls blocking is **already made
and already correct on this box**. What is left is a much smaller question, and it is in §7.

## 3. The 58-row checklist — re-scored deltas only

Unchanged rows are not restated. Fifteen rows moved since `harness-reexamination` closed on 2026-07-31.

| # | Practice | Was | Now | Evidence |
|---|---|---|---|---|
| 2 | CLAUDE.md ≤200 lines | uses (184) | **uses (157 lines / 1,766 words), now GATED** | `claude-md-budget.mjs`, 1766/1800 |
| 3 | `@path` imports | missing | **missing** — 0 matches, measured | `grep -c '^@' CLAUDE.md` |
| 5 | `.claude/rules/` + `paths:` | misaligned (1) | **misaligned (1)** — `frontend.md` only | `ls .claude/rules/` |
| 8 | ~30 hook events | misaligned (4 of ~30) | **misaligned (5 of ~30)** | `SessionStart · UserPromptSubmit · PreToolUse · PostToolUse · Stop` |
| 9 | Blocking `Stop` gate | **missing** | **uses** | `verify-claim-gate.mjs`, A2, 8-block override documented in-file |
| 12 | `UserPromptSubmit` | **missing** | **uses** | `tree-moved-notice.mjs`, A6 |
| 16 | `FileChanged` | missing | **correctly-absent** | proven it can neither speak nor block (A6) |
| 26 | `disable-model-invocation` | **missing (0/38)** | **uses (6/38)** | frontmatter parse, not grep |
| 28 | ~~`allowed-tools`~~ | missing | **uses the correct field: `disallowed-tools` (4/38)** | A5; and see §5.1 |
| 31 | ≥3 evaluations | **missing (0)** | **uses (3)** | `eval-ledger-rule` · `eval-plan-execution-gate` · `eval-verification-claim` |
| 34 | `.claude/agents/` | misaligned (1) | **misaligned (1), deliberately** | A4 downgraded on measurement: 65/65 Agent calls already pinned `subagent_type` |
| 42 | `/context` as a written check | missing | **uses** | it caught A1's missed skill; procedure recorded in `/skill-authoring` |
| 46 | `claude plugin validate --strict` | **missing** | **uses — both manifests pass** | run 2026-08-01: marketplace ✔, plugin ✔ |
| 54 | Code execution with MCP | correctly-absent | **correctly-absent, premise sharpened** | 46 MCP tools at 0 tokens — the cost it economised is already gone |
| 22 | SKILL.md length | source-dependent | **still source-dependent** | C4 open; the cap fleet follows is still undeclared |

**One row that silently repaired itself and deserves naming.** `agnix` found **10 of 38 SKILL.md frontmatters
unparseable** by a strict YAML parser (an unquoted `: ` inside a plain scalar), cross-confirmed by a second
independent parser. Re-measured today with the `yaml` package: **0 of 38 fail.** The fix landed; the interesting
part is that Claude Code's lenient parser meant this defect had **no symptom on this machine** in either direction —
it was invisible when broken and is invisible now that it is fixed. Only an outside instrument could see it, which
is the single strongest piece of evidence either plan produced for Track B.

## 4. The twelve F-new surfaces — verdicts (AC-1)

Vocabulary as required: `uses · misaligned · missing · correctly-absent`.

| # | Surface | Verdict | Basis |
|---|---|---|---|
| F-new-1 | Auto memory / agent memory | **uses** (redirected + hook-verified). Residual: agent-memory tier unchecked | §2 |
| F-new-2 | Dynamic workflows | **uses, partially** — 1 fleet-authored workflow; no `workflowSizeGuideline`, no measured fan-out, **and `.claude/workflows/` is absent from the governance prohibition list** | §5.4 |
| F-new-3 | Worktrees + `.worktreeinclude` | **missing** — the *detector* shipped (A6), the *prevention* did not | `ls` → no `.worktreeinclude` |
| F-new-4 | Deferred tool schemas | **uses** (vendor-side, free). The generalisation "so fleet needs no MCP" is **void as stated** | 46 tools · 0 tokens |
| F-new-5 | Plugin distribution surfaces | **missing** — no `relevance`, no `dependencies`, no hints; **5 fleet-only paths leak into the shipped plugin** | §6 |
| F-new-6 | `output-styles/` | **correctly-absent** — fails the ADOPT bar, no named failure | plan's own admission |
| F-new-7 | `agnix` | **uses, as a one-off; standing check REFUSED with a written trigger** | `community-harness-mining` Batch 2 — and this contradicts upgrade 4.1 |
| F-new-8a | `/usage` by skill/subagent | **user-owned** — cannot be read by the agent | §7 |
| F-new-8b | `advisor` | **missing** | no `advisor` config anywhere |
| F-new-8c | statusline | **missing** | no `statusLine` key in either settings file |
| F-new-8d | `/doctor` `/hooks` `/mcp` | **user-owned** | §7 |
| F-new-8e | channels · routines · scheduled-tasks | **correctly-absent**, revisit trigger *NUC back up* | `INVENTORY §0`: host down since 2026-07-22 |

## 5. Reconciliation — what the plan asks for that is already done, refuted, or moot

### 5.1 Batch 2.2 must NOT be executed as written — it would grant permissions, not restrict them

The step reads: *"`allowed-tools` on the read-only skills (**A5**) — `/host-audit` … cannot currently keep that
promise. `/app-protect`, `/app-env` touch auth and secrets."*

**`allowed-tools` is a permission GRANT**: the vendor's frontmatter reference defines it as tools Claude may use
**without asking permission** during the turn that invokes the skill. Executing this step verbatim would add
**blanket pre-approval** to the three skills that touch auth and secrets, while believing it was restricting them.
This was caught on 2026-07-31, the correct field (`disallowed-tools`) shipped on four verified-read-only skills, and
the lesson is in the ledger index (*"Read a config field's SEMANTICS, not its name"*). **The plan predates the
correction and reproduces the error.** Marked refused in the plan file, not silently dropped.

### 5.2 Already shipped — no action

| Step | State |
|---|---|
| 2.1 `disable-model-invocation` | **DONE** — 6 manual-only, verified against `/context` (the first pass missed `/app-env`, the only one that writes secrets) |
| 3.1 blocking `Stop` hook | **DONE** — `verify-claim-gate.mjs`; `/goal` deferred as session-scoped |
| 3.2 `FileChanged` hook | **REFUTED then shipped differently** — the event carries no `additionalContext` and its exit 2 blocks nothing; `tree-moved-notice.mjs` (Stop + UserPromptSubmit) does the job |
| 2.6 CLAUDE.md → ≤800 words | **REFUTED** — the ≤800 target was itself eyeballed; the floor is ~1,700 (16 prohibitions may never leave, task-shaped rules have no `paths:` glob). Now 1,766 with a gate |
| 0.4 `agnix` baseline | **DONE** 2026-07-31 — 42 errors / 50 warnings / 1 info, triaged, `--fix` never run |
| 5.2 `plugin validate --strict` | **DONE** today — both manifests ✔ |

### 5.3 Batch 2.4 (three agent definitions) contradicts a measurement

`A4` was **downgraded before building** on evidence from all 77 transcripts on this box: **65 Agent calls, 100%
already pinned `subagent_type`**, 75% also pinned `model`. The residual defect is narrower — 51 of 65 went to
`general-purpose`, which carries every tool — and the built-in **`Explore`** agent already covers the read-only
research case and was used 13×. Writing `researcher`/`verifier` files that duplicate built-ins is the `commons`
failure (27 proven items, **0 installs**) under a new name, against a FOMO brake in `CLAUDE.md` that forbids exactly
this. **Verdict: keep `reviewer`, add nothing.** What survives is a *routing* habit, not an artefact.

### 5.4 Batch 1.2 and 6.1 are moot — the orchestrator does not exist

The plan calls fleet's PowerShell `closed-loop-driver` / `/auto-pilot` *"that error's largest surviving
instance"*, makes it one of two blocking Batch-1 decisions, and names it first among Batch 6's three cut candidates.

**Measured:** no `auto-pilot` skill (38 skills listed, none), no scheduled PowerShell wrapper under
`.claude/scripts/` — the script the 2026-06-18 plan's `related:` block points at is simply gone (the
only `.ps1` files under `.claude/` and `platform/` are `app-env.ps1`, two one-shot rename helpers in `proposals/`,
and one file inside `attic/`), no `platform/automation`, no queue directory, no `current-ask.json`. The plan
`2026-06-18-closed-loop-driver.md` is `status: superseded`. **It was already retired.**

This matters beyond one step: Batch 6's symmetric R3 check (*"if Batch 6 retires nothing, re-run it"*) names three
candidates, and the first is gone, the third (**the zero-consumer MCP server**) was **already re-targeted to a
plugin hook** — `idea-0023` records the Phase-3 verdict and the B′ re-target, with *"nothing left to build"*. So the
mandatory cut has exactly **one live candidate left: `commons`.**

And the honest inversion: fleet has been cutting. What the plan reads as backlog is, in three of three named cases,
work already finished. The operator's *feeling* of being stuck is real; the mechanism it was attributed to is not.

### 5.5 A second hole in the governance prohibition list, found the same way as the first

`CLAUDE.md`'s 13 protected surfaces name `.github/workflows/` — the CI directory — and **not
`.claude/workflows/`**, which holds JavaScript that spawns subagents (capped at 16 concurrent / 1,000 per run) with
a tool set the script chooses. That is a strictly larger capability grant than several surfaces the list does
protect, and it is the same shape as the `agents/` hole found on 2026-07-31 by trying to obey the list.

**PROPOSED, NOT EDITED** — `CLAUDE.md` is on the list it belongs to. One phrase; a human decides. §7.

## 6. What is genuinely open, measured, and in order

| # | Item | Effort | Blocked on |
|---|---|---|---|
| 1 | `.worktreeinclude` + the documented parallel-session path (F-new-3, **prevention** before the detector fleet already has) | XS | nothing |
| 2 | Purge the **5 fleet-only paths** from the shipped plugin: `hooks/check-file.mjs:5`, `lib/check-component.js:4`, `rules/frontend.rules.js:4,6`, `README.md:35` | XS | nothing |
| 3 | `plugin-relevance` + `plugin-dependencies` on `rulebook-frontend` (F-new-5) | S | nothing |
| 4 | `version:` in 38 skill frontmatters (C5) — measured: **0 of 38**; the field that decides whether a consumer ever receives an update | S | it is `skills/**` ⇒ governance |
| 5 | statusline (F-new-8c) — the cheapest item in the plan | XS | it is `settings.json` ⇒ governance |
| 6 | `.claude/workflows/` → the prohibition list (§5.5) | XS | it is `CLAUDE.md` ⇒ governance |
| 7 | `workflowSizeGuideline: small` + one fan-out workflow with **measured** cost vs the conversational baseline (AC-5) | M | nothing, but see the note |
| 8 | `commons` — 27 items, 0 installs: install one or stage it. **The last live candidate for the mandatory cut** | M | a decision |
| 9 | C4 — declare which skill-length source fleet follows | XS | a decision |
| 10 | `ranServe` — the eval fixture specified 2026-08-01 and deliberately unbuilt | M | nothing |

**Note on item 7.** fleet already has a workflow, so the *capability* question is settled and only the *economics*
question is open. The honest experiment is not "can a workflow do a sweep" but "does it cost less than the sweep
does in conversation" — and a workflow that costs more and finds nothing more is to be reported as a refusal.

## 7. The user-owned half — four commands and two decisions

**Commands the agent cannot run** (interactive slash commands). Paste the output and Batch 0.1/0.3 close:

```
/doctor      # native equivalent of harness-drift-check + memory-wiring-check
/hooks       # native view of the 16 hooks, to diff against tool-catalog
/mcp         # confirms the deferred-schema story from the client side
/usage       # the SECOND instrument: skill/subagent/MCP breakdown vs usage-census
```

`/usage` is the one with real evidential value: `usage-census`'s own LIMITS block says its numbers are a floor, and
principle 5 of the plan is *two instruments beat one, and a disagreement between them is the finding.*

**Decisions, both smaller than the plan states:**

1. **Auto memory (was Batch 1.1, "blocking").** Not a keep-vs-disable choice — §2 shows the wiring is already
   correct and hook-verified. What is left: delete the stale `yakudoku` auto-memory directory (12.7KB, June, litter),
   and decide whether `memory-wiring-check` should also learn about the `agent-memory` tier.
2. **Track B's second subscription (Batch 4.2).** The plan proposes installing the Context7 plugin to answer the
   docs-currency contradiction (`mcp-builder` forbids vendored doc snapshots; `react-ui-craft/references/motion.md`
   **is** one). The plan also names the boring alternative in its own falsification clause. Recommended:
   **do the boring fix first** — date the vendored snapshot and add a staleness check — because the free-tier cut to
   ~1,000 requests/month, a third party in the query path, and the FOMO brake all point one way, and the boring fix
   is a precondition for judging the plugin anyway.

## 8. Two things this pass got wrong about itself, recorded because they are the pattern

1. **The plan's headline finding was its weakest.** F-new-1 was labelled *"the most important finding in this
   plan"* and is false as written, for a reason that recurs: it accused fleet of a sin fleet is organised around,
   and the disproof was a hook file in the same directory, never opened. Fourth instance in this plan family of
   *researching a solved problem*; the previous three are recorded in `harness-reexamination` (A3, L1, L2).
2. **Twelve newly-discovered surfaces is not twelve gaps.** Re-scored: **2 uses · 1 uses-partially · 4 missing ·
   2 correctly-absent · 3 user-owned**. The plan's own *Decisions to distill* predicted this trap — *"a longer list
   is the cheap appearance of rigour"* — and it was right to.
