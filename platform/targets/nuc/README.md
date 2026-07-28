# `target: nuc` — the `thienminiserver` auto-deploy chain

> Applies to a project whose `INVENTORY §0` row says `target: nuc`. Platform-wide Invariants A still bind
> (secrets in `.env`, never self-code auth, named volume, repo is the source of truth). These are the additions.

🔴 **Read `platform/INVENTORY.md` § NUC STATUS before any action on this target.** The host has been down since
2026-07-22. While it is down, `git push` builds an image on ghcr and **deploys nothing** — a push is a backup, not
a release. Do not SSH in, do not diagnose Watchtower, do not report a `target: nuc` app as deployed.

## The documents

| Read when | Document |
|---|---|
| Any NUC change — architecture, the deploy chain, the debug-by-layer symptom table (§7) | [`01-architecture-and-operations.md`](01-architecture-and-operations.md) |
| The OS is reinstalled, or you are standing up a second identical server (human-driven, sequential, each step has a VERIFY) | [`03-SETUP-FROM-SCRATCH.md`](03-SETUP-FROM-SCRATCH.md) |
| **"My NUC got reset, rebuild it"** — the agent-facing runbook; read it entirely before the first command | [`04-agent-rebuild-runbook.md`](04-agent-rebuild-runbook.md) |

Cross-cutting infrastructure traps stay in `platform/02-known-traps.md` — they are not NUC-only.

## The seven invariants

They live in **`01-architecture-and-operations.md §0`**, not duplicated here, because that is the document a NUC
change already sends you to and a second copy would drift:

pull-only images · shared `edge` network · public-iff-Traefik-label · dual `latest`+SHA tags · Cloudflare TLS ·
Traefik ≥v3.7 + `DOCKER_API_VERSION=1.44` · Authentik forward-auth.

The three most damaging of them — certbot on the host, a self-hosted runner, publishing a host port — are enforced
in code by `.claude/hooks/invariant-warn.mjs` rather than by anyone remembering them.

## Shape of a NUC app

`/opt/apps/<name>/` on the host holds exactly `docker-compose.yml` + `.env` (chmod 600) + `.gitignore`. A compose
file in the repo is **local-dev only** and is never what runs. SSH: `ssh thien25@thienminiserver`.

## Lifecycle

Onboard/remove/protect/env are skill-driven — see `CLAUDE.md` §"Project lifecycle & ops". Every one of them must
update `INVENTORY §0` in the same turn.
