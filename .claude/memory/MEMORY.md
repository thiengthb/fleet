# Agent memory — shared index (multi-machine)

One line per memory, loaded every session via the `@.claude/memory/MEMORY.md` import in `CLAUDE.md` — pointers
only, never content. This is the **shared** tier: it lives in the repo and travels across machines with
`git push/pull`, so the agent keeps its memory of the user on every machine. Machine-specific facts live in the
**local** tier (`~/.claude/projects/<hash>/memory/`), not here. Add a line whenever something non-obvious about
working with this user is learned that `CLAUDE.md`/docs don't already record. Tier rule + write mechanics: skill `/memory`.

- [User profile](user-profile.md) — who I work with: solo architect/operator of the MiniServer platform
- [Extend, don't rebuild](extend-dont-rebuild.md) — prefers extending existing infra over parallel systems (anti-drift)
- [Concise commit messages](concise-commit-messages.md) — short Conventional Commits subject, minimal/no body
- [Commit message Windows encoding](commit-message-windows-encoding.md) — never pipe a PowerShell here-string to git (BOM + dash mangling); use a UTF-8 file or Bash heredoc
- [Memory is multi-machine](memory-is-multi-machine.md) — how my own memory works: shared tier in-repo, syncs via git
- [Research before design](research-before-design.md) — strict anti-bias rule: ground designs in external research first
- [Sandbox-propose governance](sandbox-propose-governance.md) — never edit live governance; propose a tested sandbox copy, human installs
- [Verify end state, not upload](verify-end-state-not-upload.md) — never claim done from an intermediate green step; verify the user-facing result or say it's unverified
- [Report state from the tool](report-state-from-the-tool.md) — read counts/coverage/unpushed-N from git/query AT report time; don't recite a remembered number (miscounted commits twice in one session)
- [Legible proposals, plain language](legible-proposals-plain-language.md) — flag the recommended option, name the skill/process behind any approve gate, explain in everyday language
- [Never print secret file contents](never-print-secret-file-contents.md) — inspect .env/keys by count/length only, never grep -o/cat the values (a leak forces rotation)
- [Route questions via Discord, don't block](route-questions-via-discord-not-blocking.md) — user often away from machine; ask async via Discord + leave readable minutes; don't overclaim autonomy
- [Ask with options, not open-ended](ask-with-options-not-open-ended.md) — present a list of concrete options + a free-input fallback when asking the user (chat AskUserQuestion / Discord --options)
- [Execute over handoff](execute-over-handoff.md) — do the work end-to-end (edit/run/commit when asked), don't hand back manual steps; preserve the "auto" feel
- [Preview visual changes before commit](preview-visual-changes-before-commit.md) — on UI/color/design work, show a preview (static Artifact) + get approval before committing; diff isn't enough
- [Direct over subagent for known context](direct-over-subagent-for-known-context.md) — for internal investigation I already hold context for, work directly (Read/Grep/Bash); don't fan-out subagents
- [Practice-first, lean ceremony](practice-first-lean-ceremony.md) — working result before token-saving; match ceremony to stakes (P-tiers), thin-slice before governance, run longer between gates (5/5 recommendations accepted); over-engineering is the enemy
- [Feature-atomic commits](feature-atomic-commits.md) — prefers one commit per feature even when edits are tangled across shared files; best fix = commit-as-you-go (don't let the batch pile up)
- [Design for generality](design-for-generality.md) — build parameterized by settings + adaptive from data, never hardcoded to the current case (e.g. N3); keep logic multi-user-ready
- [Check prior decisions early](check-prior-decisions-early.md) — cross-check vs existing plans/decisions/built code before endorsing AND before building; user iterates fast and may reverse his own recent work
- [User edits files concurrently](user-edits-files-concurrently.md) — user edits in their own IDE mid-session; re-check git status/diff before build+commit, stage only my files, surface conflicts don't auto-merge
- [Apply features across all surfaces](apply-features-across-all-surfaces.md) — apply a control/behavior/RULE to EVERY applicable surface via the shared component, name the exceptions; he audits for completeness
- [Capability over rearrangement](capability-over-rearrangement.md) — judge UI work by what it lets the user DO; restructuring a familiar screen reads as loss (two redesigns rejected)
- [NUC down, deploy local-only](nuc-down-deploy-local-only.md) — NUC is broken + no VPS (as of 2026-07-22); deploy = LOCAL only, don't SSH/operate the NUC or treat push as going-live; re-verify before assuming it's back
- [Enforce rules with gates](enforce-rules-with-gates.md) — a rule he states must be ENFORCED (gate test + CLAUDE.md invariant + doc), not just documented, so he never has to repeat it; regression twice = add a test
- [Verify target DB before test-writes](verify-target-db-before-test-writes.md) — local-only deploy: prod container shares port 3789 with dev; confirm which server/DB before any test-signup, use a spare port, clean up in the prod volume DB not ./dev.db (I once polluted prod)
- [Rebuild container to review](rebuild-container-to-review.md) — after app-visible edits, rebuild+restart the local Docker container (batch edits, verify healthy+200) so the user sees the running result; skip for doc-only changes
- [Prefers minimal, uncluttered UI](prefers-minimal-uncluttered-ui.md) — strip secondary/decorative elements (milestone banners, captions, toolbars over empty grids, redundant icons); "bớt đi" = remove not shrink; lean but consistent across surfaces
