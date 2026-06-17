---
title: Extend nuc-monitor with app-liveness HTTP probing (close the journal + yakudoku coverage gap)
kind: feature # feature | system-change — both REQUIRE prior-art before acceptance
status: accepted # draft → accepted → rejected | superseded
created: 2026-06-17
accepted: 2026-06-17 # Option D (supervisor re-decided after the invariant-conflict discovery)
idea: idea-0012 (nuc-platform/10-idea-queue.md)
---

<!--
  RESEARCH-GROUNDED proposal (idea-0012 → /idea analyze). Propose-don't-execute: queued for the human-accept gate,
  never self-enters the build pipeline. Contract: nuc-platform/09-autonomy-contract.md · CLAUDE.md §"Autonomous agent".
-->

## Problem

`INVENTORY.md` §1 (the SINGLE source of truth) marks **journal, yakudoku-web, yakudoku-core** as `Monitor = (not yet)`
— 3 of 6 running product containers. The reason matters and reshapes the idea: **nuc-monitor does NOT HTTP-probe any
app today.** Its eight checks (`monitor.py:645`) are host-level (CPU/RAM/disk/temp/net/ssh) plus `check_docker`
(`monitor.py:414`), which only reads container **running state** via `docker.sock`. So every app — including the 5 marked
✅ — is monitored only as "is the container up?", never "is the app inside actually answering?".

The real, currently-unreported failure mode: a container stays `running` while the app inside is wedged (event-loop
stuck, Next.js server crashed mid-request, FastAPI deadlocked) → `check_docker` sees `running` and stays silent, but
users get errors. This is exactly the gap blackbox monitoring exists to close: *"when your DB connection pool looks
healthy but users can't reach your API, blackbox probing catches the issue"* (oneuptime). The three apps already expose
health routes — `journal /api/health` (`route.ts:1`), `yakudoku-web /api/health`, `yakudoku-core /health` (confirmed by
its Dockerfile HEALTHCHECK) — so the probe target already exists; only the prober is missing.

**Honest scope note (red-teamed up front):** journal/yakudoku health routes today return a *shallow* `{ ok: true }` — they
do **not** touch Postgres. So HTTP probing alone catches "process wedged / not answering", but a *dead Postgres while the
Node process is fine* would still return 200 and **not** be caught. Truly covering "journal Postgres failure" (the risk
idea-0012 names) needs the endpoints **deepened** to a readiness check. That is a deliberate scope fork below, not an
oversight.

## Prior art & sources — research before designing

- [Kubernetes health checks — liveness vs readiness (Better Stack)](https://betterstack.com/community/guides/monitoring/kubernetes-health-checks/)
  — **liveness = shallow** (process alive, never depend on DB/externals → a DB-down liveness check causes restart loops);
  **readiness = deep** (DB/cache/deps, but fast: `SELECT 1` with a ~500ms timeout, never a heavy aggregation). Reusable
  rule: keep `/api/health` shallow for restart-decisions; add a *separate* deep `/api/ready` if we want DB coverage.
- [Blackbox monitoring — internal vs public probing & flapping (oneuptime / SRE School)](https://oneuptime.com/blog/post/2026-01-25-prometheus-blackbox-monitoring/view)
  — **public probes** catch ingress/cert/tunnel faults (closest to user experience) **but flap more** (false positives
  when only the ingress is down) and need suppression windows; **internal probes** are faster/cheaper and isolate "is the
  app itself up" from "is the path up". Reusable: nuc-monitor already has `AlertState` + `ALERT_COOLDOWN_MIN=15` +
  edge-triggered alerts — the documented flap-suppression mechanism to reuse for app health.

## ⚠️ Discovery during analysis (2026-06-17) — invalidates the first recommendation

Reading the **target's** invariants AFTER the first option pass (a research-before-design miss, now corrected) surfaced a
hard conflict and a better option:

- **`nuc-monitor/CLAUDE.md` invariant:** *"No Traefik/edge, no exposed port — this is a private headless worker by
  design."* `monitor.py:1` docstring: it reaches the world only via `docker.sock` (ro) + host fs (ro) + the Discord
  webhook egress. **Option A requires joining the `edge` network → it violates this invariant.** Crossing it is a
  governance-level decision (relax a documented invariant), not a routine feature.
- **Option D (missed in the first pass, strictly better):** Docker already computes a per-container **`State.Health.Status`**
  (`healthy`/`unhealthy`/`starting`) for any image that declares a `HEALTHCHECK`, and it is readable via the **existing
  `docker.sock` mount** — the very channel `check_docker` (`monitor.py:414`) already uses (`containers.list()` →
  `c.attrs['State']['Health']`). So nuc-monitor can alert on app *un-health* **without any network change, without touching
  `edge`, respecting every invariant.** The deep/readiness check (ping Postgres) lives **inside** the app container's
  `HEALTHCHECK` (where it can reach its own DB) — so D *also* subsumes Option C's benefit without nuc-monitor reaching
  anything. yakudoku-core already declares a deep HEALTHCHECK; journal + yakudoku-web (Next.js) need one added (a small,
  additive Dockerfile line per repo).

## Options considered

| Option | Benefit | Drawback / cost |
| --- | --- | --- |
| **D — Read Docker `HEALTHCHECK` status via the existing `docker.sock`** *(khuyến nghị — revised)* | Zero network change; respects ALL nuc-monitor invariants (no edge, no port, headless). Extends `check_docker` to also alert on `unhealthy` (edge-triggered, reuses recovery). Deep readiness (Postgres ping) runs *inside* each app's HEALTHCHECK → catches "Postgres down" too. Docker auto-restarts truly-dead containers as a bonus. | Needs a `HEALTHCHECK` line added to journal + yakudoku-web Dockerfiles (additive, per-repo); yakudoku-core already has one. Detects health only at Docker's healthcheck `--interval` granularity (fine; ~30s). |
| **A — Internal `edge`-network HTTP probe** | Active HTTP GET to `http://<svc>:<port><path>` over `edge`; nuc-monitor owns the probe logic + target list. | **Violates the nuc-monitor "no edge/port" invariant** (needs a human to relax it). Still wouldn't catch dead Postgres unless endpoints deepened. Superseded by D. |
| **B — Public-URL probe via Cloudflare** | Validates the **full** user path (DNS→tunnel→Traefik→cert→app); no edge change. | Noisier (tunnel flap → false "down"; 443 flaky on 2026-06-17), pages you for an app that's actually fine. |
| **C — deepen the health endpoints to readiness** | Deep `/api/ready` (`prisma SELECT 1`) so a probe catches "Postgres down". | As a *standalone* it still needs a prober (A or B). Under D it collapses into the in-container HEALTHCHECK — no separate endpoint or edge probe needed. |

## Recommendation

**Option D (khuyến nghị — revised after the discovery above).** Read each container's Docker-computed health via the
`docker.sock` nuc-monitor already mounts, and alert on `unhealthy` the same edge-triggered way `check_docker` alerts on
`down`. **Why not the others:** A violates a documented invariant (joining `edge`) and needs a human to relax it; B pages
on tunnel blips; C as a standalone still needs a prober. D respects every invariant, needs no network change, and — by
putting the deep DB check inside each app's `HEALTHCHECK` — actually closes the "Postgres down" risk that A/B couldn't.
The only cost is one additive `HEALTHCHECK` line in the journal + yakudoku-web Dockerfiles (yakudoku-core already has one).

> **Acceptance bar (one line, Option D):** journal + yakudoku-web declare a `HEALTHCHECK`; nuc-monitor reads each tracked
> container's `State.Health.Status` via `docker.sock` and fires an edge-triggered Discord alert when a container goes
> `unhealthy` (and a recovery when it returns `healthy`), without flapping on the `starting` grace period; `INVENTORY.md`
> §1 reflects the new coverage. Full Given/When/Then ACs go in the resulting `/project-plan`.

## Pre-mortem — failure modes

- **If a container has no `HEALTHCHECK`**, `State.Health` is absent → nuc-monitor must *skip* it silently (not crash, not
  false-alert). Mitigation: guard `c.attrs.get('State',{}).get('Health')` and only evaluate containers that report health.
- **If the `starting` grace period flaps**, a slow-booting app pages you on every deploy. Mitigation: alert only on
  `unhealthy` (never on `starting`), edge-triggered like `check_docker`, with recovery on return to `healthy`.
- **If a Dockerfile `HEALTHCHECK` is shallow** (e.g. journal's stays `curl /api/health` which returns `{ok:true}` without
  touching Postgres), a dead DB still reads `healthy`. Mitigation: make the journal/yakudoku-web HEALTHCHECK hit a *deep*
  route (or add `/api/ready` with `SELECT 1`) so "healthy" means "DB reachable" — this is D's whole readiness advantage and
  must not be skipped.

## Counter-case

For a single-user platform, Docker's own `restart: unless-stopped` + a HEALTHCHECK may already auto-recover a wedged
container before you'd act on the alert, so D's marginal value is the *notification* (you learn it happened) more than the
*recovery* — modest, though cheap enough that the cost/benefit still favours shipping it.

## Decision (human) — the human-accept gate

This is the **human-accept gate of `/idea` → `/project-plan`**. Filled by the supervisor only:

- **accept (which option: A / B / C)** ⇒ I write a `/project-plan` build (`docs/plans/`) and implement; `idea-0012` → `done`.
- **reject (reason)** ⇒ `idea-0012` → `dead` with a tombstone; the reason biases future proposals (Reflexion).
- **deferred (until …)** ⇒ `idea-0012` → `deferred` with a `revisit_when`.

_Agent stops at present + wait. No self-accept._

**DECISION (2026-06-17, supervisor): accept — Option D.** First selected A; on the agent surfacing that A violates
nuc-monitor's "no edge/no port" invariant and that D (read `State.Health.Status` over the existing `docker.sock`) is
strictly better, switched to **D**. Graduated → build plan `plans/2026-06-17-nuc-monitor-app-health-build.md`. `idea-0012`
→ `done` in `10-idea-queue.md`.
