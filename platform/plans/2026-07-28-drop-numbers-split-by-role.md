---
title: Drop the numeric doc prefixes, split platform docs into standards/ vs registries/, rename ui-kit → commons
kind: refactor
status: done
created: 2026-07-28
updated: 2026-07-28
related: [platform/plans/2026-07-28-fleet-rename-and-restructure.md, platform/INVENTORY.md, CLAUDE.md]
---

<!--
  Continuation of the fleet restructure. `kind: refactor` ⇒ no prior-art requirement.
  ⚠️ THIS FILE MUST BE EXCLUDED FROM ITS OWN SWEEPS. The previous migration's blanket `sed` rewrote the plan
  that described it — twice — because the old names are the intended subject here. See that plan's
  "Decisions to distill". Every rewrite step below names its exclusion list explicitly.
-->

## Goal

A reader can tell what a platform document *is* from its filename and its folder, without decoding a number —
and the two kinds of document that behave differently (stable rules vs append-only living data) are physically
separated, so the one that bloats by nature can be given a rotation mechanism without touching the one that
must never bloat at all.

## Context

Moving 01/03/04 into `targets/nuc/` left the sequence as 02, 05–14 — holes. Numbers already implied a reading
order that the platform's own JIT context rule contradicts ("read on need, not reflexively"). Supervisor chose
(2026-07-28): drop the numbers, split by role, lowercase-kebab everywhere, and rename `ui-kit` → `commons`.

**The measured finding that decides the split:** every platform doc over 15KB is a registry; no standard reaches
16KB. Registries 14–57KB (known-traps 33, knowledge-ledger 57, skill-candidates 26, shared-assets 14,
idea-queue 42, inventory 20) · standards 6–15KB (documentation 15, autonomy-contract 7, testing 7, ui-layout 6,
token-and-research 10, uiux-review 13). Bloat is not a general disease — it is what append-only data does.

## Approach & tradeoffs

`platform/standards/` (rules, stable) · `platform/registries/` (living data, appended) · `inventory.md` stays at
the platform root as the single source of truth · existing folders (`ledger/ log/ plans/ proposals/
skill-proposals/ targets/`) unchanged · a new `platform/README.md` index does the job the numbering was doing,
better. **Naming rule, written down for the first time: `lowercase-kebab-case.md` for every file, `README.md`
the only exception** (tooling convention). There was no rule before — verified by grep, not assumed.

`ui-kit` → `commons`: it is a **separate git repo, gitignored by the parent**, so this is a local `mv` plus a
GitHub rename by the user. Ruled out: **moving it into `platform/`** — it works *because* it is independently
versioned and installable via `npx shadcn add`; folding it in would break the one mechanism that makes it
useful, and would strand any future consumer outside this folder.

Also ruled out: **renumbering to close the holes.** It rewrites every path for zero information gain — a number
carries nothing but "the order I created these" — and the holes would reappear at the next move. Worse, the 6
`NN §n` section references in `ledger/` and `log/` would silently point at the wrong document, and those files
are not rewritable.

## Acceptance criteria (Given / When / Then)

- **AC-1** — Given a fresh clone, When `ls platform/*.md` runs, Then only `README.md` and `inventory.md` remain
  at the platform root; every other document sits under `standards/` or `registries/`.
- **AC-2** — Given any file in the repo outside `ledger/`, `log/` and the two migration plans, When grepped for
  a numeric doc prefix (`0X-`/`1X-` naming or `NN §n` section refs), Then there are zero hits.
- **AC-3** — Given `platform/README.md`, When read, Then it lists every document with one line of "read this
  when", and states the file-naming rule.
- **AC-4** — Given the full gate suite, When run, Then results match the pre-migration baseline: 4/4 SessionStart
  hooks exit 0, autonomy-gate 75/75, plan-checkin pass, skill-audit 0 NO-SUBSTRATE, plan-audit ERROR ≤ 106.
- **AC-5** — Given `ui-kit`, When the rename lands, Then the directory is `commons/`, no reference to `ui-kit`
  survives outside the historical record, and the repo still resolves for `shadcn add`.

## Steps

- [x] E1 — `git mv` 11 docs into `platform/standards/` + `platform/registries/`, dropping number prefixes and lowercasing · Files: 11 moves · Test: `AC-1`
- [x] E2 — `INVENTORY.md` → `inventory.md` (stays at the platform root) · Files: 1 move · Test: `AC-1`
- [x] E3 — Rewrite path references, **excluding `ledger/`, `log/` and both 2026-07-28 migration plans** · Files: ~60 · Test: `AC-2`
- [x] E4 — Fix the 6 `NN §n` section refs + 2 "standard 11" by hand (too few to automate, too easy to get wrong) · Files: ~6 · Test: `AC-2`
- [x] E5 — Write `platform/README.md` (index + the naming rule) and record the naming rule in `standards/documentation.md` · Files: Create 1, modify 1 · Test: `AC-3`
- [x] E6 — `mv ui-kit commons`; rewrite references (same exclusions) · Files: ~20 · Test: `AC-5`
- [x] E7 — Full gate run against baseline · Files: — · Test: `AC-4`

## Out of scope

- **Renaming the `thiengthb/ui-kit` GitHub repo** and the working directory — both are the user's action at a
  session boundary, as with the `fleet` directory rename.
- **Giving registries a rotation mechanism.** This plan only *separates* them so one can be added later;
  `ledger/` already has one, the other four do not. That is its own decision.
- **Rewriting `ledger/` and `log/`.** They record what was true on the day.

## Open questions / risks

- **A blanket sweep will rewrite these migration plans again** if the exclusion is forgotten — it has already
  happened twice in this session. Every rewrite step names its exclusions; verify with a diff on the plans
  before committing, not after.
- **`commons` is gitignored by the parent**, so `git mv` will not work on it and `git status` will not show the
  rename. Use plain `mv` and verify by hand that the inner repo is intact.

## Decisions to distill

- **Bloat has a shape: append-only registries bloat, stable standards do not.** Measured, not assumed — every
  platform doc over 15KB is a registry and no standard reaches 16KB. Separating the two kinds is what makes a
  rotation mechanism targetable instead of a vague "keep files small" wish.
- **A number prefix encodes creation order and nothing else.** It survives only while no file ever moves; the
  first reorganisation turned it into a sequence with holes. A folder plus a descriptive name carries the same
  ordering information and stays true.
- **`git add -A` in a repo another session may be writing to publishes work you never read.** This session's
  Step-0 commit silently swept in a 288-line `/ui-ux-review` skill installed by a concurrent session, and pushed
  it under a commit message about something else. The skill turned out to be benign — checked after the fact,
  which is the wrong order. Installing a skill is a human-gated act precisely because nobody should be able to
  add one unreviewed; `add -A` routed around that gate without anyone intending to. **Stage explicit paths.**
- The file-naming convention had **never been written down** — the mixed casing was not a forgotten rule, it
  was the absence of one. Worth checking before assuming drift: sometimes there is nothing to drift from.
