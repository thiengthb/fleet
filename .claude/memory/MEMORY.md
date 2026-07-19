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
- [Check prior decisions early](check-prior-decisions-early.md) — during design chat, cross-check the idea vs existing plans/decisions/built code BEFORE endorsing; user iterates fast and may reverse his own recent work
- [User edits files concurrently](user-edits-files-concurrently.md) — user edits in their own IDE mid-session; re-check git status/diff before build+commit, stage only my files, surface conflicts don't auto-merge
- [Apply features across all surfaces](apply-features-across-all-surfaces.md) — apply a control/behavior/RULE to EVERY applicable surface via the shared component, name the exceptions; he audits for completeness
