#!/usr/bin/env bash
# Restore drill (plan step 5) — an UNTESTED backup is not a backup.
# Restores the latest snapshot to a temp dir and lists what it recovered, so you can verify a DB
# dump + a data volume are actually present and loadable. Does NOT touch production. Run manually
# (quarterly) on the NUC:  sudo --preserve-env=RESTIC_REPOSITORY,RESTIC_PASSWORD_FILE,B2_ACCOUNT_ID,B2_ACCOUNT_KEY ./restic-restore-test.sh
set -euo pipefail
: "${RESTIC_REPOSITORY:?}"; : "${RESTIC_PASSWORD_FILE:?}"; : "${B2_ACCOUNT_ID:?}"; : "${B2_ACCOUNT_KEY:?}"
export RESTIC_REPOSITORY RESTIC_PASSWORD_FILE B2_ACCOUNT_ID B2_ACCOUNT_KEY

DEST="$(mktemp -d /tmp/restore-test.XXXXXX)"
echo "[restore-test] restoring latest -> $DEST"
restic restore latest --target "$DEST"
echo "[restore-test] recovered files:"
find "$DEST" -name 'pg-*.sql' -o -name 'sqlite-*.db' | sed 's/^/  /'
echo "[restore-test] VERIFY MANUALLY: load one pg dump (psql -f) + open one sqlite db (sqlite3 ... .tables),"
echo "[restore-test] confirm row counts look sane, THEN: rm -rf $DEST"
echo "[restore-test] (left in place on purpose so you can inspect; delete it yourself when done)"
