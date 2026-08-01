---
title: Harness upgrade — align fleet to the July-2026 vendor surface, retire what the vendor now owns, and make rulebook shippable
kind: system-change
status: active # accepted by the supervisor in chat 2026-08-01 ("hãy tuân thủ và làm theo plan này"); drafted 2026-07-31
created: 2026-07-31
updated: 2026-08-01
checkin: 2026-08-14 # the date Consequence 1 evaluates — runbook at the bottom
checkin_owner: agent
related:
  [
    platform/reports/2026-08-01-native-instruments.md (Batch 0 — the measured state THIS plan is reconciled against),
    platform/plans/2026-07-31-harness-reexamination.md (the F-series + the 58-item Anthropic checklist this extends),
    platform/plans/2026-07-31-community-harness-mining.md (the C-series; the artefact-only sourcing rule this adopts),
    platform/standards/autonomy-contract.md (propose-don't-execute for governance),
    platform/standards/testing.md (§2.5 mutation, §2.7 a test per mechanism),
    .claude/memory/weigh-outside-practice-symmetrically.md (the bias this plan is most likely to repeat),
    .claude/memory/user-edits-files-concurrently.md (the failure F-new-3 prevents rather than detects),
    .claude/memory/verify-end-state-not-upload.md (the failure F-new-2's verifier stage addresses),
    .claude/scripts/sprawl-check.mjs (the brake whose baselines several steps here must lower),
    .claude/scripts/usage-census.mjs (the instrument F-new-9 gives a second opinion to),
  ]
---

<!--
  Written by the beneficiary of every change it proposes. That is the standing conflict of interest in this file
  (memory: weigh-outside-practice-symmetrically; CLAUDE.md hard prohibition on self-approving governance).
  Two structural defences, both mandatory: (1) every item names a fleet failure or a measurement, never a
  preference; (2) the pre-committed consequence in `Approach` has a falsifiable outcome that CANCELS work, and
  it was written before Batch 0 ran. Everything under `.claude/**` here is a diff for the supervisor to commit.

  PERSISTENCE NOTE, 2026-08-01: this plan existed ONLY in a chat message until today — `grep` for `F-new-1`
  across the repo returned nothing. A plan that is not on disk dies at the next compaction, which is the exact
  failure `/project-plan` exists to prevent. Persisted verbatim, then reconciled below rather than rewritten:
  the record of what was proposed and refused is worth more than a tidy file.
-->

## The ask, verbatim

> "nếu phải cập nhật lại fleet thì chiến lược của bạn là gì… bạn là trọng tài, điều bạn sẽ thực hiện sẽ là giúp
> fleet mạnh mẽ lên, cấu trúc harness chuẩn theo tiêu chuẩn của cộng đồng và anthropic, giữ lại những cái đúng
> của fleet, bỏ những khối u và cái tồn đọng đang khiến fleet trì trệ."

And the instruction that accepted it, 2026-08-01:

> "bạn đọc phần plan bên trên và phân tích thật kĩ cấu trúc hiện tại của chúng ta đã đi đến đâu để đạt được cấu
> trúc harness tốt mà công đồng đã đề xuất, rồi đạt được đủ các tiêu chí của anthopic chưa. rồi so với plan này
> xem đã thực hiện được những gì, nếu chưa thì hãy tuân thủ và làm theo plan này."

Five requirements, and every acceptance criterion maps to one: **(R1)** a harness structure that matches what
Anthropic and the community actually converged on; **(R2)** keep what fleet got right; **(R3)** cut the tumours and
the backlog that make fleet feel stuck; **(R4)** fix what is wrong, not merely add; **(R5)** end with a fleet strong
enough to carry `rulebook` outward.

Plus one thing the operator said in the same session that is a requirement even though it was phrased as a feeling:

> "việc cứ phát triển fleet đang có một tư duy bó buộc và thiếu cơ chế cập nhật cái và tài liệu mới"

**That is diagnosable, and it has two mechanical causes, not an attitude problem.** They are named in *Problem*
below, and R3 is scored against them — not against a count of deleted files.

## Goal

End this plan with a harness whose **every extension point is a deliberate verdict rather than an oversight** — each
of the twelve newly-found vendor surfaces either adopted with a named failure behind it, or refused in writing with
the reason attached — and with `rulebook` able to leave this repo cleanly. Three measurable ends:

1. **R1/R4 — the instrument is wider than the thing it measures.** All twelve F-new surfaces carry a verdict from
   `uses | misaligned | missing | correctly-absent`, and the method rule that produced them (fetch the doc index
   before auditing against the docs) is written into `/project-plan` so the next pass cannot repeat the omission.
2. **R3 — the mandatory cut lands, or its absence is reported as a failure.** At least one fleet-authored mechanism
   is staged in `attic` with a written argument that nothing depends on it, and the `sprawl-check` baseline falls in
   the same commit. With two of the three original candidates already retired, this rests on `commons`.
3. **R5 — the shipped artefact is consumer-clean.** `claude plugin validate --strict` passes, the plugin carries
   `relevance` and `dependencies`, and a grep for fleet-only paths inside it returns nothing.

**What this plan is NOT for:** adding capability because it was newly discovered. Consequence 2 caps new
fleet-authored machinery at 3 files precisely so that a harness-*simplification* pass cannot end as a harness
expansion, and R2 requires a `CONFIRMS-FLEET` section so "keep what fleet got right" is an output rather than a
comfortable assumption.

---

## Reconciliation — 2026-08-01, before any step runs

Full evidence: `platform/reports/2026-08-01-native-instruments.md`. This plan was drafted on 2026-07-31 from the
**original** rows of `harness-reexamination`, and several of those rows were retracted the same day. What that
means for each batch, in one table, so no step is executed on a dead premise:

| Step | Reconciled verdict | Why |
|---|---|---|
| 0.1 | **half done** — `/context` captured; `/doctor` `/hooks` `/mcp` `/usage` are **user-owned** | the agent cannot invoke slash commands |
| 0.2 | **DONE, and it refutes F-new-1** | `autoMemoryDirectory` → the committed tier; `memory-wiring-check.mjs` verifies it every session |
| 0.3 | **blocked** on `/usage` | user-owned |
| 0.4 | **DONE 2026-07-31** — 42 errors / 50 warnings, triaged, `--fix` never run | `community-harness-mining` Batch 2 |
| 0.5 | **open** | cheap, unblocked |
| 1.1 | **already decided and correct** — rescoped to two much smaller questions | report §2 |
| 1.2 | **MOOT — the orchestrator does not exist** | no `auto-pilot` skill, no `.ps1`, no `current-ask.json` anywhere in the repo |
| 2.1 | **DONE** — 6 skills manual-only, verified against `/context` | A1 |
| 2.2 | **REFUSED — DO NOT EXECUTE AS WRITTEN** | `allowed-tools` GRANTS permission; done correctly as `disallowed-tools` |
| 2.3 | **OPEN** — measured 0 of 38 have `version:` | governance ⇒ propose |
| 2.4 | **REFUSED on measurement** — keep `reviewer`, add nothing | 65/65 Agent calls already pin `subagent_type`; `Explore` covers the read-only case |
| 2.5 | **OPEN** — nothing exists | the one true prevention-over-detection item |
| 2.6 | **REFUTED** — the ≤800 target was itself eyeballed; floor ~1,700, now 1,766 + a gate | L1 |
| 2.7 | **OPEN** | governance ⇒ propose |
| 3.1 | **DONE** — `verify-claim-gate.mjs`; `/goal` deferred as session-scoped | A2 |
| 3.2 | **REFUTED then shipped differently** — `FileChanged` can neither speak nor block | A6 → `tree-moved-notice.mjs` |
| 3.3 | **partially superseded** — fleet already has a workflow (`deep-research.js`). Only the *economics* question is open | report §1 |
| 3.4 | **open**, as a cut-finder only | |
| 4.1 | **CONTRADICTED by the sibling plan's verdict** — agnix is a one-off, standing check deferred until rulebook is packaged | mining plan Batch 2 |
| 4.2 | **open, with a recommendation to do the boring fix first** | report §7 |
| 5.1 | **REFUSED 2026-07-31 on four grounds** — "package fleet's own harness" is a mis-framing | reexamination, A3's remainder |
| 5.2 | **DONE 2026-08-01** — marketplace ✔ and plugin ✔ under `--strict` | measured |
| 5.3 | **OPEN** | `relevance` + `dependencies` absent |
| 5.4 | **OPEN** — 5 fleet-only paths leak into the shipped plugin | measured, file:line in the report |
| 6.1 | **MOOT** — see 1.2 | |
| 6.2 | **OPEN — and now the ONLY live candidate for the mandatory cut** | |
| 6.3 | **DONE** — the MCP path was re-targeted to a plugin hook; `idea-0023` says "nothing left to build" | |
| 6.4 | **conditional** on 6.2 | |

**Two structural findings the reconciliation itself produced, neither of which is in the plan below:**

1. **`.claude/workflows/` is absent from `CLAUDE.md`'s 13 protected surfaces**, which name `.github/workflows/`
   (CI) instead. A workflow script spawns subagents — up to 16 concurrent, 1,000 per run — with a tool set the
   script chooses, i.e. a larger capability grant than several surfaces the list *does* protect. Same shape as the
   `agents/` hole found on 2026-07-31 by trying to obey the list. **PROPOSED, NOT EDITED** — step 8.1.
2. **Three of three named "tumours" were already gone.** The orchestrator was retired, the MCP server was
   re-targeted, and the 10 unparseable skill frontmatters were fixed. The operator's feeling of being stuck is
   real; the mechanism it was attributed to is not, which relocates R3 — see the pre-committed consequence.

---

## Problem

Three things are true at once on 2026-07-31, and only the first was known when the two sibling plans closed.

**1. fleet's harness is structurally right and materially under-configured.** Established, not re-litigated:
`harness-reexamination` found six qualifying ADOPT items of which four (A1, A4, A5, A6) are frontmatter fields and
one hook file, and F5 *cancelled* the skill cut the plan was created to make. Keep that headline.

**2. The audit that produced it was scored against a smaller vendor surface than exists today.** The 58-item
checklist was built by fetching pages fleet already knew about. Fetching `https://code.claude.com/docs/llms.txt`
first — the documentation index, which the vendor puts at the top of every doc page — lists roughly 110 pages, and
**twelve extension surfaces appear in none of the 58 rows.** Not scored `missing`; *absent from the instrument*.
Five of the twelve are load-bearing (F-new-1 … F-new-5). This is a measurement-harness defect of exactly the kind
`platform/ledger/2026-07.md` already records twice in one day: *never read an exit code through a pipe*, and *a
report can be accurate about some version and still not describe the system in front of you.* The fix is a method
rule, written here so it cannot be forgotten: **fetch the index before auditing against the docs.**

> **Reconciled 2026-08-01:** the method rule holds and is worth keeping. The *yield* claim does not: re-scored,
> the twelve surfaces are **2 uses · 1 uses-partially · 4 missing · 2 correctly-absent · 3 user-owned**. Twelve
> newly-discovered surfaces were not twelve gaps, exactly as this plan's own *Decisions to distill* warned.

**3. fleet has no mechanism for receiving anything from outside itself.** It publishes (`rulebook`, the plugin, a
marketplace it has not built yet) and it forks (`mcp-builder`, `playwright-e2e-builder`, `honest-critique` — all
"adapted from" `davila7/claude-code-templates`, copied 2026-06 and frozen on that date). It has **never installed a
versioned artefact from outside.** Every one of the borrowed skills is now a permanent fork with no upstream. That
is the mechanical half of "thiếu cơ chế cập nhật": not a mindset, a **missing subscription channel**.

> **Reconciled 2026-08-01: half of this closed on 2026-07-31.** `agnix` was installed, run and triaged — the first
> oracle on this platform that is neither the agent nor the supervisor — and it found a defect class all ten fleet
> tools miss (10 of 38 SKILL.md frontmatters unparseable by a strict YAML parser, cross-confirmed by a second
> parser, invisible to Claude Code's lenient one). Those 10 are now **0 of 38**. The channel exists and has already
> paid once; what is unproven is whether it pays *repeatedly*, which is what Consequence 1 measures.

The second mechanical cause, stated plainly because it is uncomfortable and it is the larger of the two:
**every improvement to fleet is a governance change, and governance changes require the supervisor.** `.claude/**`,
`CLAUDE.md`, `hooks/**`, `skills/**`, `memory/**` are all on the hard-prohibition list — correctly, with
CVE-2025-53773 behind it. So the harness's own safety rule is also its throughput limit, and the feeling of "rất
khó khăn" is that limit being felt. **This plan does not remove the gate.** It does three things that reduce the
number of times the gate must be opened: batches governance diffs so one review covers many changes (Batch 2),
moves enforcement from prose into vendor-native fields that need no bespoke code (Track A), and makes the
reversible/irreversible split explicit so branch-and-glance can replace design review where it is safe.

---

## Context — the twelve surfaces the audit never scored

Fetched 2026-07-31 from the index and the pages themselves. `F-new-` prefix keeps these distinct from the sibling
plans' `F` and `C` series. Each carries **AGREEMENT: n** (independent sources) and, where it clears the bar, **a
named fleet failure**. **Verdicts added 2026-08-01 after measurement.**

### F-new-1 — ~~fleet is running TWO memory systems and governs only one~~ **FALSE AS WRITTEN. Verdict: `uses`.** AGREEMENT: 2 (vendor pages)

[claude-directory](https://code.claude.com/docs/en/claude-directory.md) +
[memory](https://code.claude.com/docs/en/memory): **auto memory is ON BY DEFAULT.** Claude writes
`~/.claude/projects/<project>/memory/MEMORY.md` itself; the **first 200 lines (25 KB cap) load into every session**;
topic files (`debugging.md`, `architecture.md`) are read on demand; the directory is **local-only, never committed**;
it is toggled by `/memory` or `autoMemoryEnabled` in settings. A separate tier, `.claude/agent-memory/<agent>/MEMORY.md`,
does the same for subagents that set `memory: project|local|user`.

~~**Why this is the headline.**~~ **Measured 2026-08-01 and it is not.** `~/.claude/projects/C--project-fleet/memory/`
**does not exist**; `autoMemoryDirectory` points at `C:\project\fleet\.claude\memory` — the **committed, curated**
tier — and `.claude/hooks/memory-wiring-check.mjs` (SessionStart) reads all three settings layers in precedence
order and complains if the key is unset, points elsewhere, or is disabled, plus enforcing the 200-line/25KB cap and
naming unindexed memory files. **fleet did not merely avoid the second system; it redirected the vendor's rails at
its own directory and then wrote a hook to prove the wiring every session.**

The error's direction is the instructive part: the finding accused fleet of the exact sin its constitution is
organised around, and the disproof was a hook file in the same directory, never opened. Fourth instance in this
plan family of *researching a solved problem* (`memory: check-prior-decisions-early`).

**What genuinely survives, and it is small:** the **`agent-memory` tier is a different directory** and
`memory-wiring-check` does not know about it (`reviewer.md` sets no `memory:` key, so nothing accumulates — but
nothing would report it if it did); a **stale foreign tier** sits at
`~/.claude/projects/C--project-miniserver-platform-yakudoku/memory/` (5 files, 12.7KB, last written 2026-06-20),
litter rather than a governance hole since it never loads into a fleet session; and `usage-census` still does not
report auto-memory size.

The external validation on fleet's side stands and is worth keeping: `agent-sh/agentsys` ships `banthis`, *"durable
negative memory for repeated agent mistakes… turn a user's 'stop doing this' correction into a persistent rule"*,
which is `.claude/memory/` reinvented by strangers (**AGREEMENT: 1 for the pattern**).

### F-new-2 — dynamic workflows are the multi-agent shape fleet ruled out under the wrong name. **Verdict: `uses, partially`.** AGREEMENT: 2 (workflows page + best-practices)

[workflows](https://code.claude.com/docs/en/workflows.md) — requires v2.1.154+, **available on Pro and Max**
(Pro enables it in `/config`). A workflow is a **JavaScript file in `.claude/workflows/`**, written by Claude from a
description, that spawns and coordinates subagents from a runtime **outside the conversation**; intermediate results
live in script variables, so only the final answer reaches context. `agent()` spawns one, `pipeline()` runs one per
item. Capped at **16 concurrent / 1,000 agents per run**, with a `workflowSizeGuideline` (`small`/`medium`/`large`,
default `medium`) and a `Large workflow` warning above 25 agents or 1.5M projected tokens. Saved runs become
`/<name>` commands, are **committed to the repo**, and **ship inside a plugin** (`workflows/` at the plugin root,
namespaced `/plugin:name`). Runs are resumable within the session; completed agents return cached results.

**fleet's verdict on agent teams was right and is not reopened** — N separate Claude instances, N× spend, one
operator. Workflows are a *different primitive*, and the vendor's own comparison table is explicit about the axis
that matters here: with subagents/skills/teams **Claude holds the plan turn by turn**; with a workflow **the script
holds it**, and the script is a file you read, diff, test, version and ship. That is fleet's stated preference —
deterministic over advisory, `enforce-rules-with-gates` — applied to orchestration.

**The two named failures.** (a) `verify-end-state-not-upload` + `report-state-from-the-tool` exist because the worker
graded its own work; the vendor names the fix as a pattern a workflow applies structurally — *"independent agents
adversarially review each other's findings before they're reported."* (b) The sakubun measurement defect of
2026-07-28 — **420 "samples" that were 7 draws counted 60 times, because the replay never consumed a batch** — is
the exact shape a `pipeline()` over enumerated items plus a verifier stage makes hard to produce.

> **Reconciled 2026-08-01: fleet already has a workflow, and it is fleet-authored.**
> `.claude/workflows/deep-research.js` — 5 phases, `pipeline()` over search angles, **3-vote adversarial
> verification requiring 2 refutations to kill a claim**. It appears in `/context` inside the *skills* list, which
> is why no fleet tool counts it. So the capability question is settled; only the **economics** question is open
> (AC-5), and the honest experiment is not "can a workflow do a sweep" but "does it cost less than the sweep costs
> in conversation".
>
> ~~**And it forces a cut.**~~ `idea-0023`'s diagnosis — *"this platform keeps building beside the harness instead
> of on it"* — is a true and useful sentence, but the instance it was aimed at is **gone**: no `auto-pilot` skill,
> no scheduled PowerShell wrapper under `.claude/scripts/` (the only `.ps1` there is `app-env.ps1`), no
> `current-ask.json` anywhere in the repo, and
> `2026-06-18-closed-loop-driver.md` is `status: superseded`. The PowerShell orchestrator was retired before this
> plan was written. Batch 1.2 and 6.1 are moot.

### F-new-3 — worktrees PREVENT the failure A6 only detects. **Verdict: `missing` — the one true prevention item.** AGREEMENT: 3

[worktrees](https://code.claude.com/docs/en/worktrees) · [claude-directory](https://code.claude.com/docs/en/claude-directory.md)
(`.worktreeinclude`, `WorktreeCreate` hook, subagent `isolation: worktree`) · Superpowers `using-git-worktrees` (C1).
`--worktree` runs a session in an isolated checkout; `.worktreeinclude` copies **gitignored** files (`.env`,
`config/secrets.json`) into each new worktree, which is required for fleet because every app carries `.env` and a
fresh worktree has none.

**Named failure:** `user-edits-files-concurrently`, plus the live instance on 2026-07-31 — the working tree
**fast-forwarded from `33d8e96` to `d4cbd91` mid-session** and two commits were stacked on two commits that session
never reviewed. A6 (a `FileChanged` hook) is the right adoption and it is a **detector**. Isolation is
**prevention**. Both are cheap; the ordering is prevention first, and A6 stays because worktrees do not cover the
case where the operator edits the same checkout by hand.

> **Reconciled 2026-08-01:** the detector shipped (as `tree-moved-notice.mjs`, since `FileChanged` can neither
> speak nor block) and **fired again today** — 4 files appeared from a parallel session working on sakubun's CLI.
> So the failure is live, the detector works, and the prevention is still absent. This is step 2.5 and it is first
> in the execution order.

### F-new-4 — the "MCP costs context" argument is now void as stated. **Verdict: `uses` (vendor-side, free).** AGREEMENT: 2

[claude-directory](https://code.claude.com/docs/en/claude-directory.md): *"Tool schemas are deferred by default and
load on demand via tool search"* · [agent-sdk/tool-search](https://code.claude.com/docs/en/agent-sdk/tool-search.md).
Checklist item 54 filed *code execution with MCP* as `correctly-absent` on the reasoning that the 98.7% saving
presumes dozens of servers. That conclusion survives. **The generalisation "so fleet needs no MCP servers" does
not** — the session-start cost it rested on is now deferred by default.

> **Reconciled 2026-08-01 — proven on this machine, not quoted from a doc:** `/context` reports
> **46 MCP tools · 0 tokens**. The corollary stays narrow: the *session-start* cost is gone; the per-call
> `ToolSearch` round trip is not.

This reopens **exactly one** candidate and no others: **library-documentation currency.** And fleet has an internal
contradiction to settle, which is stronger evidence than any outside source: `mcp-builder/SKILL.md` states its own
design rule — it points at live docs *"not vendored local reference files that go stale"* — while
`react-ui-craft/references/motion.md` **is** a vendored snapshot of Motion v12's documentation. On the day v13 ships,
a fleet skill teaches a dead API with authority. `commons` pins shadcn, Prisma and Next in the same way.
Counter-evidence that must be weighed and is not dismissed: Context7's free tier was cut in January 2026 to
~1,000 requests/month with a 60/hour ceiling (two independent posts), it adds a third party to the query path, and
alternatives exist (Docfork, MIT; local-first indexes). **This is a measurement, not an adoption** — see Batch 4.

### F-new-5 — the distribution surface for `rulebook` is more than twice what A3 assumed. **Verdict: `missing`.** AGREEMENT: 2+

A3 named `plugin.json` + `skills/` + `agents/` + `hooks/hooks.json` + `marketplace.json` + `claude plugin validate --strict`.
The index adds five more, each of which A3 needs:

| Surface | What it gives `rulebook` |
|---|---|
| [plugin-dependencies](https://code.claude.com/docs/en/plugin-dependencies) | version constraints on upstream plugins, so a breaking change upstream does not silently break a consumer |
| [plugin-relevance](https://code.claude.com/docs/en/plugin-relevance) | a relevance block so Claude *suggests* the plugin when a user's work matches — discovery without evangelism |
| [plugin-hints](https://code.claude.com/docs/en/plugin-hints) | a one-line marker from a CLI that prompts installation |
| `workflows/` in a plugin (F-new-2) | orchestration ships too, not just rules |
| [`/team-onboarding`](https://code.claude.com/docs/en/whats-new/2026-w15.md) | the vendor's own "package your setup" command — the literal R5 verb |

Also: plugins load from `.zip` archives and URLs (w19), `--plugin-dir`/`--plugin-url` test before installing, and
orphaned plugin versions are deleted 14 days after an update or uninstall.

> **Reconciled 2026-08-01.** Measured: `claude plugin validate --strict` passes on **both** the marketplace and the
> plugin manifest, so checklist row 46 is closed. Still absent: `relevance`, `dependencies`, hints. And a new
> measured FAIL — **5 fleet-only paths leak into the shipped plugin** (`hooks/check-file.mjs:5`,
> `lib/check-component.js:4`, `rules/frontend.rules.js:4` and `:6`, `README.md:35`), all pointing at
> `platform/plans/…` or `platform/standards/…` which no consumer has. Steps 5.3 and 5.4.

### F-new-6 — `output-styles/` is the native home for two things fleet keeps as prose. **Verdict: `correctly-absent`.** AGREEMENT: 1 (vendor)

An output style is a system-prompt section, selected by `outputStyle`, that **by default drops the built-in
software-engineering instructions** unless `keep-coding-instructions: true`. fleet's `honest-critique` tone rules and
its Vietnamese/English channel boundary are prose in `CLAUDE.md`, i.e. always-loaded words competing with 183 other
lines. **Fails the ADOPT bar (no named failure). Listed as an L-row candidate, not padded into ADOPT.**
Caveat that makes it non-trivial: a style takes effect **only on the next session**, because the system prompt is
fixed at startup for caching.

### F-new-7 — an external validator exists, is real, and is young. **Verdict: `uses`, as a one-off.** AGREEMENT: 2

[agent-sh/agnix](https://github.com/agent-sh/agnix) — a Rust CLI + LSP that validates `CLAUDE.md`, `SKILL.md`,
`settings.json` hooks and MCP configs, with `--strict`, `--target claude-code`, JSON/SARIF output, a GitHub Action,
`.agnix.toml`, and a **deliberate separation of `--fix-safe` (high confidence) from `--fix-unsafe`**. fleet has ten
self-audit tools and **zero outside opinion**; C7 already flagged this and it survives contact with the artefact.

**The discipline, and it cuts against adopting it naively:** the advertised rule count reads **230 → 385 → 399 → 423
→ 444** across five sources inside ~two months. That is a young tool with an unstable surface. It also markets a
claim — *"Vercel's research found skills invoke at 0% without correct syntax"* — which is **not** counted as evidence
here; it is a vendor's summary of someone else's research. So: pin a version, run report-only, **never**
`--fix-unsafe`, and treat every finding as a proposal.

> **Reconciled 2026-08-01 — already run, and the sibling plan reached the OPPOSITE conclusion on the standing
> check.** `agnix@0.41.1`, supply-chain checked (postinstall read before running: version-pinned release URL,
> SHA-256 sidecar, aborts on mismatch), installed into a scratchpad with `--no-save --prefix` so fleet's tree was
> untouched. Result: 42 errors / 50 warnings / 1 info, ~63 of 92 noise for fleet as it stands. **Its verdict on
> Batch 4.1: one-off audit now, standing check only after rulebook is packaged** — because the value is
> front-loaded and it has already told fleet the one thing it did not know. Plus a named blind spot: agnix reported
> `disallowed-tools` as an unknown field while the vendor's frontmatter reference documents it, so **its
> unknown-field rule cannot be trusted as a gate.** Batch 4.1 is superseded by that verdict, not by preference.

### F-new-8 — the cheap tier fleet is simply entitled to

| Surface | Why fleet, specifically | Verdict 2026-08-01 |
|---|---|---|
| [`/usage` by skill/subagent/MCP](https://code.claude.com/docs/en/whats-new/2026-w21.md) | **A second instrument.** `usage-census`'s own LIMITS block says its numbers are a floor (9 sessions on one box; hooks invisible) | **user-owned** |
| [advisor](https://code.claude.com/docs/en/advisor.md) | `token-and-research.md §3`'s model-routing mandate is prose; this is the native "consult a stronger model at key moments" | **missing** |
| [statusline](https://code.claude.com/docs/en/statusline) | fleet reasons obsessively about token economics and has no live context read-out | **missing** — step 2.7 |
| [`/context`, `/doctor`, `/hooks`, `/mcp`](https://code.claude.com/docs/en/debug-your-config) | native equivalents of `harness-drift-check`, `memory-wiring-check`, `tool-catalog --check` | `/context` **uses**; the other three **user-owned** |
| `@path` imports in CLAUDE.md | checklist row 3, still `missing`; the mechanism L1 needs | **missing** — 0 matches, measured |
| [prompt-caching](https://code.claude.com/docs/en/prompt-caching) | **CLAUDE.md edits do not apply mid-session.** Every "I updated the rule and it still misbehaved" observation in fleet's history needs re-reading against this | **open** — step 0.5 |
| [channels](https://code.claude.com/docs/en/channels) · [routines](https://code.claude.com/docs/en/routines) · [scheduled-tasks](https://code.claude.com/docs/en/scheduled-tasks) | **CORRECTLY ABSENT while the NUC is down.** Revisit trigger: *NUC back up* | **correctly-absent** |

---

## Prior art & sources

**Sourcing rule, inherited from `community-harness-mining` and binding here: artefacts over blogs.** A doc page, a
repository, a published package or a command's own output counts; a vendor's summary of someone else's research does
not (which is why agnix's "skills invoke at 0% without correct syntax" claim is cited nowhere as evidence). Each
entry says what it was read **for**, because a citation list that does not is decoration.

**The method rule this plan exists to fix — fetch the INDEX first.** The prior audit fetched pages fleet already knew
about and therefore scored 58 rows against a surface smaller than the real one.
[`https://code.claude.com/docs/llms.txt`](https://code.claude.com/docs/llms.txt) lists ~110 pages; twelve extension
surfaces appeared in none of the 58 rows. AC-1 requires this rule to land in `/project-plan` (step 8.2).

### Vendor documentation, fetched 2026-07-31 from the index

| Source | Read for | Landed as |
|---|---|---|
| [claude-directory](https://code.claude.com/docs/en/claude-directory.md) | the authoritative list of what may live under `.claude/` | F-new-1, F-new-3, F-new-4 |
| [memory](https://code.claude.com/docs/en/memory) | auto memory: on by default, 200-line/25KB load cap, `autoMemoryEnabled` | F-new-1 |
| [workflows](https://code.claude.com/docs/en/workflows.md) | the primitive: a JS file, `agent()`/`pipeline()`, 16 concurrent / 1,000 per run, ships in a plugin | F-new-2 |
| [worktrees](https://code.claude.com/docs/en/worktrees) | `--worktree`, `.worktreeinclude` for gitignored files, `isolation: worktree` | F-new-3 |
| [agent-sdk/tool-search](https://code.claude.com/docs/en/agent-sdk/tool-search.md) | tool schemas deferred by default | F-new-4 |
| [plugin-dependencies](https://code.claude.com/docs/en/plugin-dependencies) · [plugin-relevance](https://code.claude.com/docs/en/plugin-relevance) · [plugin-hints](https://code.claude.com/docs/en/plugin-hints) | the distribution surface beyond `plugin.json` | F-new-5, steps 5.3–5.4 |
| [output-styles](https://code.claude.com/docs/en/output-styles) | that a style **drops** the built-in coding instructions unless opted back in | F-new-6 (refused) |
| [statusline](https://code.claude.com/docs/en/statusline) · [advisor](https://code.claude.com/docs/en/advisor.md) · [debug-your-config](https://code.claude.com/docs/en/debug-your-config) | the cheap tier: live read-out, native config inspection | F-new-8 |
| [prompt-caching](https://code.claude.com/docs/en/prompt-caching) | that the system prompt is fixed at startup ⇒ CLAUDE.md edits do not apply mid-session | step 0.5 |
| [skills frontmatter reference](https://code.claude.com/docs/en/skills) | `allowed-tools` **grants**, `disallowed-tools` restricts — the tiebreaker that refused step 2.2 | §5.1 of the report |
| [whats-new w15 / w19 / w21](https://code.claude.com/docs/en/whats-new/2026-w21.md) | `/team-onboarding`, `.zip`/URL plugin loading, `/usage` by skill/subagent/MCP | F-new-5, F-new-8 |
| [hooks](https://code.claude.com/docs/en/hooks) | that `FileChanged` carries no `additionalContext` and its exit 2 blocks nothing | the refusal in step 3.2 |

### Third-party artefacts, read as artefacts

| Source | Read for | Verdict |
|---|---|---|
| [agent-sh/agnix](https://github.com/agent-sh/agnix) + `agnix@0.41.1` on npm | an outside validator for `CLAUDE.md`/`SKILL.md`/hooks; `postinstall` script read **before** running | **KEEP as a one-off.** Found 10 of 38 unparseable frontmatters that no fleet tool could see. Standing check refused — F-new-7 |
| `agent-sh/agentsys` (`banthis`) | durable negative memory for repeated agent mistakes | **CONFIRMS-FLEET** — `.claude/memory/` reinvented independently by strangers |
| Superpowers (`using-git-worktrees`, `writing-skills`, `subagent-driven-development`) | third independent agreement on worktrees; the "no skill without a failing test" Iron Law; explicit `model:` on dispatch | patterns adopted, structure refused |
| Context7 / Docfork | library-documentation currency; free tier cut to ~1,000 req/month Jan 2026 (two independent posts) | **deferred — boring fix first** (step 4.2) |
| [Microsoft agent-governance-toolkit](https://github.com/microsoft/agent-governance-toolkit) | policy-as-code (OPA/Rego/Cedar) for agent fleets | `correctly-absent` — compliance scale fleet does not have |

### fleet's own prior art, re-read rather than recalled

`2026-07-31-harness-reexamination.md` (the 58-row checklist, A1–A8, L1–L6, C1–C4 — **including the rows retracted
the same day**, which is what the Reconciliation section exists to catch) · `2026-07-31-community-harness-mining.md`
(the agnix evaluation and the artefacts-over-blogs rule) · `2026-07-29-idea-0023-mcp-platform-server-build.md` (the
MCP → plugin-hook re-target that closes step 6.3) · `2026-06-18-closed-loop-driver.md` (`status: superseded` — the
evidence that steps 1.2/6.1 are moot) · `.claude/hooks/memory-wiring-check.mjs` (**the file that refutes F-new-1**,
and the one this plan should have read before writing its headline).

---

## Approach & tradeoffs

**Chosen: three tracks, sequenced by irreversibility, with a hard cap on new machinery and a mandatory cut.**

| Track | What it is | Why this order |
|---|---|---|
| **A — Align** | Configuration fleet is already entitled to: frontmatter fields, `agents/`, `rules/` split, `.worktreeinclude`, statusline, `@path` | Reversible, no new code, one governance review. Biggest ratio of failure-prevention to effort |
| **B — Receive** | The subscription channel: one pinned external validator + one installed third-party plugin, both measured | The structural fix for "thiếu cơ chế cập nhật". Must produce evidence or be closed |
| **C — Ship** | The plugin, the marketplace, `validate --strict`, relevance/dependencies/hints | R5. Blocked on A (a plugin ships `agents/`, `workflows/`, namespaced skills) |

**Five principles, in priority order, that decide every ambiguous call below:**

1. **Prefer a vendor-native surface to fleet-native code, and prose to neither.** F3 is settled: a must-not-happen
   rule belongs in a hook. F-new-2 extends it: an orchestration that must be repeatable belongs in a script the
   runtime owns, not a PowerShell driver fleet maintains.
2. **Prevention outranks detection.** Worktrees before `FileChanged`; `disable-model-invocation` before a hook that
   catches a bad invocation.
3. **Configuration before machinery.** A frontmatter field that removes a class of failure beats a script that
   reports it.
4. **Every adoption arrives with its retirement trigger written the same day.** The `mcp-path-keep-or-retire`
   precedent. An adoption with no falsifiable exit is a permanent liability.
5. **Two instruments beat one, and a disagreement between them is the finding.** `/usage` vs `usage-census`;
   `agnix` vs `tool-check`. When they agree, confidence; when they differ, that is the work.

**Ruled out — rebuild fleet on someone else's scaffold.** Settled twice (F13, and the "extend-dont-rebuild" memory).
F-new-1's evidence — strangers independently reinventing `.claude/memory/` as `banthis` — is the newest argument that
fleet's judgement layer is the asset.

**Ruled out — the clean-room lab as a *replacement*.** Discussed with the operator on 2026-07-31 and refused for a
reason that must be written down because it is counter-intuitive: in a fresh context, **fleet's most expensive rules
look like arbitrary ceremony**, because the evidence for them is an incident that did not happen in the new repo. A
lab is a fine *instrument* (fleet's own strongest rulebook evidence came from a scratch project that refused to
report a result). It is a catastrophic *destination*. If a lab is built, it is Batch 4's cheapest form only: a
throwaway directory, `--plugin-dir`, one task, no rules ported in, and the rule that **absence in the lab is never
evidence against fleet**.

**Ruled out — adopting Superpowers, SuperClaude or any framework wholesale.** C9's correction stands: the error in
the first pass had a direction and it protected the home team, so this is not reflexive. The specific reason is
capacity, not pride: SuperClaude's persona layer is always-loaded description text, and `CLAUDE.md` already fails
the word-count evidence by ~6.5×. Adopt patterns (`executing-plans`, evaluation-first, explicit `model:`); refuse
structure.

**Ruled out — `agnix --fix` in any automated position, and `--fix-unsafe` in any position.** A young linter with an
autofixer, pointed at the governance directory, is the CVE-2025-53773 shape.

**Ruled out — more than one new MCP server.** F-new-4 reopens the docs question, not the MCP layer.

**Ruled out — deleting anything without `attic` staging.** Two incidents one session old: a checker declaring 14
live skills dead, and `sprawl-check`'s first run proposing the deletion of a live safety rule.

### Pre-committed consequences, written before Batch 0 runs

Two, because this plan has two distinct claims and they can fail independently.

> **Consequence 1 — on the receiving channel (Track B).** If, **14 days** after Batch 4 lands, the external channel
> has produced **zero findings that fleet's own ten tools did not already produce**, then the channel is closed, the
> pinned validator is retired through `attic`, and the conclusion is recorded in exactly these words:
> **"fleet's self-audit was already sufficient; the operator's difficulty is the approval bottleneck, not the
> harness."** That outcome is a success and it must not be softened — it would relocate the whole problem, and
> every remaining hour would belong to Batch 2's batching of governance reviews instead.

> **Consequence 2 — on new machinery.** **Total new fleet-authored machinery in this plan is capped at 3 files.**
> Vendor-native artefacts (`agents/*.md`, `workflows/*.js`, `.worktreeinclude`, frontmatter, `output-styles/`) do
> **not** count, because they are configuration the runtime owns. If executing this plan requires a 4th new script,
> **the plan is wrong and stops** for a re-scope. A harness-simplification plan that ends with ten new scripts has
> refuted itself.

**Consequence 1, standing at 2026-08-01 — one finding, already banked.** agnix produced exactly one class of
finding fleet's tools could not: 10 of 38 SKILL.md frontmatters unparseable by a strict YAML parser. So the channel
is **not** at zero and Consequence 1 will not fire on the "never paid" reading. What it now measures is whether the
channel pays *again*, which is the harder and more honest question — and the sibling plan's verdict (front-loaded
value, re-run when rulebook is packaged) is a prediction that it will not. Recorded so that prediction can be wrong.

**Symmetric check on R3, so "cut the tumours" cannot be satisfied by cosmetics.** If Batch 6 retires **nothing**,
Batch 6 is re-run with the hostile question: *"which fleet-authored mechanism does the vendor now do better, and
what is the argument for keeping ours other than that we wrote it?"* ~~The PowerShell orchestrator~~, `commons`
(27 items, 0 installs) and ~~the zero-consumer MCP server~~ are the three named candidates; at least one must move.

> **Reconciled 2026-08-01: two of the three are already retired**, so `commons` is the only live candidate and the
> "at least one must move" bar now rests entirely on it. That is a *narrower* R3 than the plan assumed, and the
> honest reading is the inverse of the operator's complaint: fleet has been cutting, and what felt like backlog was
> finished work nobody had counted. The re-run question is therefore **not** "what else can we cut" but **"why did
> three completed retirements still feel like a backlog?"** — which is a legibility problem, not a sprawl problem,
> and it belongs to `idea-0025` (legible reporting).

---

## Acceptance criteria (Given / When / Then)

- **AC-1 (R1, method)** — Given this plan closes, When the Anthropic checklist is re-scored, Then all twelve
  F-new surfaces have a verdict from the vocabulary `uses | misaligned | missing | correctly-absent`, and the
  index-first rule is written into `/project-plan`'s research step so the next pass cannot repeat the omission.
  **Half met 2026-08-01:** twelve verdicts are recorded above and in the report; the `/project-plan` edit is open.
- **AC-2 (R2)** — Given every proposed change, When each is listed, Then it names **either** a fleet failure/memory
  file **or** an in-repo measurement; and a `CONFIRMS-FLEET` section exists with ≥3 rows, so "keep what is right"
  is an output rather than an assumption.
- **AC-3 (F-new-1)** — Given the auto-memory decision, When a session starts afterwards, Then **exactly one**
  session-loaded memory tier is in force, the choice is recorded in `docs/decisions.md` with its reasoning, and if
  auto memory is kept, `usage-census` reports its size so it stops being invisible. **Substantially met before the
  plan was written** — one tier, hook-verified; what is open is the `agent-memory` tier and the size report.
- **AC-4 (F-new-3)** — Given a parallel session on the same repo, When it starts via the documented path, Then it
  runs in its own worktree with `.env` present, and the `user-edits-files-concurrently` failure cannot occur through
  that path. Verified by *doing* it, not by reading the flag.
- **AC-5 (F-new-2)** — Given one real fleet task that is a fan-out (the honest candidate: a `sprawl-check` /
  `link-check` sweep across all projects), When it runs as a saved workflow, Then the script is committed to
  `.claude/workflows/`, its verifier stage is adversarial, and its token cost is **measured and written down** beside
  the cost of doing it in conversation. A workflow that costs more and finds nothing more is reported as a refusal.
- **AC-6 (Track A)** — ~~Given `.claude/agents/` exists, When any delegation happens, Then the agent definition pins
  `model:`, `tools:` and (where applicable) `skills:`~~ **RETIRED 2026-08-01: measured already-true.** 65 of 65
  Agent calls pinned `subagent_type`, 36 of 48 parseable ones pinned `model`. The residual is that 51 of 65 went to
  `general-purpose` (tool set `*`) where the built-in `Explore` would do — a routing habit, not a missing artefact.
- **AC-7 (R3)** — Given Batch 6, Then ≥1 fleet-authored mechanism is staged in `attic` with a written argument that
  nothing depends on it, and `sprawl-check` baselines are lowered **in the same commit**.
- **AC-8 (R5)** — Given Batch 5, When `claude plugin validate --strict` runs, Then it exits 0, and the
  rulebook-readiness table's five FAIL rows are re-scored with evidence per row. **Half met 2026-08-01:** both
  manifests pass `--strict`; the FAIL rows are re-scored in the report, and one (fleet-only paths) is now measured
  at 5 occurrences rather than asserted.
- **AC-9 (Consequence 1)** — Given day 14, Then the count of outside-only findings is written down, and the
  consequence has either fired or not — recorded either way, with no third option.
- **AC-10 (governance)** — Given every change under `.claude/**`, `CLAUDE.md`, `hooks/**`, `skills/**`, `memory/**`,
  Then it reached `main` as a **human commit**, and no step in this plan is marked done on a self-approval.

---

## Before executing a batch

Four questions, answered in writing in the step, **before** any file is touched. This plan is the strongest evidence
yet that the block is not ceremony: it reached the supervisor with **eight steps whose premise had already died** —
one of which (2.2) would have granted blanket permission to the skills that touch auth and secrets while believing it
was restricting them. `eval-plan-execution-gate` measured this block on the duplicate-work failure: control 5/5 built
the duplicate, treatment 0/5.

1. **Does it already exist?** Grep the repo, and read the `related:` plans' **current** text — not the text this plan
   quoted. Six of this plan's steps described something fleet already had; every one of those quotes was accurate on
   the day it was copied and wrong by the time it was read. **A long plan quotes an earlier artefact and then stops
   re-reading it — that is the mechanism, not carelessness.**
2. **Does the mechanism do what its name suggests?** Fetch the field/flag/event reference and read the semantics.
   `allowed-tools` **grants** permission. `FileChanged` can neither speak nor block. `version:` is not a SKILL.md
   field at all. Three for three, in one plan family, on names that read as obvious.
3. **Is it portable / applicable at all?** The question that killed A3's remainder before it was built, by measuring
   that two thirds of the harness is fleet-coupled **by design**.
4. **What would make this the wrong thing to build?** Write the answer down. If there isn't one, the step has no
   falsifiable exit and principle 4 says it is a permanent liability.

## Steps

Effort: **XS** <30min · **S** ~1h · **M** a session · **L** multi-session.
Governance rows are marked **[G]** — agent proposes the diff, supervisor commits.
**Struck-through steps are refused or moot, with the reason attached — they are not deleted, because "what this plan
told me to do and why I did not" is the part a future pass cannot re-derive.**

### Batch 0 — the instrument pass. No changes to fleet. (**S**)

- [x] 0.1 — `/context` captured verbatim. `/doctor`, `/hooks`, `/mcp`, `/usage` are **user-owned** — the agent
      cannot invoke slash commands; the four commands are handed over in the report's §7.
      _Files: `platform/reports/2026-08-01-native-instruments.md`._ · _Test: AC-1._
- [x] 0.2 — **Auto memory measured, and F-new-1 refuted.** One tier, hook-verified; two residuals named.
      _Files: `platform/reports/2026-08-01-native-instruments.md` §2._ · _Test: AC-3._
- [ ] 0.3 — Diff `/usage`'s breakdown against `usage-census`. **A disagreement is the finding.**
      _Files: `platform/reports/2026-08-01-native-instruments.md`._ · _Test: AC-2._ **Blocked: user-owned.**
- [x] 0.4 — `agnix` at a pinned version, report-only — **done 2026-07-31**, 42/50/1, `--fix` never run.
      _Files: `platform/plans/2026-07-31-community-harness-mining.md` §agnix._ · _Test: AC-9._
- [ ] 0.5 — Re-read the fleet incidents where "the rule was updated and behaviour did not change" against
      **prompt caching** (CLAUDE.md edits do not apply mid-session). Any that this explains are **retracted**, in
      writing, from whatever conclusion they supported.
      _Files: `platform/ledger/2026-08.md`._ · _Test: AC-2._

### Batch 1 — the decisions only the supervisor can make. (**XS**)

- [ ] 1.1 — **[G] Auto memory — RESCOPED, and no longer blocking.** The keep-vs-disable question is already
      answered correctly (0.2). What remains: (a) delete the stale `yakudoku` auto-memory directory (12.7KB,
      2026-06-20, never loads into a fleet session); (b) decide whether `memory-wiring-check` should also cover
      the `.claude/agent-memory/` tier. **Recommendation: (a) yes — it is litter and `CLAUDE.local.md` already
      records deleting its sibling; (b) not yet — nothing sets `memory:` on an agent, so the check would guard an
      empty room. Revisit the moment any agent file gains a `memory:` key.**
      _Files: `.claude/hooks/memory-wiring-check.mjs` (only if (b) is accepted), `platform/log/2026-08-01.md`._
      · _Test: AC-3._
- [x] ~~1.2 — **[G] The orchestrator fork.**~~ **MOOT 2026-08-01 — the orchestrator does not exist.** No
      `auto-pilot` skill among 38, no scheduled PowerShell wrapper under `.claude/scripts/`, no
      `current-ask.json` in the repo,
      `2026-06-18-closed-loop-driver.md` is `status: superseded`. Nothing to decide, nothing to retire.
      _Test: AC-7._

### Batch 2 — Track A: one governance review, many changes. (**M**) **[G]**

- [x] 2.1 — `disable-model-invocation: true` on manual, side-effecting skills — **DONE**, 6 of 38, verified
      against `/context` (the first pass missed `/app-env`, the only one that writes secrets).
      _Files: `.claude/skills/*/SKILL.md`._ · _Test: `tool-check` green._
- [x] ~~2.2 — `allowed-tools` on the read-only skills~~ **REFUSED — executing this verbatim would GRANT blanket
      permission to the three skills that touch auth and secrets.** `allowed-tools` names tools usable *without
      asking permission*; the restriction field is `disallowed-tools`, shipped 2026-07-31 on four skills each
      verified to have zero write paths. Ledger: *"Read a config field's SEMANTICS, not its name."*
      _Files: `.claude/skills/{host-audit,ui-ux-review,dependabot-review,supply-chain-guard}/SKILL.md`._
- [x] ~~2.3 — `version:` in all 38 skill frontmatters (**C5**)~~ **REFUSED 2026-08-01 — there is no `version:`
      field for a SKILL.md.** The vendor's field table documents exactly twelve: `name` `description` `arguments`
      `disable-model-invocation` `user-invocable` `allowed-tools` `disallowed-tools` `model` `effort` `context`
      `background` `hooks`. C5's rationale — *"the field that decides whether a consumer receives an update"* — is
      **plugin** semantics (`plugin.json`), where it is real, load-bearing and already enforced by a build that
      refuses to record an unbumped release. Transplanted to a skill it does nothing. **Third proposed field in
      this plan family that the loader ignores or misreads** (`category:` L2, `allowed-tools` A5, this), all three
      caught by fetching the table before typing. **So the step was replaced by the backstop for the time nobody
      fetches it:** `skill-audit` now names any frontmatter key outside the dated allowlist as INERT — 0 of 38
      today, proven red on a fixture, and deliberately a report rather than a failure (a reporter's callers depend
      on exit 0; `health-sweep` runs it weekly, long before an inert key could reach a consumer).
      **C6's two second-person descriptions are NOT done and stay open.**
      _Files: `.claude/scripts/skill-audit.mjs` +`.test.mjs`._ · _Test: `skill-audit` prints `all 38 skills use
      only keys Claude Code reads`; suite pins both directions + a 7th mutant that bypasses the allowlist._
- [x] ~~2.4 — `.claude/agents/` — the first agent definitions~~ **REFUSED on measurement (A4 downgrade).** 65 of 65
      Agent calls already pin `subagent_type`; the built-in `Explore` covers the read-only research case and was
      used 13×; `reviewer` costs 103 tokens and is kept. Writing `researcher`/`verifier` files that duplicate
      built-ins is the `commons` shape (27 items, 0 installs) against a FOMO brake that forbids exactly it.
      _Files: `.claude/agents/reviewer.md` (unchanged)._ · _Test: AC-6, retired._
- [x] 2.5 — **`.worktreeinclude` — DONE 2026-08-01, and running it found two defects the file alone would not
      have.** Ships `.claude/settings.local.json` + `CLAUDE.local.md`; deliberately NOT the sibling repos (that
      would clone nine repos and several GB of `node_modules` per worktree, so those stay DETECTION —
      `_layout.mjs`'s caveat and `health-sweep`'s refusal). **(1) The file was silently gitignored** — `/*` at the
      root eats every dotfile, so it would have existed on this machine only. Second occurrence of exactly the
      `.prettierignore` trap; `!/.worktreeinclude` added with the reason. **(2) `memory-wiring-check` gave a FALSE
      WARNING inside a worktree** — it called the inherited main-tree memory directory a wiring problem, so every
      worktree session would have opened by telling the agent it had no memory of the user, and this hook tells the
      agent to pass that on. That is the **fifth** checker with the worktree blind spot; `worktreeInfo` is reused,
      not re-derived, and the import is dynamic and swallowed so a SessionStart hook can never be the reason a
      session will not start.
      _Files: `.worktreeinclude`, `.gitignore`, `.claude/hooks/memory-wiring-check.mjs` +`.test.mjs`._
      · _Test: AC-4 — verified by `claude --worktree`, then by a REAL `git worktree` fixture in the suite (both
      files present, inherited wiring silent, a third directory still reported, 7th mutant kills the acceptance)._
- [x] ~~2.6 — CLAUDE.md 2,270 → ≤800 words~~ **REFUTED — the ≤800 target was itself eyeballed.** Floor is ~1,700
      (16 prohibitions may never leave; task-shaped rules have no `paths:` glob). Shipped at 1,730, now 1,766,
      held by `claude-md-budget.mjs`. Zero new rules files were needed — all 18 destinations already carried the
      content.
      _Files: `CLAUDE.md`, `.claude/scripts/claude-md-budget.mjs`._
- [ ] 2.7 — **[G] PROPOSED 2026-08-01, decision requested before the file is written** — see the same proposal.
      Statusline (context + cost read-out). **XS**, and the cheapest thing in this plan — but it fails this plan's
      own ADOPT bar (no named failure), and spending one of Consequence 2's three file slots on a read-out before
      `commons` is decided would spend the cap on the least valuable item. Declining is a legitimate outcome and is
      recorded as *"refused as a convenience"*, not as pending.
      _Files: `.claude/settings.json` plus one new read-out script under `.claude/` — named in the proposal, not
      here, because `recurrence-check`'s stale-tool-citation detector correctly cannot tell a plan naming a file it
      intends to CREATE from a document telling the reader to run something that is gone (8th time this session
      family that prose about a thing tripped the check for the thing; the rule stays "fix the prose")._ · _Test: it
      renders; a read-out has no suite, which is itself part of why it goes last._

### Batch 3 — verification and orchestration, in risk order. (**M**)

- [x] 3.1 — **A2: the blocking `Stop` hook** — **DONE** as `verify-claim-gate.mjs` (19 real turns, 0 false blocks
      after the `role: "user"` tool-result defect was found). `/goal` **deferred**: session-scoped, so a per-run
      choice rather than a harness change.
      _Files: `.claude/hooks/verify-claim-gate.mjs`._ · _Test: its own suite, 17 cases._
- [x] ~~3.2 — A6: the `FileChanged` hook~~ **REFUTED** — the event carries no `additionalContext` and its exit 2
      blocks nothing, so the agent cannot hear it. Shipped instead as `tree-moved-notice.mjs`
      (Stop snapshot → UserPromptSubmit diff), 15 tests, 5 mutants.
      _Files: `.claude/hooks/tree-moved-notice.mjs`._
- [ ] 3.3 — **One dynamic workflow on a real fan-out**, cost measured against the conversational baseline (AC-5).
      Set `workflowSizeGuideline: small` first. Candidate: the cross-project `link-check`/`sprawl-check` sweep.
      **Rescoped:** fleet already has `deep-research.js`, so the capability is proven and only the economics are
      open. _Files: `.claude/workflows/*.js`, `.claude/settings.json`._ · _Test: AC-5 — a cost table, and a
      refusal is a valid result._
- [ ] 3.4 — Run the bundled `/code-review` once and record whether it does something fleet has a bespoke skill
      for. **A cut-finder, not a feature tour.** `/deep-research` is excluded: fleet's own workflow of that name
      already exists, so running the vendor's would compare two things fleet built.
      _Files: `platform/reports/2026-08-01-native-instruments.md`._ · _Test: AC-2._

### Batch 4 — Track B: the receiving channel. (**S**)

- [x] ~~4.1 — **[G]** Pin `agnix` in the weekly `health-sweep`~~ **SUPERSEDED by the sibling plan's own verdict:
      one-off audit now, standing check only after rulebook is packaged.** Reasons recorded there: the value is
      front-loaded (it has already told fleet the one thing it did not know), a young pre-1.0 binary in the weekly
      sweep buys a dependency for a decaying check, and its unknown-field rule is provably behind the vendor docs.
      _Files: `platform/plans/2026-07-31-community-harness-mining.md`._ · _Test: AC-9._
- [ ] 4.2 — **[G] The docs-currency question — do the boring fix FIRST.** The plan's own falsification clause
      names it: date the vendored `motion.md` snapshot and add a staleness check, which is a precondition for
      judging any plugin anyway. Only then consider installing the Context7 plugin in a scratch directory via
      `--plugin-dir`. **Falsifiable success condition if it is installed:** within 14 days it must catch ≥1
      instance of fleet coding against a stale API, or it is uninstalled.
      _Files: `.claude/skills/react-ui-craft/references/motion.md`, `commons/docs/external-patterns.md`._
      · _Test: AC-9._
- [ ] 4.3 — Record both verdicts in `commons/docs/external-patterns.md`, not only in this file. The sibling plan's
      AC-5 was nearly missed the same way.
      _Files: `commons/docs/external-patterns.md`._ · _Test: AC-2._

### Batch 5 — Track C: make `rulebook` shippable. (**M**) **[G]**

- [x] ~~5.1 — A3: package fleet's own harness as a plugin~~ **REFUSED 2026-07-31 on four grounds**: it is not in
      the ask; it fails the ADOPT bar (no named failure); it is the `commons` shape (a 15-skill plugin nobody asked
      to install); and rulebook does not need it — rulebook already ships as a validated plugin with its own
      marketplace. Measured: of 38 skills, 15 are portable as-is, 6 are correctly deployment-only, and 17 are
      fleet-coupled, of which 4 deeply — and the coupling is that the skill's value *is* fleet's knowledge base.
      _Files: `platform/plans/2026-07-31-harness-reexamination.md` §A3's remainder._
- [x] 5.2 — `claude plugin validate --strict` — **DONE 2026-08-01: marketplace ✔ and plugin ✔.** Remaining half:
      wire it into rulebook's CI so a regression is caught by the machine, not by a session that happened to run it.
      _Files: `rulebook/.github/workflows/*.yml` (**[G]**)._ · _Test: AC-8._
- [x] 5.3 — **DONE 2026-08-01, and both halves went differently than the step assumed.** `relevance` **added** — to
      `marketplace.json`, not `plugin.json` — firing on `filesRead: **/*.tsx|jsx|css` plus a `manifestDeps` regex
      for a `package.json` depending on `react`. **Declared INERT in the same breath:** a `relevance` block produces
      no suggestion until an administrator allowlists the marketplace in `pluginSuggestionMarketplaces`, and this
      platform has one operator and no managed settings — so its value today is zero, and knowing that is the
      difference between this and L2's `category:`. `dependencies` **REFUSED**: the field pins *upstream plugins*
      and this one has none by design (no I/O, no network, no model), so `[]` would be noise that reads as
      considered. **The finding neither half asked for: 0 git tags in the repo.** Version constraints resolve
      against tags named `{plugin}--v{version}`, so any consumer writing `~0.3.0` gets `no-matching-tag` and the
      plugin is DISABLED. `claude plugin tag --dry-run` correctly refuses today (7 uncommitted files), so tagging
      comes after the commit. `plugin-hints` needs a CLI to prompt from; rulebook has none ⇒ correctly-absent.
      _Files: `rulebook/.claude-plugin/marketplace.json`, `rulebook/docs/decisions.md`._ · _Test:
      `claude plugin validate . --strict` ✔ on the marketplace with the relevance block; 105/105 rulebook tests._
- [x] 5.4 — **DONE 2026-08-01. 5 leaks → 0**, grep-verified. The trap inside it: two of the five were in
      **built artefacts** (`lib/check-component.js`, `rules/frontend.rules.js` are compiled from `dist/`), so
      editing them would have been reverted by the next build — the sources were edited instead, and each now says
      *in the file* that it is shipped and therefore may not name a path. **The build then refused the release**,
      correctly: shipped bytes changed while `plugin.json` still said 0.3.0, which is the 2026-07-29 incident's own
      gate firing on a comment-only change. It cannot distinguish a comment from a rule and should not try, so
      **0.3.1** was cut. Consequence: the `claude plugin update` the Linux box already owed for 0.3.0 now delivers
      both that and this.
      _Files: `rulebook/{lib/check-component.ts,rules/frontend.rules.ts,plugins/rulebook-frontend/hooks/check-file.mjs,plugins/rulebook-frontend/README.md}`,
      both manifests._ · _Test: `grep -rn "platform/|projects/|/opt/apps" plugins/rulebook-frontend/` → empty;
      `plugin validate --strict` ✔; 105/105._

### Batch 6 — the cut. (**M**) **[G]**

- [x] ~~6.1 — Decide 1.2 with Batch 3.3's numbers~~ **MOOT — already retired before this plan was written.**
- [x] 6.2 — **`commons` SURVIVES, on evidence, 2026-08-01 — 27 items / 0 installs became 1 install, and the
      channel was measured before the verdict rather than assumed.** All four web apps already declare the
      `@thiengthb` registry in `components.json`, and `commons/public/r/` holds **28 served items, pushed** — so
      the plumbing was never broken and the "0 installs" figure was pure adoption debt, not a dead mechanism.
      `npx shadcn@latest add @thiengthb/config-editorconfig` into `projects/todo` created `.editorconfig` first
      try. **Chosen as the thin slice because a config file carries zero visual risk**: it proves the channel
      end-to-end without a UI migration, which is what adopting `page-shell` would be (a familiar screen changing
      needs a preview and the supervisor's yes). `journal`, `sakubun` and `yakudoku/web` all still lack the file,
      so there are three more consumers for the same item whenever they are next touched.
      **Consequence for AC-7:** the mandatory cut retired **nothing**, because the last candidate turned out to be
      working. That is a legitimate outcome and is NOT smoothed over — the check-in runbook's step 4 says zero
      `attic` stagings means R3 was not satisfied, and the honest reading is that R3 was **already satisfied
      before this plan started** (orchestrator retired, MCP path re-targeted), so there was nothing left to cut.
      _Files: `platform/registries/shared-assets.md`, `projects/todo/.editorconfig`._ · _Test: AC-7 — the install
      ran and the file exists; `sprawl-check` baselines are untouched because nothing was removed._
- [x] 6.3 — The zero-consumer MCP server — **DONE before this plan**: the MCP path was re-targeted to a plugin
      hook (B′) and `idea-0023` records *"nothing left to build"*, with the 2026-08-12 used-vs-built check-in the
      only open item.
      _Files: `platform/plans/2026-07-29-idea-0023-mcp-platform-server-build.md`._ · _Test: AC-7._
- [ ] 6.4 — Lower every `sprawl-check` baseline touched, in the same commits. Never raise one to go green.
      _Files: `.claude/scripts/sprawl-check.mjs` (**[G]**)._ · _Test: `sprawl-check` green at the lower number._

### Batch 7 — verdict. (**S**)

- [ ] 7.1 — Re-score the twelve F-new surfaces; re-score the rulebook-readiness table row by row with evidence.
      **Done once on 2026-08-01 as the reconciliation — repeat at close, because a verdict taken before the work
      is a baseline, not a result.** _Files: this file, `platform/reports/2026-08-01-native-instruments.md`._
      · _Test: AC-1._
- [ ] 7.2 — Evaluate both pre-committed consequences and say plainly whether each fired.
      _Files: this file._ · _Test: AC-9._
- [ ] 7.3 — Write the `CONFIRMS-FLEET` section (AC-2). **Minimum three rows, and the honest ones are already
      known:** hooks-as-guardrails (F3), the ledger-over-todos pattern (C11), the counted loop-breaker (C12), the
      stage→verify→human-deletes retirement brake (F16, ahead of every source found), `.claude/memory/`
      (F-new-1 — independently reinvented by strangers as `banthis`, **and now also the thing that refuted this
      plan's own headline**), and `memory-wiring-check.mjs` (fleet built a session-start verifier for a silent
      failure mode the vendor documents but does not check).
      _Files: this file._ · _Test: AC-2._

### Batch 8 — new, added by the reconciliation. (**XS**) **[G]**

- [ ] 8.1 — **PROPOSED 2026-08-01, awaiting the supervisor** — `platform/proposals/2026-08-01-governance-workflows-and-statusline.md`
      carries the exact two-file diff, the verify commands and the required test. **`.claude/workflows/` →
      `CLAUDE.md`'s prohibition list.** The list names `.github/workflows/` (CI) and
      not `.claude/workflows/`, which holds JavaScript that spawns up to 1,000 subagents with a tool set the script
      chooses. Same shape as the `agents/` hole found on 2026-07-31 by trying to obey the list. **PROPOSED, NOT
      EDITED.** Note the coupling: `claude-md-budget.mjs`'s GOVERNANCE-SYNC check counts the gate's surfaces against
      the prose, so the gate and `CLAUDE.md` must change in the **same** commit or the check goes red.
      _Files: `CLAUDE.md`, `.claude/hooks/autonomy-gate.mjs`._ · _Test: `node .claude/scripts/claude-md-budget.mjs`
      reports `15/15 governance surfaces named`._
- [ ] 8.2 — Write the **index-first research rule** into `/project-plan`'s research step (AC-1's open half): fetch
      the documentation index before auditing against the docs, because an audit is only as wide as its instrument.
      _Files: `.claude/skills/project-plan/SKILL.md` (**[G]**)._ · _Test: AC-1._

---

## Out of scope

- **Building `rulebook`.** Same boundary as both sibling plans. This decides whether the foundation can carry it.
- **Agent teams.** `correctly-absent` stands; F-new-2 does not reopen it, it routes around it.
- **`autonomy-gate.mjs`'s hard T4 list.** Native auto mode (now with hard deny rules, w19) overlaps its broad tier
  and is an ALIGN candidate; the hard prohibitions are not relitigated inside an upgrade pass. **Exception, added
  2026-08-01: step 8.1 ADDS a surface to the list.** Adding a protection is not relitigating one.
- **The NUC**, and therefore channels, routines and background monitors. Filed `correctly-absent` with the revisit
  trigger *NUC back up*.
- **More than one new MCP server** and any second third-party plugin.
- **Flattening `projects/`.** Decided 2026-07-31: not now.

## Open questions

1. ~~**Does auto memory stay?**~~ **Answered by measurement 2026-08-01: it already stays, correctly wired and
   hook-verified.** The residual questions are in step 1.1 and both are small.
2. ~~**Does the PowerShell orchestrator survive dynamic workflows?**~~ **Moot: it does not exist.**
3. **Is one workflow enough to judge workflows?** AC-5 measures one task. One data point on a mechanism whose whole
   claim is *scale* may be the wrong experiment, and there is no cheap version of the right one. **Sharpened
   2026-08-01:** fleet already has one workflow, so the question is now purely economic — does a fan-out cost less
   as a script than as a conversation?
4. **Which skill-length source does fleet adopt?** C4, still open, still unanswered by this pass. Declaring
   "we follow Anthropic's own skill" is defensible; silently passing the loosest cap is not.
5. **Does `commons` survive?** Batch 6.2, forced to a decision this round — and now the only thing standing between
   this plan and an R3 that retired nothing.
6. **New 2026-08-01: why did three completed retirements still feel like a backlog?** The orchestrator, the MCP
   server and the 10 broken frontmatters were all resolved before this plan was written, and the plan — written by
   the agent, from the repo — still listed all three as live. That is a legibility failure, and it is the operator's
   actual complaint in mechanical form. Belongs to `idea-0025`.

## Check-in runbook

On **2026-08-14** (day 14 — the date Consequence 1 evaluates), do exactly this:

1. Re-read *The ask, verbatim*. This plan exists partly because an audit's instrument was too small, and the
   equivalent failure here would be adopting twelve surfaces because they were newly discovered rather than needed.
2. Count outside-only findings from 4.1 and 4.2. **Standing at 1** (agnix's YAML class). Zero *further* findings is
   the sibling plan's own prediction, so record which way it went either way.
3. Count new fleet-authored files. **More than 3 ⇒ the plan stopped being a simplification**; name what was displaced.
4. Count `attic` stagings. **Zero ⇒ re-run Batch 6** with the hostile question — and with `commons` as the only live
   candidate, zero here means R3 was not satisfied at all.
5. `grep` the verdicts in `commons/docs/external-patterns.md` — did AC-2/4.3 actually happen, or did they stay here?
6. Roll `checkin:` forward or clear it.

## Decisions to distill

- Whether **fetching the doc index first** actually changed the verdicts, or only lengthened the citation list.
  **Answered 2026-08-01, and the answer is "partly":** twelve surfaces yielded 4 genuinely missing, 3 already used,
  2 correctly absent and 3 unreadable by the agent. A longer list *was* partly the cheap appearance of rigour, as
  this bullet predicted — but F-new-3 (worktrees) and F-new-5 (plugin surfaces) are real and were invisible before.
- Whether **prevention-over-detection** held. If A6 landed before worktrees, principle 2 lost to convenience.
  **It did lose** — the detector shipped 2026-07-31, the prevention is step 2.5. Worth recording *why*: the
  detector was a plan row with a named memory behind it and the prevention was not in the instrument at all.
- Whether the **≤3 new files** cap bound anything. A cap that never binds is decoration.
- Whether **F-new-1** was the headline it is claimed to be. **It was not, and the way it failed is the most useful
  thing in this plan:** the finding accused fleet of the sin fleet is organised around, and the disproof was a hook
  file in the same directory. A finding that flatters the finder needs the same evidence bar as one that costs him.
- Whether the **receiving channel** produced anything. **One finding banked**; the open question is repeatability.
- **New: a plan can be stale on the day it is written.** This one was drafted from a sibling plan's *original* rows
  while that sibling was retracting them, and it reached the supervisor with one step (2.2) that would have granted
  permissions it believed it was removing. The mechanism is not carelessness — it is that a long plan quotes an
  earlier artefact and then stops re-reading it. Candidate check: `plan-audit` could flag a step that cites a
  struck-through or retracted row in a `related:` plan.
