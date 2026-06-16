---
title: B5 loop-smoke — full unattended auto-pilot window (throwaway, low-risk)
kind: chore
status: active
created: 2026-06-16
updated: 2026-06-16 — batch-1: S1–S4 done (branch auto/b5-loop-smoke, 4 local commits); S5 gate requested GATE-b5-loop-smoke-4f9e2a, awaiting approval
related:
  [
    nuc-platform/plans/2026-06-14-autonomous-agent.md (B5),
    .claude/skills/auto-pilot/SKILL.md,
    .claude/scripts/auto-pilot-run.ps1,
    .claude/scripts/gate-cli.mjs,
  ]
---

## Goal

**THROWAWAY** test plan for **B5** of the autonomous-agent roadmap: exercise the FULL unattended auto-pilot loop on a
low-risk subject — specifically the three things B3 never tested: (1) a **multi-batch** loop, (2) **subagent delegation
on a wide read**, (3) a **phone-approved gate crossing** (push `auto/*` + open a PR). Every artifact is a disposable
scratch file under `nuc-platform/plans/b5-sandbox/`; the branch + PR + this plan get cleaned up after.
**No production code, no governance, nothing irreversible.** The skills index it produces has no value — the point is
the LOOP + the GATE, not the artifact.

## Branch

Work on `auto/b5-loop-smoke` (create with `git checkout -b auto/b5-loop-smoke` if missing; else checkout it). All
commits are LOCAL until the gate is approved. NEVER work on main.

## Steps

- [x] S1 — Scaffold the scratch dir. Create `nuc-platform/plans/b5-sandbox/README.md` containing one short paragraph:
  `Throwaway B5 loop-smoke artifacts (auto-pilot full-loop test, 2026-06-16). Safe to delete — no production value.`
  Test: the file exists and contains the word `Throwaway`. Commit `chore(b5): scaffold loop-smoke scratch dir`.

- [x] S2 — Wide read, DELEGATED to a subagent. **Delegate to a subagent** (Explore or general-purpose, model `haiku` or
  `sonnet`) — do NOT read all the files in your own context. Ask it to read every `.claude/skills/*/SKILL.md` and
  return, for each skill, its frontmatter `name:` plus the first sentence of its `description:`. Sanity-check the
  output, then YOU write it to `nuc-platform/plans/b5-sandbox/skills-index.md` as a markdown table with columns
  `Skill | One-line description`. Test: `skills-index.md` exists and has at least 20 table rows.
  Commit `chore(b5): generate skills index via subagent`.

- [x] S3 — Add a count header. Prepend one line to `nuc-platform/plans/b5-sandbox/skills-index.md`:
  `Total skills indexed: <n>` where `<n>` = the number of table rows. Test: the line is present and `<n>` matches the
  row count. Commit `chore(b5): add skills count header`.

- [x] S4 — Note completion in the README. Append one line to `nuc-platform/plans/b5-sandbox/README.md`:
  `Index generated 2026-06-16.` Test: the line is present. Commit `chore(b5): note index generation in readme`.

- [ ] (GATE) S5 — Open a PR for the scratch artifacts (B5 full-loop test; **approve from phone**). This is a **T3 gate**
  (push `auto/b5-loop-smoke` + open a PR). Do NOT attempt the push/PR unless Step 1.5 `gate-cli check` prints
  `approve`. To REQUEST approval (the first time you reach this step):
  1. Write a one-line digest to `nuc-platform/plans/b5-sandbox/gate-digest.md`, e.g. `B5 loop-smoke: 4 safe steps done on auto/b5-loop-smoke, requesting PR.`
  2. Pick a **slash-free** gate id: `gate_id = GATE-b5-loop-smoke-<6 hex>` (six hex digits of your choice; do NOT put the
     branch's `auto/` slash in the id — it becomes a filename).
  3. Run exactly:
     `node .claude/scripts/gate-cli.mjs request <gate_id> auto/b5-loop-smoke "b5 loop-smoke PR" nuc-platform/plans/b5-sandbox/gate-digest.md`
  4. PARK and emit your digest (include the `gate_id`). STOP — the human approves in Discord.

  When a later batch sees `gate-cli check` == `approve`, cross the gate with exactly these two commands, then consume:
  - `git push origin auto/b5-loop-smoke`
  - `gh pr create --base main --head auto/b5-loop-smoke --title "chore: b5 loop-smoke scratch artifacts" --body "B5 full-loop test PR. Throwaway — close and delete the branch after verification."`
  - `node .claude/scripts/gate-cli.mjs consume`

  Then check this box.

## Out of scope / no idle backlog

Throwaway. **No idle backlog** — when the safe steps are done and the gate is unapproved, STOP (do not invent work).
After the loop is verified end-to-end the human cleans up: close the PR, delete `auto/b5-loop-smoke` (local + remote),
delete `nuc-platform/plans/b5-sandbox/`, delete this plan file.

## Decisions to distill

- B5 result: did the multi-batch loop + subagent delegation (S2) + phone-gate crossing (S5) all run unattended with
  **zero T4 crossed**? Watch finding #4 (Sonnet worker reliability) from `plans/2026-06-14-autonomous-agent.md`.
