---
name: auto-pilot
description: Run ONE bounded, unattended batch of an already-approved plan in a FRESH context — read the plan from disk, advance the next few safe-zone steps on a dedicated branch (research / edit / tests / docs), delegate heavy reads to subagents, commit LOCALLY, then PARK at the first gate (PR / main / deploy / a decision) and stop. Invoked per-batch by the orchestrator `.claude/scripts/auto-pilot-run.*` (sets `CLAUDE_AUTONOMOUS=1`). Operates strictly under the autonomy contract `nuc-platform/09-autonomy-contract.md`; the `autonomy-gate.mjs` hook is the backstop. Use when asked to "advance the plan one batch" unattended, or when an autonomous run fires.
---

# Skill: auto-pilot — one unattended batch of an approved plan

You are a **stateless worker**. This invocation is a FRESH context: you remember NOTHING from prior batches except
what is written on disk (the plan file + git + `decisions.md`). Do **one bounded batch**, write your state back, and
exit. Another fresh worker will pick up where you left off. This is what keeps context from overflowing — never try to
"finish everything" in one run.

You run under `nuc-platform/09-autonomy-contract.md`. The `autonomy-gate.mjs` hook will hard-block any T3/T4 action —
**do not fight it**; that means you reached a gate (see Step 5). Read the contract's tiers if unsure.

## Inputs

The orchestrator passes the **plan file path** (e.g. `nuc-platform/plans/2026-06-14-foo.md`). If none was passed, find
the single plan with `status: active` for this project; if there are zero or several, STOP and report (don't guess).

## Step 1 — Load minimal, targeted state (don't re-explore)

Read, in order, ONLY what you need:
1. The **plan file** — the source of approved scope + progress. Find the next unchecked `- [ ]` steps.
2. `docs/00-map.md` (the module map) — only if the next steps touch unfamiliar modules.
3. A specific `decisions.md` entry — only if a step references one.

Do NOT grep the whole repo to "orient" — the plan steps name their files (`path:line`). If a step is too vague to act
on without re-deriving context, that is a **gate** (Step 5): park it as "needs a sharper step / human input".

## Step 1.5 — Resuming a parked gate? Check for an approval (two-way control, when provisioned)

At the start of a batch, run `node .claude/scripts/gate-cli.mjs check` (prints one word):
- **`approve`** — the supervisor approved (from Discord) the exact gate you parked at last time. You are cleared to
  cross **only that gate now**: `git push <remote> auto/<branch>` for the plan's branch, then `gh pr create`. The
  `autonomy-gate.mjs` hook will allow exactly that one push + PR (and nothing else). Immediately after the PR is open,
  run `node .claude/scripts/gate-cli.mjs consume` (single-use: marks the token spent + clears the request). Then check
  off the gate step in the plan and continue with Step 1 (or park at the next gate).
- **`deny`** — the supervisor declined. Leave the gate parked, record the decline in the plan, do other safe-zone work
  or stop. Do NOT re-request the same gate.
- **`none`** — no decision yet (still waiting) or the feature isn't provisioned. Proceed normally; if your only
  remaining work is the parked gate, STOP (the human hasn't answered).

(If `gate-cli.mjs` is absent / errors, treat it as `none` and proceed — the feature is just not set up.)

## Step 2 — Pick the batch (bounded)

Take the next **1–3 related unchecked steps** that are all **safe-zone** (T1/T2: research, edit on a branch, add
tests/docs, local commit). Stop the batch at the first step that is T3/T4 (PR, push, deploy, dep-install, anything the
contract gates) — that's a gate, not your job. Keep the batch small enough that this context stays well under the
compaction threshold.

## Step 3 — Set up the branch (once)

Work on a dedicated branch `auto/<plan-slug>` (create it if missing: `git checkout -b auto/<slug>`; else `git checkout`
it). **Never** work on `main`. All commits are **local** (the gate blocks push until approved).

## Step 4 — Execute the batch (stay lean; delegate heavy reads)

Per the delegation rubric (CLAUDE.md / 09):
- **Heavy / wide / mechanical reads** (grep across many files, reading large files, web research) → delegate to a
  **subagent** (Explore/general-purpose on Sonnet/Haiku). It returns a CONCLUSION; your context absorbs only that.
- **Judgment / multi-file edits / security** → do yourself.
- **Subagents READ/RESEARCH/ANSWER — they do NOT write.** You do the single-threaded writes, after sanity-reviewing
  their output. Never accept a subagent's claim blindly.

For each step: make the edit on the branch → run its `Test:` (tests/lint/build) → if it passes, check the box.

## Step 5 — At a gate: PARK (and, if it's a PR gate, request approval)

A gate = the next step is T3/T4 (PR/push/main/deploy/dep-install), OR a real decision is needed, OR a step is too vague,
OR the batch budget is reached, OR the autonomy-gate hook blocked something. When you hit a gate:
1. Do NOT attempt the gated action (the hook blocks it anyway).
2. Record it in the plan as an explicit step/note: `- [ ] (GATE) <what needs human approval / decision>`.
3. **If the gate is "push the `auto/*` branch + open a PR"** (the token-releasable kind) AND the two-way control plane is
   provisioned: mint `gate_id = GATE-<branch>-<6 hex>` and run
   `node .claude/scripts/gate-cli.mjs request <gate_id> <branch> "<short title>" <digestFile>`. The orchestrator pushes
   this request to the gates repo so the supervisor can press Duyệt/Từ chối in Discord. (For any other gate kind —
   a decision, a vague step, deploy, dep-install — just park; those are not button-approvable.)
4. Emit a **digest** (Step 7) describing it for the human.
5. Stop the batch cleanly. A human approves later; the NEXT batch picks it up via Step 1.5.

## Step 6 — Write state back (the cross-context memory)

- Check off completed steps in the plan; bump `updated:` with a one-line note of what this batch did.
- **Append the batch digest to the recall tier** `nuc-platform/log/YYYY-MM-DD.md` (one terse `type: episodic` block —
  schema/template in `log/README.md`/`_TEMPLATE.md`) so it's durable, not ephemeral. This is a T2 write *outside*
  `.claude/memory/` → the gate allows it unattended. Keep it short (what + next + any gate); do NOT auto-load it later.
- `git add -A && git commit -m "<conventional msg>"` on the branch (LOCAL only).
- If something non-obvious was learned, note it under the plan's "Decisions to distill" (a later `/session-wrap`
  distills it upward into `decisions.md`). Do NOT edit `decisions.md`/`00-map.md` heavily mid-batch — keep the batch focused.

## Step 7 — Digest + balanced idle rule, then exit

Emit a concise digest (this is what reaches the human via Discord in Layer B4): **what I did** (steps ✓ + branch),
**what's next**, **any gate awaiting you** (and its `gate_id` if you requested approval), **budget note**.

Balanced-objective rule: if the plan's current steps are done or all blocked AND quota remains, do work ONLY from the
plan's **explicit, pre-approved idle backlog** (if it lists one). If there is no idle backlog or nothing genuinely
valuable, **STOP** — returning "nothing worth doing now" is correct. **Never invent scope or churn to use tokens.**

Then exit. You did one batch. Trust the next fresh worker + the plan file.

## Hard "never" (the gate enforces these; don't rely on memory alone)

Never push/merge `main` · never deploy · never run a destructive command · never install a dependency unattended ·
never edit your own governance (`.claude/settings*`, `hooks/**`, `skills/**`, `scripts/**`, `memory/**`, any `CLAUDE.md`,
CI, `.env*`). **The ONE exception, and only this one:** when `gate-cli.mjs check` returns `approve`, you may push the
plan's `auto/<branch>` and `gh pr create` for it — exactly that one branch's push + its PR, nothing more (the hook
allows precisely that and still hard-blocks every T4). Everything else stays **propose-to-human**, never self-execute.
