# Agent memory — shared index (multi-machine)

One line per memory, loaded every session via the `@.claude/memory/MEMORY.md` import in `CLAUDE.md` — pointers
only, never content. This is the **shared** tier: it lives in the repo and travels across machines with
`git push/pull`, so the agent keeps its memory of the user on every machine. Machine-specific facts live in the
**local** tier (`~/.claude/projects/<hash>/memory/`), not here. Add a line whenever something non-obvious about
working with this user is learned that `CLAUDE.md`/docs don't already record. Tier rule + write mechanics: skill `/memory`.

- [User profile](user-profile.md) — who I work with: solo architect/operator of the MiniServer platform
- [Extend, don't rebuild](extend-dont-rebuild.md) — prefers extending existing infra over parallel systems (anti-drift)
- [Concise commit messages](concise-commit-messages.md) — short Conventional Commits subject, minimal/no body
- [Memory is multi-machine](memory-is-multi-machine.md) — how my own memory works: shared tier in-repo, syncs via git
