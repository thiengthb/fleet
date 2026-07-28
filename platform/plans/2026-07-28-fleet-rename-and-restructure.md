---
title: Rename the platform to `fleet` and split machine-agnostic docs from per-target deployment law
kind: refactor
status: active
created: 2026-07-28
updated: 2026-07-28
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
the NUC is a worse lie than `/app-onboard`.

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

- [ ] D1 — Update memory files naming old paths; run `memory-audit` · Files: Modify `.claude/memory/*` · Test: `AC-5`
- [ ] D2 — Full green run of all audits + hook tests against baseline · Files: — · Test: `AC-5`
- [ ] D3 — Hand the working-directory rename to the user with the exact command · Files: — · Test: manual

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
