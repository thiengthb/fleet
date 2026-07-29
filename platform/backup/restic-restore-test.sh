#!/usr/bin/env bash
# Restore drill (plan step 5) — an UNTESTED backup is not a backup.
# Restores the latest snapshot to a temp dir and ASSERTS that what came back is loadable and
# non-empty. Does NOT touch production. Run manually (quarterly) on the NUC:
#   sudo --preserve-env=RESTIC_REPOSITORY,RESTIC_PASSWORD_FILE,B2_ACCOUNT_ID,B2_ACCOUNT_KEY ./restic-restore-test.sh
#
# 2026-07-29 (idea-0021) — this script used to end with `echo "VERIFY MANUALLY: ... confirm row
# counts look sane"`. It asserted NOTHING, so a snapshot full of empty dumps would print "recovered
# files:" and exit 0. That is the platform's own named failure mode twice over: a printed reminder is
# the control that gets skipped, and "a backup is a claim until a restore has been performed"
# (knowledge-ledger 2026-07-20). The checks below are deliberately coarse — they catch the failure
# that actually happens (an empty / wrong-source dump), not subtle corruption.
#
# WHY an empty dump is the realistic failure: compose PREFIXES a named volume with the project name
# (known-traps.md §10), so a config naming a bare volume can point at a path that does not exist, or
# `docker run -v <wrong-name>` silently CREATES an empty one. Nothing upstream fails loudly.
set -euo pipefail
: "${RESTIC_REPOSITORY:?}"; : "${RESTIC_PASSWORD_FILE:?}"; : "${B2_ACCOUNT_ID:?}"; : "${B2_ACCOUNT_KEY:?}"
export RESTIC_REPOSITORY RESTIC_PASSWORD_FILE B2_ACCOUNT_ID B2_ACCOUNT_KEY

# Smallest plausible real artifact. A dump of an empty schema is a few hundred bytes; a real one is
# orders of magnitude bigger. Tune if a genuinely tiny DB ever joins the set.
MIN_SQLITE_BYTES=${MIN_SQLITE_BYTES:-20480}
MIN_PGDUMP_BYTES=${MIN_PGDUMP_BYTES:-4096}

DEST="$(mktemp -d /tmp/restore-test.XXXXXX)"
echo "[restore-test] restoring latest -> $DEST"
restic restore latest --target "$DEST"

fail=0
note() { echo "  $1"; }
bad() { echo "  ✗ $1"; fail=$((fail + 1)); }

mapfile -t sqlites < <(find "$DEST" -name 'sqlite-*.db' | sort)
mapfile -t pgdumps < <(find "$DEST" -name 'pg-*.sql' | sort)

echo "[restore-test] recovered: ${#sqlites[@]} sqlite db(s), ${#pgdumps[@]} pg dump(s)"
if [ ${#sqlites[@]} -eq 0 ] && [ ${#pgdumps[@]} -eq 0 ]; then
  bad "the snapshot contains NO database artifact at all — the backup is not backing up what it claims"
fi

for db in "${sqlites[@]:-}"; do
  [ -n "$db" ] || continue
  name=$(basename "$db")
  size=$(wc -c <"$db")
  if [ "$size" -lt "$MIN_SQLITE_BYTES" ]; then
    bad "$name is only ${size}B (< ${MIN_SQLITE_BYTES}B) — almost certainly an empty or wrong-source volume"
    continue
  fi
  # `.tables` alone passes on a valid-but-empty file, so count them and require > 0.
  #
  # 2026-07-29: this block first collapsed "sqlite3 is not installed" and "the file is not a
  # database" into one message, and a dry-run on a REAL 3.5MB db reported "restored bytes are not a
  # database" on a host without the sqlite3 CLI. Failing loud was right; blaming the wrong thing was
  # not — a misleading failure message on a backup drill sends someone hunting a corruption that
  # isn't there. Tool availability is now its own check.
  if ! command -v sqlite3 >/dev/null 2>&1; then
    bad "cannot verify $name — the sqlite3 CLI is not installed on this host. Install it (apt-get install -y sqlite3) and re-run; a drill that cannot open the file has verified nothing"
    continue
  fi
  tables=$(sqlite3 "$db" "select count(*) from sqlite_master where type='table';" 2>/dev/null || echo "ERR")
  if [ "$tables" = "ERR" ]; then
    bad "$name did not open as SQLite — restored bytes are not a database"
  elif [ "$tables" -eq 0 ]; then
    bad "$name opened but has ZERO tables — an empty volume was backed up"
  else
    note "✓ $name — ${size}B, $tables tables"
  fi
done

for sql in "${pgdumps[@]:-}"; do
  [ -n "$sql" ] || continue
  name=$(basename "$sql")
  size=$(wc -c <"$sql")
  if [ "$size" -lt "$MIN_PGDUMP_BYTES" ]; then
    bad "$name is only ${size}B (< ${MIN_PGDUMP_BYTES}B) — an empty database or a failed dump"
  elif ! grep -qE '^(CREATE TABLE|COPY |INSERT INTO)' "$sql"; then
    bad "$name has no CREATE TABLE / COPY / INSERT — schema-only or truncated, not a restorable dump"
  else
    note "✓ $name — ${size}B, contains table data"
  fi
done

if [ "$fail" -gt 0 ]; then
  # Deliberately does NOT say "the backup is bad": a missing sqlite3 CLI produces a failure here too,
  # and claiming more than was measured is the same sin as the reminder this script replaced.
  echo "[restore-test] FAILED — $fail check(s) above did not pass. Either the snapshot would not"
  echo "[restore-test] restore, or this host could not verify it. Read each ✗ line: it says which."
  echo "[restore-test] artifacts left at $DEST for inspection; delete when done."
  exit 1
fi

echo "[restore-test] PASS — every restored artifact opened and is non-empty."
echo "[restore-test] Still worth one human look (do the row counts match roughly what you expect?):"
echo "[restore-test]   sqlite3 <db> .tables   ·   psql -f <dump> into a scratch database"
echo "[restore-test] artifacts left at $DEST on purpose; delete them yourself when done."
