# NUC backup — Restic → Backblaze B2 (idea-0014, Option B)

Version-controlled backup assets for the NUC. **Plan:** `platform/plans/2026-06-19-idea-0014-nuc-backup.md` ·
**Why/sources:** `platform/plans/2026-06-19-idea-0014-nuc-backup-proposal.md`.

These files live in git; **secrets do not** (invariant #4). The agent authored them (T1/T2); the deploy steps below are
**human-run on the NUC** (`ssh` is gated for the agent).

## What it does

- App-consistent dumps: Postgres `pg_dumpall`/`pg_dump`, SQLite `.backup` (never a live file copy — that yields a
  corrupt/crash-state backup).
- One encrypted, deduplicated `restic` snapshot of every named volume + the dumps, straight to Backblaze B2 (offsite).
- `systemd` timer (`Persistent=true` → a missed nightly run fires on next wake; the NUC is not 24/7).
- Weekly `restic check --read-data-subset=25%`; failure → Discord; quarterly restore drill.

## Files

| File | Goes to (on the NUC) |
|------|----------------------|
| `restic-backup.sh` | `/usr/local/sbin/restic-backup.sh` (chmod 755) |
| `restic-restore-test.sh` | `/usr/local/sbin/restic-restore-test.sh` (chmod 755) |
| `notify-failure.sh` | `/usr/local/sbin/notify-failure.sh` (chmod 755) |
| `backup.env.example` | `/etc/restic/backup.env` (filled, chmod 600 — NOT committed) |
| `systemd/*.service`, `systemd/*.timer` | `/etc/systemd/system/` |

## Deploy (human, on the NUC)

> Do plan **step 1 first** — verify each volume's engine + the DB container names/paths, then fill `backup.env`
> (`PG_DUMPS`, `SQLITE_DBS`). The defaults are assumptions (n8n_data/todo_data engines unconfirmed).

```bash
sudo apt install -y restic sqlite3                 # sqlite3 needed for SQLite .backup
sudo install -m755 restic-backup.sh restic-restore-test.sh notify-failure.sh /usr/local/sbin/
sudo install -m644 systemd/*.service systemd/*.timer /etc/systemd/system/
sudo mkdir -p /etc/restic
sudo cp backup.env.example /etc/restic/backup.env && sudo chmod 600 /etc/restic/backup.env
# edit /etc/restic/backup.env with real B2 keys + DB config; create the password file:
printf '%s' '<a-strong-passphrase>' | sudo tee /etc/restic/password >/dev/null && sudo chmod 600 /etc/restic/password
#   ^ STORE THIS PASSPHRASE OFFSITE TOO (password manager) — losing it = unrecoverable repo.

# init the repo + first backup (verify a snapshot lands):
sudo --preserve-env bash -c 'set -a; . /etc/restic/backup.env; restic init'
sudo systemctl start restic-backup.service && restic snapshots   # one snapshot, all volumes + dumps

# restore drill (do this BEFORE trusting it):
sudo --preserve-env bash -c 'set -a; . /etc/restic/backup.env; /usr/local/sbin/restic-restore-test.sh'

# enable the schedule:
sudo systemctl daemon-reload
sudo systemctl enable --now restic-backup.timer restic-check.timer
systemctl list-timers | grep restic
```

## After deploy — update the docs (plan step 8)

`INVENTORY §2` (add the backup component), `registries/known-traps.md` (live-DB file-copy hazard), `architecture-and-operations`
(backup section). Do this once the setup is live so the docs describe reality, not intent.
