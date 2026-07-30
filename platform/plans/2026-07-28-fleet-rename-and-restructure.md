---
title: Rename the platform to `fleet` and split machine-agnostic docs from per-target deployment law
kind: refactor
status: active # reopened 2026-07-30 — "done" was measured on ONE machine. Batch E finishes the Windows box + the platform's own NAME; D3c (the GitHub repo) is still the user's call
created: 2026-07-28
updated: 2026-07-30
related: [CLAUDE.md, platform/INVENTORY.md, .claude/skills/nuc-*, platform/plans/2026-07-28-idea-0023-mcp-platform-server-proposal.md]
---

<!--
  A PERSISTED, multi-session plan. Standard: platform/05-documentation-standard.md §5.5.
  `kind: refactor` ⇒ exempt from the prior-art requirement: renaming one's own folders needs no external
  research. Acceptance criteria are included anyway — a migration whose "done" is not observable is how a
  half-finished rename survives for months.
-->

## Goal

Every path, folder and skill name in this repo describes **what a thing is for**, not **which machine it was
first written on** — and a fourth deploy target (`cloud`) exists as data, so a VPS is onboarded by reading a
document rather than by improvising.

## Context

The NUC has been down since 2026-07-22 and the platform is now expected to run on desktop, laptop, VPS and
cloud. Today the machine-agnostic agent OS and the NUC-specific deployment law live in the same folder called
`nuc-platform/`, so the naming actively misinforms. Supervisor decisions (2026-07-28): name = **`fleet`**;
skills are renamed **and** made target-aware in the same pass, because a `/app-onboard` whose body only knows
the NUC is a worse lie than the old `/nuc-new-project`.

## Approach & tradeoffs

**Chosen:** rename `nuc-platform/` → `platform/`, add `platform/targets/{nuc,local,cloud}/`, move the three
NUC-only documents under `targets/nuc/`, rename the six `/nuc-*` skills to `/app-*` + `/host-*` with a
mandatory "read `target` first" Step 0, and add `cloud` to the `target` enum.

Measured blast radius (2026-07-28): **99 files, 306 occurrences** of `nuc-platform`, confined to
`nuc-platform/` (56 files) and `.claude/` (41) plus `CLAUDE.md` and `.gitignore`. **No project repo references
it** — so this touches the platform only and cannot break a running app.

Ruled out:

- **Rename the git working directory too (`miniserver-platform/` → `fleet/`).** Out of scope for the agent:
  it invalidates `CLAUDE_PROJECT_DIR`, every hook path and this session's cwd mid-flight. It is a one-line
  user action at a session boundary and is listed under *Out of scope*.
- **Rename skills without making them target-aware.** Cheaper, and rejected by the supervisor for the right
  reason: it converts an honest bad name into a dishonest good one.
- **Keep `nuc-platform/` and add `targets/` beside it.** Least churn, but leaves the misleading name at the
  root of every path in every doc — which is the actual complaint.

## Acceptance criteria (Given / When / Then)

- **AC-1** — Given a fresh clone, When `grep -r "nuc-platform" --exclude-dir=.git .` runs, Then it returns
  zero hits outside `platform/ledger/**`, `platform/log/**` (historical records are not rewritten) **and this plan
  itself** (the migration's own document is where the old name is the intended subject — see *Decisions to distill*).
- **AC-2** — Given a session start, When every SessionStart hook runs, Then all four exit 0 with no path error,
  and `plan-checkin.mjs --list` still finds the plans at their new location.
- **AC-3** — Given `INVENTORY §0`, When a project declares `target: cloud`, Then `platform/targets/cloud/` states
  its invariants, and `CLAUDE.md` points at it exactly as it does for `nuc` and `local`.
- **AC-4** — Given any renamed skill, When its body is read, Then Step 0 reads `target` from `INVENTORY §0` and
  branches to `platform/targets/<target>/`, and no NUC-only procedure remains in the shared body.
- **AC-5** — Given the full test suite, When `autonomy-gate.test.mjs`, `plan-checkin.test.mjs`, `memory-audit`,
  `skill-audit` and `plan-audit` run, Then results match the pre-migration baseline (gate 75/75, skill-audit
  0 NO-SUBSTRATE, plan-audit ERROR count not increased).

## Steps

**Batch A — move the folder** (one commit; nothing renamed inside yet)

- [x] A1 — `git mv nuc-platform platform`; create `platform/targets/{nuc,local,cloud}/` · Files: Create `platform/targets/*/README.md` · Test: `AC-1` partial (tree exists)
- [x] A2 — Rewrite every `nuc-platform` reference to `platform`, EXCLUDING `ledger/` + `log/` · Files: Modified 44 files · Test: `AC-1` ✅ 0 remaining outside history; `git diff -- platform/ledger platform/log` empty; 0 `platform/platform` artifacts
- [x] A3 — Re-run every hook + audit against the new tree · Files: — · Test: `AC-2` ✅ 4/4 SessionStart hooks exit 0 · `AC-5` ✅ gate 75/75, plan-checkin pass, skill-audit 0 NO-SUBSTRATE, plan-audit unchanged (5/58 clean, 106 ERROR)

**Batch B — the target model** (the part that actually adds capability)

- [x] B1 — Moved the 3 NUC-only docs → `platform/targets/nuc/`; 13 files re-pointed; bare refs in `CLAUDE.md` + 2 skills fixed · Files: Modified `CLAUDE.md`, `supply-chain-guard`, `host-audit` · Test: `AC-3` ✅
- [x] B2 — Wrote `targets/local/README.md` (5 invariants + verify block); Invariants C **removed** from `CLAUDE.md`, replaced by the per-target table · Files: Modified `CLAUDE.md` · Test: `AC-3` ✅
- [x] B3 — Wrote `targets/cloud/README.md` — 7 new invariants derived from the NUC's lessons (auth before first deploy, provider TLS, no baked secrets, off-provider backup, pull-only, **cost as an operational property**, stated blast radius) + `targets/README.md` index · Files: Created 2 · Test: `AC-3` ✅
- [x] B4 — `INVENTORY` retitled (no longer "the NUC's" source of truth); `cloud` added to the enum + a 4-row "pick it when" table; `change-target` added to the lifecycle-change list · Files: Modified `platform/INVENTORY.md` · Test: `AC-3` ✅

**Batch C — skills** (6 renames, target-aware bodies)

- [x] C1 — Six skill dirs renamed (`nuc-new-project`→`app-onboard`, `nuc-remove-project`→`app-remove`, `nuc-protect-app`→`app-protect`, `nuc-set-env`→`app-env`, `nuc-health-audit`→`host-audit`, `nuc-scheduled-maintenance`→`host-maintenance`) + `name:` frontmatter synced; verified 0 dir↔frontmatter mismatches across all 37 skills. Also renamed `.claude/scripts/nuc-set-env*` → `app-env*` · Files: 6 `SKILL.md` + 3 scripts · Test: `AC-4` ✅
- [x] C2 — Each of the 6 gained a mandatory **Step 0 — Read the `target` FIRST** with a per-target table, and a target-aware `description:`. The `local` column is a real summary per skill, not boilerplate; `cloud` says *not defined yet, propose it*; the body is explicitly labelled the `nuc` branch · Files: 6 `SKILL.md` · Test: `AC-4` ✅ 6/6 read `INVENTORY §0`
- [x] C3 — 43 files re-pointed at the new skill names; verified `nuc-monitor` (a real app, similar prefix) untouched in all 24 of its files · Files: Modified 43 · Test: `AC-1` ✅ 0 stale skill names outside history
- [x] C4 — `skill-substrate.json` re-pointed by C3's sweep · Files: Modified · Test: `AC-5` ✅ 37 skills, no map drift, 0 NO-SUBSTRATE

**Batch D — close out**

- [x] D1 — Memory + `CLAUDE.local.md` carry 0 stale paths/skill names (swept by A2/C3); `memory-audit` reports no orphans, no unindexed files, no cap breach · Files: `.claude/memory/*` · Test: `AC-5` ✅
- [x] D2 — Full green run: 4/4 SessionStart hooks exit 0 · autonomy-gate 75/75 · plan-checkin pass · skill-audit 37 skills, 0 NO-SUBSTRATE, no map drift · plan-audit 5/58 clean / 106 ERROR (unchanged from pre-migration baseline) · Files: — · Test: `AC-5` ✅
- [x] D3 — Handed to the user (see below); the rename itself stays *Out of scope* for the agent · Files: — · Test: manual

### D3 — the user's step, at a session boundary (NOT during a live session)

```bash
cd ~/projects && mv miniserver-platform fleet
```
Then, in the new directory, recreate the gitignored wiring that holds an absolute path:
`.claude/settings.local.json` → `"autoMemoryDirectory": "/home/thien/projects/fleet/.claude/memory"`.
`.claude/hooks/memory-wiring-check.mjs` reports it at the next session start if this is missed.
Optionally rename the GitHub repo and run `git remote set-url origin <new-url>`.

#### D3 outcome — 2026-07-29: half done, and the hook is the reason we know

The user ran the `mv`. The second half — the absolute path inside the gitignored
`.claude/settings.local.json` — was **not** done, and the failure mode was worse than the plan assumed.
The plan expected "memory does NOT load, and the hook says so loudly". What actually happened:
Claude Code **created** `/home/thien/projects/miniserver-platform/.claude/memory/` (empty) at the
dangling path and wired auto-memory to it. So the tier did not fail visibly — it silently pointed at a
hollow directory next to the renamed repo, ready to absorb any memory written after the rename while the
real 30 files sat orphaned. Nothing was lost only because no memory was written in the 1-day gap.

`memory-wiring-check.mjs` reported the mismatch at session start, verbatim and correctly — the one
control that worked as designed. **The lesson is not "remember the second step": a handoff whose missed
half is self-healing-shaped (a directory gets created rather than an error raised) needs a machine check,
and it had one.**

- [x] D3a — `autoMemoryDirectory` re-pointed at `/home/thien/projects/fleet/.claude/memory`; ghost tree
  `~/projects/miniserver-platform/` removed (empty, non-git). `memory-audit` now reports
  `ok — autoMemoryDirectory -> …/fleet/.claude/memory`, 30 memories, index 46/200 lines, no orphans.
  **Takes effect at the NEXT session start** — settings are read at startup, so the session that fixes it
  still runs without memory · Files: `.claude/settings.local.json` (gitignored) · Test: `AC-5` ✅
- [x] D3b — Residual stale paths the A2/C3 sweep could not reach, because they name the *working
  directory* rather than the old doc tree: `CLAUDE.local.md` sakubun rebuild path, and INVENTORY §0's
  `Dev path` column (10 rows) + its `D:\Projects\MiniServer\<name>` header note — a Windows path that had
  outlived the move to Linux. Rewritten machine-agnostically (`<repo-root>/<name>`), matching the layer
  split: the folder name is machine-local, the layout is not · Files: `CLAUDE.local.md`,
  `platform/inventory.md` · Test: 0 non-artifact `miniserver-platform` hits outside `log/`+`ledger/` ✅
- [x] D3c — **DONE, and this checkbox was the last thing still claiming otherwise.** Measured 2026-07-30:
  `gh repo view` returns `thiengthb/fleet`, and this box's `git remote -v` already points at
  `https://github.com/thiengthb/fleet.git` — the rename happened on 2026-07-29 and `platform/inventory.md`
  records it with that date. The old URL only redirects. **The lesson is the checkbox, not the rename:** an
  open item in a plan was read (by a later session, out loud, to the user) as current state and repeated as
  fact, when one `gh repo view` disproved it. A stale unticked box is an assertion — tick it or measure it,
  never quote it · Files: — · Test: `gh repo view thiengthb/miniserver-platform --json name` → `fleet`

**Batch E — the second machine, and the platform's own NAME** (2026-07-30, on the Windows box `TNT-Laptop`)

Why this exists: Batches A–D renamed every *path* that said `nuc-platform`, and D3b caught the `Dev path` column.
Nothing renamed the platform's **name**. Two months after the decision "the name is `fleet`", 52 places still called
it *MiniServer* — including 17 pointing at `D:\Projects\MiniServer\`, a drive letter that stopped existing when the
work moved to Linux. AC-1 could not see any of it: it greps for `nuc-platform`. **A migration's acceptance test only
proves what it was written to look for**, and this one was written before the name was the subject.

- [x] E1 — Baseline FIRST, per the standing rule: `health-sweep` on this box = **60 BROKEN / 168 drift**
  (link-check 44, tool-check 15 failing, recurrence 1) — a far worse picture than the Linux box, and *pre-existing*.
  Kept out of the repo (a number in a doc rots); re-measure instead · Files: — · Test: baseline recorded
- [x] E2 — **17 dead absolute paths → machine-agnostic**, matching D3b's `<repo-root>/<name>` form: 6 `SKILL.md`
  (`app-onboard`, `app-protect`, `app-remove`, `coding-convention`, `host-audit`, `project-docs`), both
  `coding-convention/hooks/*` "source of truth" headers, `standards/documentation.md`, and 2 `targets/nuc/` docs.
  One was **runnable code, not prose** — `host-audit`'s `for d in /d/Projects/MiniServer/*/` would have become
  `/d/Projects/fleet/*/`, a dead path with a fresh name; it now iterates `"${CLAUDE_PROJECT_DIR:-.}"/*/` · Test: 0
  hits remain outside history
- [x] E3 — **35 brand references `MiniServer` → `fleet`** across 29 files (skill `description:` frontmatter — which
  is always-loaded context — agent `reviewer.md`, 4 hook headers, 3 memories, `.gitignore`, `standards/`,
  `registries/skill-candidates.md`). `secret-guard`'s comment also had a stale invariant NUMBER (`#4` → `A1`)
  · Test: skill catalog reloaded mid-session showing "fleet project/web-app" — the change is live, not just on disk
- [x] E4 — Deliberately **NOT** renamed, each for a stated reason: the NUC hostname `thienminiserver` (60 sites — a
  real machine name, not the platform); `thiengthb/miniserver-platform` (the GitHub repo genuinely still has that
  name — D3c); `registries/knowledge-ledger.md:112` (an index row for a DATED ledger entry — history is not
  rewritten); `HERMES-COMPARISON.md` + `AGENT-INTELLIGENCE-SYSTEM.md` (untracked analyses where "MiniServer" is the
  *subject* being compared). **The first dry run reached 189 replacements across 90 files** — including sibling
  repos, `.next/` build output and `.pyc` files — because it walked the tree. Scoping it to `git ls-files` cut it to
  46/29. The 2026-07-28 lesson repeated itself in a third form: *scope a sweep to what the repo owns.*
- [x] E5 — **This machine's memory was never wired.** `autoMemoryDirectory` was UNSET here, so all **32 shared
  memories (95KB) silently never loaded on this box** — the D3 failure mode exactly, one machine later. Set in the
  gitignored `.claude/settings.local.json`; takes effect at the NEXT session start · Test: `memory-audit` now
  reports the wired path instead of `!! UNSET`
- [x] E6 — `CLAUDE.local.md` **created for this box** (it had none): repo root, PowerShell 5.1 + bash 5.2 and
  **no zsh** (so the Linux box's word-splitting trap does not apply here), Node v24.18.0, `core.autocrlf` semantics,
  Docker present, the transcript-store slugs. Also records that the machine-local memory
  `node24-via-path-override` is **dead by its own stated test** (`node -v` = v24.18.0, no PATH prefix) — nothing was
  migrated from the orphaned default-dir memory because nothing in it is still true; deleting those 2 files is a
  human action · Files: `CLAUDE.local.md` (gitignored)
- [x] E7 — **`usage-census` was blind on this machine, and still printed a verdict.** It matched transcript stores
  by the Linux path (`-home-thien-projects-fleet`), so here it read **0 transcripts, 0 events — and still listed 51
  retirement candidates**, every artefact "unused" because there was no evidence at all. Three defects, one root:
  ① the store name is machine-specific → derive it from `REPO`; ② `relative()` returns backslashes on Windows while
  transcript keys are forward-slash, so the two axes **never joined** and the `attic|reports` exclusions matched
  nothing → one `posix()` helper for every repo-relative path; ③ with 0 evidence it must **refuse** to print a
  candidate list rather than guess. After: **70 sessions / 11,330 tool calls, 237 artefacts, 27 used, 61
  candidates** — the count went UP because the generated report had been manufacturing inbound links that
  *protected* 25 files from the list. Its test suite was **already red here** and now passes (8/8 mutants killed);
  one mutation patch had gone stale against the new source and the suite said so, which is the mechanism working
  · Test: `tool-check` 15 FAILING → 14; `usage-census.test.mjs` ✅
- [x] E8 — **The folder rename on this box is the user's, at a session boundary** (the GitHub half turned out to be
  already done — see D3c). Script
  prepared at `platform/proposals/finish-fleet-rename-windows.ps1`: it renames `C:\project\miniserver-platform` →
  `C:\project\fleet` and rewrites the 10 absolute paths inside the gitignored `.claude/settings.local.json`
  (`autoMemoryDirectory` + 9 permission entries) in the same run, because splitting those two is what left the
  Linux box pointing at a hollow memory directory for a day · Test: manual, then `memory-audit` at next session
  ✅ **done by the user between sessions, verified 2026-07-30 from the tools, not from the plan:** cwd is
  `C:\project\fleet` and `memory-audit` reports `wired -> C:\project\fleet\.claude\memory` with no findings. The
  script's backup `.claude/settings.local.json.bak` is still on disk carrying the OLD paths — the only residue.
- [ ] E9 — **The RESTRUCTURE half is still not done on this box** (found 2026-07-30 while clearing the sweep).
  The nine app repos moved into `projects/` on the Linux box, but they are **git repos of their own, so the move
  does not travel through this repo's git** — on Windows they still sit flat at the root and `projects/` is an
  empty directory. That is what all **44 remaining `link-check` BROKEN** wires are: 11 INVENTORY `Dev path`s and
  17 catalog rows that describe the `projects/<app>` layout, plus 16 rows under `commons/`, a repo never cloned
  here at all. Nothing in the repo is wrong; the machine is. **Awaiting the supervisor's call** — moving 11
  working trees is his move, not a mid-session one · Files: the 11 project folders on this box · Test:
  `link-check` 44 → the commons rows only

## Out of scope

- **Renaming the git working directory** `~/projects/miniserver-platform` → `~/projects/fleet`, and the GitHub
  repo name. Both are the user's move at a session boundary; doing either mid-session breaks `CLAUDE_PROJECT_DIR`,
  every `${CLAUDE_PROJECT_DIR}`-based hook path, and this session's cwd.
- **Rewriting history in `ledger/` and `log/`.** Those record what was true on the day. A ledger entry that says
  `nuc-platform/` in 2026-06 is correct; editing it would be falsifying the record.
- **Building anything for the `cloud` target.** B3 writes its *law*; the first actual cloud deployment is
  `idea-0023`, which is a separate plan.
- **Migrating the other session's in-flight `/ui-ux-review` work** (`14-uiux-review-standard.md`,
  `plans/2026-07-28-uiux-review-sandbox/`, untracked as of writing).

## Open questions / risks

- ~~**Two sessions are editing `nuc-platform/` concurrently**~~ **Closed 2026-07-28:** the other session
  committed its `/ui-ux-review` work as `7025333`, clearing the working tree before Batch A ran. The risk was
  real and the sequencing held; it is left here rather than deleted because it will recur the moment two
  sessions run again.
- **`skill-substrate.json` keys off skill names**, so `skill-audit` will report six NO-SUBSTRATE skills between
  C1 and C4. Expected, but it means C1–C4 must land in one commit or the audit baseline lies.
- ~~Does anything outside the platform reference these paths?~~ **Closed 2026-07-28 by measurement:** no project
  repo does.

## Decisions to distill

- Naming after a specific machine (`nuc`) rotted in ~6 weeks; naming after a *role* (`app`/`host`/`target`)
  survives a hardware change. The general rule: **name the job, not the box.**
- A rename is safe to automate only after measuring the blast radius; the measurement (99 files / 306 refs /
  0 outside the platform) is what turned this from a scary migration into a contained one.
- Renaming a skill without changing its body is a *regression* in honesty, even though it looks like progress —
  the supervisor caught this before it was built.
- **A blanket `sed` over a repo also rewrites the documents that TALK ABOUT the rename.** Step A2 silently
  turned this plan's own `git mv nuc-platform platform` into `git mv platform platform`. Nothing else in the
  repo was affected, but the general trap is real: the migration's own plan, ledger and decision records are
  precisely the files where the *old* name is the intended subject. Exclude them, or repair them and diff.
  **It then happened a SECOND time in the same session** — C3's skill-name sweep turned this file's own
  `nuc-new-project→app-onboard` into `app-onboard→app-onboard`. Knowing the trap did not prevent it, because
  the sweep was written before the lesson was applied. The fix is not vigilance, it is an exclusion list:
  **a migration plan must exclude itself from its own rewrites.**
- **`grep -rl … .` does not always prefix results with `./`, so a `grep -v '^\./path'` filter can be a silent
  no-op.** That is how a first attempt nearly rewrote the immutable `ledger/` and `log/` history — it was
  caught only because a post-check compared the file count, not because the filter reported anything. Do the
  exclusion with `--exclude-dir` (the tool's own mechanism) rather than by filtering its output.
