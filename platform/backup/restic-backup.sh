#!/usr/bin/env bash
# NUC volume backup — Restic -> Backblaze B2 (idea-0014, Option B).
#
# App-consistent dumps for databases (Postgres pg_dump / SQLite .backup), raw restic for file
# volumes, then ONE restic snapshot of every named volume + the dumps. Run by restic-backup.service
# (systemd timer). Config + secrets come from the EnvironmentFile /etc/restic/backup.env
# (chmod 600, NOT in git). This script is version-controlled; secrets are not (invariant #4).
#
# VERIFY before first run (plan step 1): the container names / DB users in PG_DUMPS, the SQLite db
# paths in SQLITE_DBS, and that n8n_data / todo_data engines are actually what backup.env assumes.
set -euo pipefail

# --- required env (from /etc/restic/backup.env) ---
: "${RESTIC_REPOSITORY:?set RESTIC_REPOSITORY in backup.env}"        # s3:s3.<region>.backblazeb2.com/<bucket>
: "${RESTIC_PASSWORD_FILE:?set RESTIC_PASSWORD_FILE in backup.env}"  # chmod 600 file; ALSO store offsite
: "${B2_ACCOUNT_ID:?set B2_ACCOUNT_ID in backup.env}"
: "${B2_ACCOUNT_KEY:?set B2_ACCOUNT_KEY in backup.env}"
DISCORD_WEBHOOK_URL="${DISCORD_WEBHOOK_URL:-}"                       # optional immediate failure alert
export RESTIC_REPOSITORY RESTIC_PASSWORD_FILE B2_ACCOUNT_ID B2_ACCOUNT_KEY

DUMPDIR="$(mktemp -d /tmp/nuc-backup.XXXXXX)"
log(){ echo "[restic-backup] $*"; }
notify_fail(){
  echo "[restic-backup] FAILED: $1" >&2
  [ -n "$DISCORD_WEBHOOK_URL" ] && curl -fsS -H 'Content-Type: application/json' \
    -d "{\"content\":\"\\ud83d\\uded1 NUC backup FAILED: $1\"}" "$DISCORD_WEBHOOK_URL" || true
}
trap 'rm -rf "$DUMPDIR"' EXIT
trap 'notify_fail "at line $LINENO"' ERR

command -v restic >/dev/null || { notify_fail "restic not installed"; exit 1; }

# --- 1) Postgres logical dumps (app-consistent; NEVER a live file copy) ---
# PG_DUMPS = "container:user:db,..."   (db = ALL -> pg_dumpall). Default assumes authentik + journal.
PG_DUMPS="${PG_DUMPS:-authentik-postgresql:authentik:ALL,journal-db:postgres:ALL}"
IFS=',' read -ra _pg <<< "$PG_DUMPS"
for spec in "${_pg[@]}"; do
  [ -z "$spec" ] && continue
  c="${spec%%:*}"; rest="${spec#*:}"; u="${rest%%:*}"; db="${rest#*:}"
  if [ "$db" = "ALL" ]; then
    log "pg_dumpall $c"; docker exec -i "$c" pg_dumpall -U "$u" > "$DUMPDIR/pg-$c.sql"
  else
    log "pg_dump $c/$db"; docker exec -i "$c" pg_dump -U "$u" "$db" > "$DUMPDIR/pg-$c-$db.sql"
  fi
done

# --- 2) SQLite online backups (consistent even under WAL; NEVER a live file copy) ---
# SQLITE_DBS = "volume_name:relative/db.sqlite,..."  (host volume _data path + db file). VERIFY paths.
SQLITE_DBS="${SQLITE_DBS:-}"
if [ -n "$SQLITE_DBS" ]; then
  command -v sqlite3 >/dev/null || { notify_fail "sqlite3 not installed (apt install sqlite3)"; exit 1; }
  IFS=',' read -ra _sq <<< "$SQLITE_DBS"
  for spec in "${_sq[@]}"; do
    [ -z "$spec" ] && continue
    vol="${spec%%:*}"; rel="${spec#*:}"
    src="/var/lib/docker/volumes/$vol/_data/$rel"
    log ".backup sqlite $vol/$rel"
    sqlite3 "$src" ".backup '$DUMPDIR/sqlite-$vol.db'"
  done
fi

# --- 3) restic snapshot: all named volumes (file-level) + the app-consistent dumps above ---
VOLUME_PATHS="${VOLUME_PATHS:-/var/lib/docker/volumes}"
log "restic backup"
# shellcheck disable=SC2086  # VOLUME_PATHS may be a space-separated list (intentional word split)
restic backup $VOLUME_PATHS "$DUMPDIR" --tag nightly --host nuc

# --- 4) retention (infrequent prune to limit B2 Class-B API cost) ---
log "restic forget --prune"
restic forget --keep-daily 7 --keep-weekly 4 --keep-monthly 3 --prune

log "done"
