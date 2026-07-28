---
status: proposed # draft → proposed (awaiting supervisor accept) → accepted → /project-plan
created: 2026-06-19
kind: proposal # analyze stage of /idea → proposal → /project-plan; NOT a build plan
idea: idea-0014 # platform/10-idea-queue.md
related: INVENTORY §1 (volumes), invariant #4 (secrets only in .env), nuc-monitor (Discord alerts), /nuc-set-env
research_status: DONE 2026-06-19 (research-before-design — ≥2 external sources per question; see §Sources). Volume
  inventory cross-checked against INVENTORY §1 (the idea undercounted 6→8 volumes; storage engines corrected vs the
  research assumption — n8n/yakudoku are SQLite, not Postgres).
---

# Proposal — idea-0014: NUC volume backup strategy (Restic)

> **Propose-don't-execute.** This is the analyze stage for the supervisor-accepted idea-0014. It does NOT build anything;
> on accept it graduates to a `/project-plan`. Recommended option flagged `(khuyến nghị)`.

## Problem (plain language first)

Right now, **if the NUC's disk dies or someone runs `docker volume rm` by mistake, every app's data is gone forever** —
there is no backup of any kind, anywhere. All data lives in named Docker volumes on a single machine. That is the single
largest un-mitigated risk on the platform (INVENTORY §2 has no backup component). The fix is small and fits "extend
existing infra": a scheduled task on the NUC that copies the data, encrypted, to cheap offsite storage — no new
always-on service.

## What must be backed up (from INVENTORY §1 — verify live before building)

The idea listed 6 volumes; INVENTORY actually has **8**, and the storage engines differ (this changes the backup
method per volume — a file-level copy of a *live* database can be corrupt):

| Volume | App | Engine | Correct backup method |
|--------|-----|--------|------------------------|
| `authentik_database` | authentik | **PostgreSQL** | `docker exec … pg_dumpall` (logical dump) |
| `journal_db` | journal | **PostgreSQL** (pgvector pg16, on closed `journal_internal` net) | `docker exec … pg_dump` |
| `yakudoku_data` | yakudoku-core | **SQLite** (`/data`) | SQLite online backup (`.backup` / `VACUUM INTO`) — NOT a live file copy (WAL torn-page risk) |
| `n8n_data` | n8n | **SQLite** (n8n default — VERIFY) | SQLite-consistent dump, or quiesce the container during copy |
| `todo_data` | todo | **VERIFY** (likely SQLite/Prisma) | app-consistent if it holds a DB; raw is fine if plain files |
| `authentik_certs` | authentik | files | raw `restic backup` |
| `authentik_media` | authentik | files | raw `restic backup` |
| `authentik_templates` | authentik | files | raw `restic backup` |

> The plan's first step MUST re-confirm engines from each app's compose/config + a live `docker volume ls` (the schema
> drifts; INVENTORY was last volume-verified 2026-06-11).

## Why these methods (research-grounded — see §Sources)

- **Live Postgres data dir ≠ a valid backup.** PostgreSQL docs are explicit: a file-level copy of a running cluster is a
  crash-state image with torn 8 KB pages; "half-way measures will not work." Use `pg_dump`/`pg_dumpall` (snapshot-isolated,
  non-blocking) via `docker exec -i` (the `-i`, not `-t`, avoids TTY corruption of the dump stream).
- **SQLite under WAL has the same hazard** — copying the live file mid-write yields a torn DB. Use the online backup API
  (`sqlite3 db '.backup' out` or `VACUUM INTO`) or stop the writer briefly.
- **Restic for the volumes + dump files:** content-defined-chunk dedup + client-side AES-256 encryption (encrypt-then-MAC),
  so only changed chunks upload and nothing readable leaves the NUC. `restic forget --keep-… --prune` for retention.
- **3-2-1 rule:** ≥3 copies, 2 media, **1 offsite**. A backup on the same disk as production is not a backup.
- **An untested backup is not a backup** — verify with `restic check --read-data-subset` + a periodic real restore drill.

## Options

### Option A — Local-only Restic
`pg_dump`/SQLite-dump + `restic backup` to a local repo on the NUC. **Rejected as an endpoint:** violates 3-2-1 — a disk
failure or `docker volume rm` destroys production AND backup together (exactly idea-0014's stated threat). Acceptable only
as a transient first step.

### Option B — Direct-to-offsite Restic → Backblaze B2  **(khuyến nghị)**
Dump the DBs (Postgres + SQLite) to temp files, `restic backup` all 8 volumes + dumps straight to a B2 repository
(`s3:…backblazeb2.com/<bucket>`), then delete the temp dumps. One `systemd` timer (`Persistent=true` so a missed run
fires on next wake — the NUC is not always up), exits when done (no always-on service).
- **Pro:** true offsite from day one; encrypted before upload; B2 ≈ $6.95/TB/mo and our corpus is small (<~30 GB steady
  state with dedup) → **well under $1/mo**; recovers from total NUC loss. Fits "extend existing infra."
- **Con:** restore from a dead NUC needs internet + restic + the repo password (must be stored offsite — see Secrets);
  avoid aggressive `prune` on B2 (Class-B API cost) — use `--keep-last` + infrequent prune or B2 lifecycle rules.

### Option C — Dual repo (local + B2 mirror)
Local repo for instant restore + `restic copy`/`rclone` mirror to B2. **Defer to a later upgrade:** best only if the NUC
gets a dedicated backup drive; otherwise it doubles maintenance and consumes system-SSD space for little gain at this scale.

**Recommendation: Option B** — cheapest path that actually satisfies 3-2-1, no new service, integrates with the existing
Discord/nuc-monitor alerting. Upgrade to C if/when a second drive is added.

## Schedule, retention, alerting (Option B)

- **Daily** (e.g. 02:30, systemd timer, `Persistent=true`): dump DBs → `restic backup … --tag daily` → `rm` dumps →
  `restic forget --keep-daily 7 --keep-weekly 4 --keep-monthly 3 --prune` (infrequent prune on B2).
- **Weekly** integrity: `restic check --read-data-subset 25%`.
- **Quarterly** restore drill: `restic restore latest --target /tmp/restore-test`, load one DB, verify, delete.
- **Failure alert (extend existing infra):** wire `OnFailure=` (or a healthchecks-style heartbeat) to the **existing
  nuc-monitor Discord channel** — silent backup failure is the #1 real-world failure mode.

## Secrets handling (invariant #4 — never hardcode/print)

- B2 keys + restic repo password live in `/etc/restic/backup.env` (chmod 600, NOT in git/compose) +
  `RESTIC_PASSWORD_FILE` (chmod 600); set via the `/nuc-set-env`-style local mirror so the agent never handles the values.
- **The repo password MUST also be stored offsite** (password manager): if the NUC dies, the encrypted B2 repo is
  unrecoverable without it. This is the most dangerous single point of failure.

## What NOT to do (failure modes to design out)

File-level copy of a live Postgres/SQLite DB · only one copy, on the same disk · repo password only on the NUC · secrets
in the script/compose/a commit · no restore test · no failure alert · aggressive `prune` on B2.

## Open questions for the supervisor (accept gate)

1. **Target:** Backblaze B2 (recommended), or a different S3-compatible / rclone backend you already have?
2. **Offsite-only vs hybrid:** OK to start Option B (offsite-only), upgrade to C later — or is there a spare drive now?
3. **Scope:** back up all 8 volumes, or exclude any (e.g. `authentik_certs` if regenerable)?

## Decisions to distill (on accept)

- DB volumes need app-consistent dumps (pg_dump / SQLite `.backup`), not raw file copies — the engine, not the volume
  count, drives the method. → candidate `02-known-traps.md` entry + a line in `01-architecture-and-operations`.
- Backup is an ops/data-safety gap that sat invisible until surfaced as a queue wildcard; INVENTORY §2 should gain a
  backup component once built (anti-drift).

## Sources (research-before-design, gathered 2026-06-19)

- Restic + Docker volumes: Jan-Lukas Else https://janlukas.blog/dev/restic-docker · Janik von Rotz
  https://janikvonrotz.ch/2020/03/16/backup-docker-volumes-with-ansible-and-restic/
- Restic crypto/dedup/retention: https://words.filippo.io/restic-cryptography/ · https://sumguy.com/restic-repo-maintenance-prune-check-forget/
- Postgres consistency: https://www.postgresql.org/docs/current/backup-file.html · https://www.postgresql.org/docs/current/app-pgdump.html ·
  Docker pg_dump guide https://simplebackups.com/blog/docker-postgres-backup-restore-guide-with-examples
- 3-2-1 + B2/backends: Veeam https://www.veeam.com/blog/321-backup-rule.html · Backblaze https://www.backblaze.com/docs/cloud-storage-integrate-restic-with-backblaze-b2 ·
  cost https://b3n.org/b2-vs-s3-nas-backup/
- Restore testing + scheduling: https://www.vc3.com/blog/untested-data-backup-is-no-backup-at-all ·
  https://safjan.com/verify-backups-restic-example/ · systemd timers https://documentation.suse.com/smart/systems-management/html/systemd-working-with-timers/index.html
