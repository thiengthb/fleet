#!/usr/bin/env bash
# OnFailure= backstop notifier — fires when a restic unit fails hard (e.g. killed) and the in-script
# trap could not run. Posts to the Discord webhook in backup.env. Best-effort; never fails the unit.
set -uo pipefail
URL="${DISCORD_WEBHOOK_URL:-}"
[ -z "$URL" ] && exit 0
curl -fsS -H 'Content-Type: application/json' \
  -d '{"content":"🛑 NUC restic unit FAILED (systemd OnFailure). Check: journalctl -u restic-backup -u restic-check"}' \
  "$URL" || true
