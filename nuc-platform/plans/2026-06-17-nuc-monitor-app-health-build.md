---
title: nuc-monitor app-health build (Option D) — alert on Docker `unhealthy` + deep readiness in journal/yakudoku
kind: feature # feature | system-change | fix | refactor | chore
status: blocked
checkin: 2026-09-26 # backstop: is the NUC back yet? (real trigger is the INVENTORY NUC STATUS row)
auto_pilot: false # multi-repo + deploy gate; supervised
created: 2026-06-17
updated: 2026-06-17 # code complete (nuc-monitor + journal + yakudoku-core + core test); all py_compile OK; PARKED at deploy gate P2 (push to main = T4 = human)
proposal: nuc-platform/plans/2026-06-17-nuc-monitor-app-health-proposal.md
idea: idea-0012 (done)
related:
  - nuc-monitor/monitor.py
  - nuc-monitor/CLAUDE.md (invariant: no edge/no port)
  - journal/Dockerfile
  - yakudoku/web/Dockerfile
  - yakudoku/core/Dockerfile (already has a HEALTHCHECK)
  - nuc-platform/INVENTORY.md (§1 Monitor column)
---

> **BLOCKED 2026-07-28 — on hardware, not on work.** M1/M2 and the app-side readiness endpoints are done (7 of 9
> boxes). What is left is **P2: deploy to the NUC**, and the NUC has been down since 2026-07-22 (see the NUC STATUS
> block in `INVENTORY.md`). There is nothing to do here until the host is back, so the status is `blocked` rather than
> `active` — a plan that cannot move should not keep appearing on the dangling-plan clock as if someone were ignoring
> it. The remaining M3 (an "🩺 Unhealthy" line in the daily heartbeat) is explicitly optional.
>
> **Unblock trigger:** the NUC STATUS row in `INVENTORY.md` flips to 🟢 (verified by `/nuc-health-audit`).


## Goal

Close the journal + yakudoku monitoring gap (INVENTORY §1 "(not yet)") **without** touching nuc-monitor's network
isolation. nuc-monitor reads each container's Docker-computed `State.Health.Status` over the `docker.sock` it already
mounts and alerts (edge-triggered) when a container is `unhealthy`. The *deep* part — "is Postgres reachable?" — lives
inside each app's container `HEALTHCHECK`, so "healthy" means "app + its DB are actually serving", and nuc-monitor never
needs to reach an app over the network.

## Why Option D (one line)

A (join `edge`) violates the documented nuc-monitor invariant; D respects every invariant, needs no network change, and
catches "Postgres down" by putting the DB ping inside the app's own HEALTHCHECK. Full rationale: the proposal.

## Prior art & sources (inherited from the accepted proposal)

- [Kubernetes health checks — liveness vs readiness (Better Stack)](https://betterstack.com/community/guides/monitoring/kubernetes-health-checks/)
  — liveness shallow, readiness deep (DB `SELECT 1`, short timeout). Drives the `/api/health` (shallow) vs `/api/ready`
  (deep) split below.
- [Blackbox monitoring — internal vs public probing & flapping (oneuptime)](https://oneuptime.com/blog/post/2026-01-25-prometheus-blackbox-monitoring/view)
  — edge-triggered alerting + flap suppression (never alert the `starting` grace), reused from `check_docker`.

> Note: this is the *build* plan for an already-accepted, already-researched proposal — the sources live there; repeated
> here only to satisfy the in-loop prior-art gate.

## Acceptance criteria (Given/When/Then — 1 AC → 1 test)

- **AC1 (monitor: alert on unhealthy)** — *Given* a tracked container reports `State.Health.Status == "unhealthy"`,
  *When* `check_app_health` runs, *Then* exactly one `critical` Discord alert fires for it (edge-triggered: not repeated
  on the next cycle while still unhealthy).
- **AC2 (monitor: recovery)** — *Given* a container previously alerted unhealthy, *When* it returns `healthy`, *Then* one
  `info` "App recovered" alert fires and the alert key is cleared.
- **AC3 (monitor: grace + no-healthcheck)** — *Given* a container is `starting`, OR has no `HEALTHCHECK` (no
  `State.Health`), *When* `check_app_health` runs, *Then* no alert fires and the loop does not raise.
- **AC4 (journal readiness)** — *Given* journal's Postgres is unreachable, *When* the container HEALTHCHECK runs, *Then*
  the `/api/ready` route returns 503 and Docker marks the container `unhealthy` within the healthcheck interval.
- **AC5 (yakudoku-web — NO deep readiness; liveness only)** — yakudoku-web owns **no database** (HTTP-only client to
  core), so a "DB-deep" check is N/A. Its existing shallow `/api/health` HEALTHCHECK is the correct check; nuc-monitor
  still gains coverage (alerts if the web process wedges → `unhealthy`). No app-side change. (Core reachability is
  monitored independently via core's own healthcheck — adding a core-ping to web would double-page on one outage.)
- **AC6 (yakudoku-core readiness)** — *Given* yakudoku-core's SQLite DB is unreadable (locked/corrupt/missing), *When*
  the HEALTHCHECK runs, *Then* the deepened readiness route runs `SELECT 1` via `SessionLocal`, returns 503 → `unhealthy`.
- **AC7 (inventory truth)** — INVENTORY §1 shows journal/yakudoku-web/yakudoku-core monitored, annotated "readiness
  (DB-deep) via container HEALTHCHECK → nuc-monitor".

## Steps

### nuc-monitor (this repo)
- [x] M1 (T2) — Add `check_app_health(state)` to `monitor.py`: read `c.attrs['State']['Health']['Status']` via the
      existing docker.sock; alert `critical` on `unhealthy` (edge-triggered), `info` on recovery to `healthy`, skip
      `starting`/no-healthcheck; surface the last probe `Output`. Register it in the `checks` tuple. Drop `health_<name>`
      on container removal. **Done — `py_compile` OK.** (Satisfies AC1–AC3 by construction.)
- [~] M2 (T2) — Tests. yakudoku-core gate EXTENDED: `tests/test_api.py::test_ready_ok_when_db_reachable` +
      `test_ready_open_without_service_token` (AC6 + token-exemption). **nuc-monitor's own `check_app_health` has NO test
      harness** (the app has zero tests today) → logged GAP, deferred: adding the first pytest harness to nuc-monitor is a
      separate chore (a stub `docker` object asserting AC1/AC2/AC3). Not blocking the deploy; flagged, not silently skipped.
- [ ] M3 (T2) — Optional: add an "🩺 Unhealthy" count line to the daily heartbeat (`send_heartbeat`). Low priority — deferred.

### journal (separate repo) — has Postgres → deep readiness valuable
- [x] J1 — Added `journal/app/api/ready/route.ts`: `await prisma.$queryRaw\`SELECT 1\`` → 200 `{ready:true}`, catch → 503
      `{ready:false}`; `dynamic = 'force-dynamic'`; `prisma` from `@/lib/db`. `/api/health` kept shallow. (No Traefik
      exemption needed — Docker calls it over localhost, bypassing forward-auth.)
- [x] J2 — Repointed `journal/Dockerfile` HEALTHCHECK `/api/health` → `/api/ready`; bumped `--start-period` 15s→30s
      (covers migrate-deploy + a live DB query on boot).

### yakudoku-web (separate repo) — NO database → NO change
- [x] Y1 — **No app-side change** (AC5): web owns no DB; shallow `/api/health` liveness is correct. Coverage still
      improves via nuc-monitor reading its existing healthcheck. (Documented, not skipped.)

### yakudoku-core (separate repo) — SQLite owner → deepen
- [x] C1 — Added `app/main.py` route `/ready` (`db.execute(text("SELECT 1"))` via `Depends(get_db)` so the test override
      applies; `HTTPException(503)` on failure). Exempted `/ready` from the service-token guard in `app/auth.py`
      (alongside `/health`). `/health` kept shallow. All `py_compile` OK.
- [x] C2 — Repointed `yakudoku/core/Dockerfile` HEALTHCHECK `/health` → `/ready`.

### platform docs + deploy
- [x] P1 — Updated `INVENTORY.md` §1 Monitor column for journal/yakudoku-web/yakudoku-core (AC7) + a Notes bullet
      describing the Option-D mechanism.
- [ ] P2 (GATE — T4, human) — Deploy: push each changed repo to `main` (journal, yakudoku, nuc-monitor) → CI builds →
      Watchtower auto-pulls. **Push to main = T4 = human only.** After deploy, verify a real `unhealthy` → Discord alert
      end-to-end (stop journal's Postgres briefly, or use a deliberately failing healthcheck on a throwaway). PARK here.
- [~] P3 — `/session-wrap`: distilled into `decisions.md` (nuc-monitor + journal + yakudoku), day-log `2026-06-17-05`,
      ledger §A, journal `00-map` route line (2026-06-17). **Plan stays `active`** — closes (`status: done`) only after P2
      deploy + live verification finishes.

## Decisions to distill

- **D over A (the keystone):** monitor app health by *reading* Docker's healthcheck status over the existing `docker.sock`,
  not by *probing* over a network — respects nuc-monitor's "no edge/no port" invariant. The deep DB check belongs inside
  the app container (where it can reach its own DB), not in the monitor.
- **Liveness vs readiness split (K8s research):** `/api/health` stays shallow (liveness); a new `/api/ready` is deep
  (DB). Docker HEALTHCHECK targets readiness. No restart-loop risk: plain Docker `unhealthy` reports status, it does not
  auto-restart (unlike a K8s liveness probe), so a deep healthcheck is safe here.
- **Edge-triggered + grace:** alert once on `unhealthy`, recover on `healthy`, never alert `starting` (flap suppression),
  mirroring `check_docker`. Keys namespaced `health_<name>` (no collision with `docker_<name>`).

## Notes / risks

- 3 separate repos → 3 pushes (separate CI builds + Watchtower pulls). `todo` is `behind 2` (unrelated); pull yakudoku
  fresh before editing if it's behind on this machine.
- nuc-monitor has no local ruff/mypy/test tooling on this machine — CI runs lint; M2 introduces the first test.
- Commit/push only when the supervisor asks (CLAUDE.md). All edits so far are uncommitted, on whatever branch is checked
  out — keep them OFF the parallel `auto/retire-sr-sandbox` branch's commits.


## Check-in runbook

1. Read the **NUC STATUS** block at the top of `nuc-platform/INVENTORY.md`.
2. Still 🔴 → push the `checkin:` date out and stop. Nothing else to do; do not re-plan.
3. Now 🟢 → run `/nuc-health-audit` first (never trust the table blindly after an outage), then execute **P2**:
   push `journal`, `yakudoku`, `nuc-monitor` to `main`, let CI build, confirm Watchtower pulls, verify the readiness
   endpoints answer and that an intentionally-unhealthy container actually raises the alert. Then close this plan.
4. M3 (heartbeat "🩺 Unhealthy" line) stays optional — do it only if the alerting proves noisy without it.
