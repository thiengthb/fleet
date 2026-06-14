---
name: extend-dont-rebuild
description: Prefers extending existing infrastructure over building parallel systems (anti-drift)
metadata:
  node_type: memory
  type: feedback
  originSessionId: ce0dce5a-3949-422b-8e31-e4a49dd05d35
---

When the user proposes a new system (e.g. "should I add a memory system?"), check what the platform ALREADY
has before designing anything new. The MiniServer platform has a deliberate Knowledge OS — `<project>/docs/
decisions.md` (append-only why-log), `nuc-platform/06-knowledge-ledger.md` (dated cross-project timeline),
`docs/00-map.md`, the `/session-wrap` skill — plus the agent's two-tier file-memory (see [[memory-is-multi-machine]]).
Recommend extending these; don't build a parallel store.

**Why:** A second source of truth drifts (platform ledger lesson #36), and the platform already evaluated and
declined an OpenClaw-style always-on memory daemon (ledger #43) because Claude Code = skills + MCP +
file-memory already covers that ground. This user values truth over agreement and wants the counter-case first.

**How to apply:** On a "build X" request, lead with what already exists + the honest cost/benefit before
proposing new structure. For cross-session continuity, populate the agent memory (`user` + `feedback`
facts), NOT a chronological journal. See [[user-profile]].
