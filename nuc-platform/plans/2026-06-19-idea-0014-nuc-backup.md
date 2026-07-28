---
title: NUC volume backup — Restic → Backblaze B2 (Option B), app-consistent DB dumps
status: blocked
checkin: 2026-09-26 # backstop: NUC back? (real trigger = INVENTORY NUC STATUS row)
created: 2026-06-19
updated: 2026-06-19
kind: system-change # research-before-design satisfied by the proposal (≥2 sources, ≥2 ruled-out options)
related: [nuc-platform/plans/2026-06-19-idea-0014-nuc-backup-proposal.md, INVENTORY §1, INVENTORY §2, nuc-platform/02-known-traps.md, 10-idea-queue.md (idea-0014)]
---

> **BLOCKED 2026-07-28 — on hardware.** Step 1 is "verify volumes + engines on the live NUC" over ssh, and the NUC has
> been down since 2026-07-22 (NUC STATUS block in `INVENTORY.md`). Every remaining step is downstream of a host that is
> off. Marked `blocked` rather than `active` so it stops consuming a slot on the dangling-plan clock while nothing can
> be done about it.
>
> **Unblock trigger:** the NUC STATUS row flips to 🟢. This one should be near the FRONT of the queue when it does —
> the host failed on 2026-07-22 with no verified off-box backup of the app volumes, which is precisely the risk this
> plan exists to close.


## Goal
A daily, encrypted, **offsite** backup of all NUC data volumes that has been **restore-tested** — so a disk failure or an
accidental `docker volume rm` is recoverable, not catastrophic. "Done" = a `systemd` timer backs up to B2 nightly,
failures alert via nuc-monitor Discord, and a real restore drill has succeeded.

## Context
INVENTORY §2 has no backup component; all data is in named Docker volumes on one machine = the platform's largest
un-mitigated risk (idea-0014, supervisor-accepted 2026-06-19). Approach + sources + ruled-out options: see the proposal.

## Approach & tradeoffs
**Option B (chosen):** Restic direct to Backblaze B2 (client-side AES-256, dedup), driven by a `systemd` timer
(`Persistent=true`). DB volumes get **app-consistent dumps** (Postgres `pg_dump`/`pg_dumpall`; SQLite `.backup`) — never
a live file copy. Ruled out: **A** local-only (violates 3-2-1) · **C** dual local+B2 (defer — needs a spare drive).
Secrets via `/nuc-set-env`-style mirror (`/etc/restic/*`, chmod 600); repo password ALSO stored offsite. Fits "extend
existing infra": no new always-on service; reuses nuc-monitor Discord for alerts.

## Prior art & sources
Full grounding (≥2 sources/question) in the proposal `2026-06-19-idea-0014-nuc-backup-proposal.md §Sources`. Key:
- Restic + Docker volumes: https://janlukas.blog/dev/restic-docker · https://janikvonrotz.ch/2020/03/16/backup-docker-volumes-with-ansible-and-restic/
- App-consistent DB backup (the core "why"): https://www.postgresql.org/docs/current/backup-file.html · https://simplebackups.com/blog/docker-postgres-backup-restore-guide-with-examples
- 3-2-1 + B2 backend + cost: https://www.veeam.com/blog/321-backup-rule.html · https://www.backblaze.com/docs/cloud-storage-integrate-restic-with-backblaze-b2
- Restore testing + systemd timers: https://www.vc3.com/blog/untested-data-backup-is-no-backup-at-all · https://documentation.suse.com/smart/systems-management/html/systemd-working-with-timers/index.html

**Ruled-out options:** A local-only (violates 3-2-1) · C dual local+B2 (deferred — needs a spare drive). Chosen: B (direct-to-B2).

## Steps
- [ ] 1 — **Verify volumes + engines on the live NUC** (`ssh`: `docker volume ls`, inspect each app's compose). Confirm the 8 volumes + storage engine per the proposal table; correct any drift. · Files: update `INVENTORY §1` if drifted · Test: a verified volume→engine table; `n8n_data` + `todo_data` engines confirmed (SQLite vs Postgres vs files)
- [x] 2 — **DONE 2026-06-19** — authored `nuc-platform/backup/`: `restic-backup.sh` (config-driven PG `pg_dump`/`pg_dumpall` + SQLite `.backup` + `restic backup` all volumes + dumps + `forget --prune`), `restic-restore-test.sh`, `notify-failure.sh`, 5 systemd units (`restic-backup`/`restic-check` service+timer + `restic-notify-failure`), `backup.env.example`, `README.md` (deploy guide). `bash -n` clean on all scripts. DB engines/container names are config-driven via `backup.env` with `VERIFY` notes (step 1 confirms n8n/todo engines).
- [ ] 3 — **(GATE · human)** Create the B2 bucket + application key; provision `/etc/restic/backup.env` (`B2_ACCOUNT_ID/KEY`, `RESTIC_REPOSITORY=s3:…backblazeb2.com/<bucket>`) + `RESTIC_PASSWORD_FILE` via the local mirror; **store the repo password offsite** (password manager). · Test: `restic snapshots` connects to the empty repo over ssh (no secrets printed)
- [ ] 4 — **Init repo + first manual backup** (human/ssh, guided): `restic init`; run `restic-backup.sh` once. · Test: `restic snapshots` shows one snapshot containing all 8 volumes + the DB dumps
- [ ] 5 — **Restore drill** (human/ssh): `restic restore latest --target /tmp/restore-test`; load one PG dump + open one SQLite db; verify row counts; delete temp. · Test: a restored DB opens and looks intact (evidence, not exit code)
- [ ] 6 — **Install schedule** (human/ssh): deploy the units; `systemctl enable --now restic-backup.timer restic-check.timer`. · Test: `systemctl list-timers` shows next run; `journalctl -u restic-backup` after a forced run is clean
- [ ] 7 — **Wire failure alert** (human/ssh): `OnFailure=` (or a healthchecks heartbeat) → nuc-monitor Discord. · Test: simulate a failure (bad env) → a Discord message arrives
- [ ] 8 — **Update docs** (agent-doable): `INVENTORY §2` gains a backup component; `02-known-traps.md` (live-DB file-copy hazard); `01-architecture-and-operations` backup section. · Test: docs match the built setup; `/nuc-health-audit` would find no backup-drift

## Out of scope
Option C dual-repo (later upgrade if a backup drive is added) · Postgres PITR/WAL archiving (overkill at this scale) ·
backing up `/opt/apps` compose/.env config (separate follow-up — though worth a note) · automating the ssh/NUC steps
(those are human-run; `ssh` is T4-gated for the agent).

## Open questions / risks
1. **B2 prune cost** (Class-B API on pack rewrite) → infrequent `prune` / `--keep-last` / B2 lifecycle rules.
2. **SQLite consistency** (`n8n_data`, `yakudoku_data` under WAL) → use `.backup`/`VACUUM INTO`, or quiesce the writer briefly; confirm in step 1.
3. **NUC uptime** (at-logon/periodic, not 24/7) → `Persistent=true` fires a missed nightly run on next wake.

## Decisions to distill
- Per-engine app-consistent dump (PG `pg_dump`, SQLite `.backup`) — the storage engine, not the volume, drives the method; a live file copy of a DB is a corrupt backup. → `02-known-traps.md`.
- 3-2-1 + offsite repo password; an untested backup is not a backup (restore drill is a first-class step). → `decisions.md`.
- INVENTORY §2 must carry a backup component once built (anti-drift); the gap was invisible until surfaced as a queue wildcard.

## Check-in runbook

1. Read the **NUC STATUS** block at the top of `nuc-platform/INVENTORY.md`.
2. Still 🔴 → push `checkin:` out and stop. Do not re-plan, do not re-research; the design is already accepted.
3. Now 🟢 → this plan goes **first**, before feature work. The host failed on 2026-07-22 with no verified off-box
   backup of the app volumes; that gap is still open. Resume at step 1 (verify volumes + engines over ssh), then the
   B2 bucket gate (human), then `restic init` + first backup + a **restore test** — a backup that has never been
   restored is not a backup.
