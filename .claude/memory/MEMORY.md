# Agent memory — shared index (multi-machine)

One line per memory — **pointers only, never content**. This file is loaded at the start of every session as Claude
Code's native auto-memory index (`autoMemoryDirectory` → this directory, set per machine in the gitignored
`.claude/settings.local.json`); the memory files it points at are read on demand, not preloaded.

**Hard cap: 200 lines / 25KB.** Anything past it is silently dropped at load, and a write past it errors. When the index
approaches the cap the fix is to shorten entries and merge or drop stale ones — never to let it spill.

This is the **shared** tier: it lives in the repo and travels with `git push/pull`, so the agent keeps its memory of the
user on every machine. Machine-specific facts go in **`CLAUDE.local.md`** (gitignored, repo root) — *not* a second
memory directory, which would have no index and never load. Add a line whenever something non-obvious about working with
this user is learned that `CLAUDE.md`/docs don't already record. Tier rule, write procedure, and the forgetting
discipline: skill `/memory`. Health check: `node .claude/scripts/memory-audit.mjs`.

- [User profile](user-profile.md) — who I work with: solo architect/operator of the fleet platform
- [Extend, don't rebuild](extend-dont-rebuild.md) — prefers extending existing infra over parallel systems (anti-drift)
- [Concise commit messages](concise-commit-messages.md) — short Conventional Commits subject, minimal/no body
- [Commit message Windows encoding](commit-message-windows-encoding.md) — never pipe a PowerShell here-string to git (BOM + dash mangling); use a UTF-8 file or Bash heredoc
- [Memory is multi-machine](memory-is-multi-machine.md) — how my own memory works: shared tier = repo `.claude/memory/` on native auto-memory rails (enforced caps); machine-local facts → `CLAUDE.local.md`
- [Research before design](research-before-design.md) — strict anti-bias rule: ground designs in external research first
- [Originate and challenge my premises](originate-and-challenge-my-premises.md) — propose beyond the spec; test HIS intuitions against research and name what they get wrong (obedient execution reads as failure)
- [Sandbox-propose governance](sandbox-propose-governance.md) — never edit live governance; propose a tested sandbox copy, human installs
- [Verify end state, not upload](verify-end-state-not-upload.md) — never claim done from an intermediate green step; verify the user-facing result or say it's unverified (containerized app ⇒ rebuild the container + prove it's in the running image, not just "committed")
- [Report state from the tool](report-state-from-the-tool.md) — read counts/coverage/unpushed-N from git/query AT report time; don't recite a remembered number (miscounted commits twice in one session)
- [Legible proposals, plain language](legible-proposals-plain-language.md) — flag the recommended option, name the gate, explain in everyday language; **default report = 3 plain sentences (did / decide / next), detail goes in files not chat**; he won't object to jargon, he just quietly stops following
- [Never print secret file contents](never-print-secret-file-contents.md) — inspect .env/keys by count/length only, never grep -o/cat the values (a leak forces rotation)
- [Route questions via Discord, don't block](route-questions-via-discord-not-blocking.md) — user often away from machine; ask async via Discord + leave readable minutes; don't overclaim autonomy
- [Ask with options, not open-ended](ask-with-options-not-open-ended.md) — present a list of concrete options + a free-input fallback when asking the user (chat AskUserQuestion / Discord --options)
- [Execute over handoff](execute-over-handoff.md) — do the work end-to-end (edit/run/commit when asked), don't hand back manual steps; preserve the "auto" feel
- [Preview visual changes before commit](preview-visual-changes-before-commit.md) — on UI/color/design work, show a preview (static Artifact) + get approval before committing; diff isn't enough
- [Direct over subagent for known context](direct-over-subagent-for-known-context.md) — for internal investigation I already hold context for, work directly (Read/Grep/Bash); don't fan-out subagents
- [Weigh outside practice symmetrically](weigh-outside-practice-symmetrically.md) — same evidence bar for fleet's way and the community's; "fleet already does it" isn't evidence; **kĩ lưỡng** is his word for the standard; my bias refuses what costs fleet — and this did NOT waive the governance-approval gate
- [Practice-first, lean ceremony](practice-first-lean-ceremony.md) — working result before token-saving; match ceremony to stakes (P-tiers), thin-slice before governance, run longer between gates (11/11 recommendations accepted); deletes his own work on evidence — don't protect sunk cost; over-engineering is the enemy
- [Feature-atomic commits](feature-atomic-commits.md) — prefers one commit per feature even when edits are tangled across shared files; best fix = commit-as-you-go (don't let the batch pile up)
- [Design for generality](design-for-generality.md) — build parameterized by settings + adaptive from data, never hardcoded to the current case (e.g. N3); keep logic multi-user-ready
- [Check prior decisions early](check-prior-decisions-early.md) — cross-check vs existing plans/decisions/built code before endorsing AND before building; user iterates fast and may reverse his own recent work
- [User edits files concurrently](user-edits-files-concurrently.md) — user (OR a parallel Claude session on the same tree) edits mid-session; re-check git status/diff before build+commit, stage only my files, surface conflicts don't auto-merge, re-run before blaming a gate
- [Apply features across all surfaces](apply-features-across-all-surfaces.md) — apply a control/behavior/RULE to EVERY applicable surface via the shared component, name the exceptions; he audits for completeness
- [Capability over rearrangement](capability-over-rearrangement.md) — judge UI work by what it lets the user DO; restructuring a familiar screen reads as loss (two redesigns rejected)
- [Read the deploy target, don't remember it](nuc-down-deploy-local-only.md) — `target` + NUC STATUS live in INVENTORY §0; a push is not a release; don't SSH a host that is off
- [Enforce rules with gates](enforce-rules-with-gates.md) — a rule he states must be ENFORCED, not just documented; but escalate in order: restructure so compliance is easiest → measure → gate only if prose lost (measured 2026-07-28); him repeating a UI pattern = STOP the edit and lock it FIRST via `/ui-pattern-lock`
- [Verify target DB before test-writes](verify-target-db-before-test-writes.md) — local-only deploy: prod container shares port 3789 with dev; confirm which server/DB before any test-signup, use a spare port, clean up in the prod volume DB not ./dev.db (I once polluted prod)
- [Rebuild container to review](rebuild-container-to-review.md) — after app-visible edits, rebuild+restart the local Docker container (batch edits, verify healthy+200) so the user sees the running result; skip for doc-only changes
- [Prefers minimal, uncluttered UI](prefers-minimal-uncluttered-ui.md) — strip secondary/decorative elements (milestone banners, captions, toolbars over empty grids, redundant icons); "bớt đi" = remove not shrink; lean but consistent across surfaces
- [Deliver in the reader's format](deliver-in-the-readers-format.md) — .md is a source, not a document; produce what the actual reader opens (PDF/DOCX/XLSX/editable diagram), and ONE bound document not a folder
- [Git fetch before work](git-fetch-before-work.md) — always fetch/pull before reading multi-session state (plans/log/inventory); local can be days behind another machine (once re-did already-installed fixes)
- [Preserve data, prove before removing](preserve-data-prove-before-removing.md) — data preservation outranks tidiness: stage→wait→verify, never delete on a tool's word; two numbers not one; hand him the raw per-file metrics so he can overrule me; he gates progress on test coverage
