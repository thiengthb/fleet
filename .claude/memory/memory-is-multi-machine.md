---
name: memory-is-multi-machine
description: How the agent's own memory works — two-tier, shared tier lives in-repo and syncs across machines via git
metadata:
  node_type: memory
  type: reference
  originSessionId: ce0dce5a-3949-422b-8e31-e4a49dd05d35
---

The agent's memory is **two-tier** (set up 2026-06-14). Recall reads both; writing picks the tier with one litmus.

- **Shared (default)** → `.claude/memory/` IN THE REPO, auto-loaded via the `@.claude/memory/MEMORY.md` import in
  `CLAUDE.md`. Travels across machines with `git push/pull` — present on every machine, zero setup beyond `git pull`.
  Holds facts true regardless of machine: who the user is, preferences, feedback, project intent, references.
- **Local** → the native home dir `~/.claude/projects/<path-hash>/memory/`. NOT synced (and its folder name is the
  repo's absolute path hashed, so it differs per machine anyway). ONLY for facts bound to this physical machine.

**Litmus to pick the tier:** "If I sat at a different computer tomorrow, would this fact still be true and useful?"
Yes → shared (repo). No → local (home). One fact = one file = one tier; never duplicate across tiers (drift).

Full mechanics + rule: skill `/memory` and the `## Agent memory` section of `CLAUDE.md`. This OVERRIDES the default
home-directory memory path described by the harness. See [[extend-dont-rebuild]].
