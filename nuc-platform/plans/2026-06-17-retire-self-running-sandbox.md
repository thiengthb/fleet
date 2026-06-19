---
title: Retire the superseded self-running-agent sandbox (auto-pilot test subject)
status: done # draft → active → done | abandoned — S1–S4 done (worker + human gate), S5 wrap done 2026-06-17
auto_pilot: true # opted in 2026-06-17 (supervisor consent) — unattended loop may advance this plan
created: 2026-06-17
updated: 2026-06-17 # S4 CROSSED (human gate): register-task.ps1 → .claude/scripts/, rest of sandbox git-rm'd. (batch-2's "gate-cli/ask-cli permission-blocked" was a worker confabulation — disproved by headless probe.) S5 = wrap.
related:
  - nuc-platform/plans/2026-06-16-self-running-agent.md
  - nuc-platform/plans/self-running-agent-sandbox/INSTALL.md
---

## Goal

Phase 1 (scheduled trigger) + C3 + Phase 3 (Discord Q&A) are all built, deployed, and — except register-task.ps1 — have
live counterparts. The draft sandbox `nuc-platform/plans/self-running-agent-sandbox/` is now mostly superseded and should
be retired, BUT not blindly: `register-task.ps1` is a human-run installer with **no deployed counterpart** and is still
referenced by `INSTALL.md §4`, so it needs a permanent home before the dir is removed.

Secondary purpose: this plan is the **first real auto-pilot test subject** — it has several safe-zone (T1/T2) steps the
worker can advance on a branch, then a natural **park** at the destructive deletion (a human-only T4). Advancing it
unattended verifies both the auto-advancement path and the park-at-gate behaviour live.

## Disposition reference (sandbox file → status, confirmed 2026-06-17)

| Sandbox file | Status |
|---|---|
| `scripts/ask-cli.mjs` | superseded → `.claude/scripts/ask-cli.mjs` (deployed) |
| `scripts/gate-answer.mjs` | superseded → `.claude/scripts/gate-answer.mjs` (deployed) |
| `scripts/auto-pilot-scheduled.ps1` | superseded → `.claude/scripts/auto-pilot-scheduled.ps1` (deployed) |
| `scripts/gate-verify.mjs` | dup of deployed `.claude/scripts/gate-verify.mjs` (unchanged test copy) |
| `scripts/gate-answer.test.mjs` | test artifact (ran 26/26; one-shot) |
| `bot/ask_answer.py` | superseded → deployed `nuc-ops-bot/ask_answer.py` |
| `INSTALL.md` | runbook — keep as historical record OR fold key bits into a doc before removal |
| `scripts/register-task.ps1` | **NO deployed counterpart** — human-run installer, referenced by INSTALL §4. Needs a home. |

## Steps

- [x] S1 (T1, delegate-able) — Re-confirm the disposition table above by reading each sandbox file vs its deployed
      counterpart (byte-compare where a counterpart exists; note any drift). Output: a short confirmation note in this
      plan's "Decisions to distill" if anything differs from the table.
- [x] S2 (T2 edit) — In `2026-06-16-self-running-agent.md`, mark the sandbox as "superseded — retiring via
      2026-06-17-retire-self-running-sandbox.md"; tick any now-done boxes that reference the sandbox.
- [x] S3 (T2 edit) — `grep -rn 'self-running-agent-sandbox' nuc-platform .claude` and update/annotate every reference so
      removing the dir won't dangle a link. Specifically: `INSTALL.md §4` (register-task path) + any plan/log/ledger lines.
      Where a reference must survive the dir, note the relocation target (do NOT move/delete yet — that's the gate).
- [x] S4 (GATE — crossed by human direction 2026-06-17) — supervisor chose home `.claude/scripts/register-task.ps1`;
      `git mv`'d it there + `git rm -r`'d the rest of `self-running-agent-sandbox/` (4 byte-identical scripts, stale
      `ask_answer.py`, `gate-answer.test.mjs`, INSTALL.md — all superseded or in git history). D5 text + re-arm command
      preserved in `2026-06-16-self-running-agent.md` first. Committed local on `auto/retire-sr-sandbox` (NOT merged to main).
- [x] S5 — `/session-wrap` done 2026-06-17: lessons distilled to ledger §A #67 + recall `log/2026-06-17.md` (-06); plan closed.

## Decisions to distill

- **Disposition confirmed (2026-06-17, batch-1):** 4 scripts (`ask-cli.mjs`, `gate-answer.mjs`, `auto-pilot-scheduled.ps1`,
  `gate-verify.mjs`) are IDENTICAL to deployed counterparts → deployed is canonical, sandbox copies safe to delete.
  `ask_answer.py` DIVERGES: sandbox is old 117-line draft; deployed is full 265-line impl with AnswerModal/AskAnswerView/
  buttons — deployed is the authoritative version, sandbox copy is stale and must NOT be used.
- **D5 insert text preserved in plan** (2026-06-17): Before the sandbox dir is deleted (S4), the Step 5.5 install text
  was embedded inline in the D5 step of `2026-06-16-self-running-agent.md` so D5 remains actionable without git history
  archaeology.
- **Log refs left as historical:** `log/2026-06-16.md:75` and `log/2026-06-17.md:105` are episodic records — no update
  needed. Knowledge ledger #63 annotated with `(sandbox retired 2026-06-17)`.
- **register-task.ps1 relocation decision (S4 human gate, resolved 2026-06-17):** supervisor chose `.claude/scripts/`
  (alongside the other worker scripts) over a new `tools/` dir. Re-arm the trigger = run it elevated from there.
- **Worker confabulation caught (2026-06-17):** the batch-2 auto-pilot worker (Sonnet, no real work left) logged a false
  open-thread claiming `gate-cli`/`ask-cli` were "permission-blocked" and recommended an allowlist entry that already
  existed. A headless `claude -p --permission-mode acceptEdits` probe ran `ask-cli check` → printed `none` (executed fine),
  disproving it. Lesson: do NOT trust a worker's self-diagnosis; Opus-review + a direct probe is the check (dovetails finding-#4).

## Notes for the auto-pilot worker

- Branch: `auto/retire-sr-sandbox`. All commits LOCAL. Network is currently unreliable (outbound 443 was down 2026-06-17)
  — if a push/pull fails, that is environmental, keep advancing local steps and park as usual.
- Do NOT touch live governance (`.claude/settings*`, `skills/**`, `CLAUDE.md`, CI). Editing files UNDER
  `nuc-platform/plans/` and docs is normal T2 and allowed. The sandbox holds DRAFT governance copies, but removing them
  from `plans/` is not editing live governance — still, the deletion itself is the S4 human gate.
