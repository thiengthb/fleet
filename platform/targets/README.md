# `targets/` — deployment law, one folder per kind of machine

> **The agent OS is machine-agnostic; deployment is not.** Everything outside this folder applies everywhere.
> Everything inside it applies only to projects whose `target` says so.

Every project declares a **`target`** in `platform/INVENTORY.md §0`. It is **DATA — read it, never assume.**
Read only the folder that matches; the others are noise for the change in front of you.

| `target` | What it means | Law |
|---|---|---|
| `nuc` | The `thienminiserver` box: git → ghcr → Watchtower → Traefik → `/opt/apps/<name>` | [`nuc/`](nuc/README.md) |
| `local` | Docker on a dev machine (this PC, a laptop). Ports published to the host; no Traefik | [`local/`](local/README.md) |
| `cloud` | A VPS or managed runtime, reachable from the public internet, billed continuously | [`cloud/`](cloud/README.md) |
| `none` | Not deployed at all (meta / shared library) | — |

**A target is a first-class choice, not a ranking.** `local` is not a degraded `nuc`, and `cloud` is not a promoted
one. They differ in *routing, auth surface and who pays* — not in engineering standard. Moving between them should be
a config change, which is exactly why Invariants A (secrets in `.env`, never self-coded auth, named volume, repo is
the source of truth) hold on all of them without exception.

**Changing a project's target is a lifecycle change:** update `INVENTORY §0` in the same turn, and re-read the new
target's law before touching anything — the invariants you were operating under have just been replaced.

> History: this folder exists because the platform was built NUC-first and the naming hid the assumption. When the
> NUC went down on 2026-07-22 the agent kept treating `git push` as a release, because "we deploy locally now" lived
> in its memory rather than in a file it reads. Splitting the law by target is the structural fix.
