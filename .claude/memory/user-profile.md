---
name: user-profile
description: "Who the user is — solo architect/operator of the fleet platform, evaluates agent tooling critically"
metadata:
  node_type: memory
  type: user
  originSessionId: ce0dce5a-3949-422b-8e31-e4a49dd05d35
---

Solo architect and operator of the fleet platform (GitHub `thiengthb`, git `thi3n`) — owns the whole
chain: the NUC `thienminiserver`, every app, the docs / Knowledge OS, and the `.claude` skill set. Works
across many sessions on the same long-running system, so continuity and not re-litigating settled decisions
matter to them.

Actively follows the autonomous-agent tooling space (OpenClaw, Hermes, …) and brings ideas from it, but
evaluates critically before adopting (OpenClaw was assessed and declined — see [[extend-dont-rebuild]]).
Thinks at the system-design level, not just feature level: frames a request as "should we, and what's the
best shape" and explicitly invites pushback rather than agreement.

## Interest signals

Explicit, human-tagged input to the idea-queue interest model (the `## /idea sort` derivation reads this section
together with the `outcome: accept/reject` history; see `platform/registries/idea-queue.md` §Rules). Keep terse, one
bullet per durable preference; the supervisor edits this, not the agent. Pairs with the accept/reject oracle, never
replaces it.

- **Leans toward** (raises interest): agent autonomy/governance, the Knowledge OS (memory/docs continuity), and
  **extending existing infra over building parallel systems** — see [[extend-dont-rebuild]]. Designs that are
  research-grounded + bounded + exploration-preserving (the idea-0001 accept signal).
- **Leans away from** (lowers interest): ceremony/over-engineering for a solo operator; net-new services when an
  existing one extends; un-grounded "this would be nice" proposals.
- _Calibrate against the real `outcome:` log over time — this is a starting prior, recency-decayed, not ground truth._
