#!/usr/bin/env bash
# app-env.sh — Git Bash / Linux front-end (parity with app-env.ps1). Pushes ~/.nuc-env/<app>.env into the
# NUC app's .env over ssh; secrets via STDIN (never argv, never the agent chat). Idempotent upsert + force-recreate.
# Skill: /app-env.   usage: ./app-env.sh <app> [--no-restart]
#   env: NUC_HOST (default thien25@thienminiserver) · NUC_ENV_DIR (default ~/.nuc-env)
set -euo pipefail

NUC_HOST="${NUC_HOST:-thien25@thienminiserver}"
ENV_DIR="${NUC_ENV_DIR:-$HOME/.nuc-env}"
RESTART=1
app=""
while [ $# -gt 0 ]; do
  case "$1" in
    --no-restart) RESTART=0; shift ;;
    -*) echo "unknown flag: $1" >&2; exit 1 ;;
    *) app="$1"; shift ;;
  esac
done
[ -n "$app" ] || { echo "usage: app-env.sh <app> [--no-restart]" >&2; exit 1; }
case "$app" in *[!a-z0-9-]* | "") echo "invalid app name: '$app'" >&2; exit 1 ;; esac

local_env="$ENV_DIR/$app.env"
[ -f "$local_env" ] || { echo "no mirror file: $local_env — create it with KEY=VALUE lines, then re-run." >&2; exit 1; }
here="$(cd "$(dirname "$0")" && pwd)"
remote_script="$here/app-env-remote.sh"
[ -f "$remote_script" ] || { echo "missing $remote_script (install it next to this script)" >&2; exit 1; }

grep -qE '^[[:space:]]*[A-Za-z_][A-Za-z0-9_]*=' "$local_env" \
  || { echo "no KEY=VALUE lines in $local_env" >&2; exit 1; }
names="$(grep -oE '^[[:space:]]*[A-Za-z_][A-Za-z0-9_]*=' "$local_env" | tr -d ' ' | sed 's/=$//' | sort | paste -sd, -)"
echo "[app-env] keys -> ${NUC_HOST}:/opt/apps/$app/.env : $names"

# base64 the remote script (non-secret); strip CR so the NUC's bash never sees a \r. Snippet goes via STDIN.
script_b64="$(tr -d '\r' < "$remote_script" | base64 -w0)"
ssh_cmd="f=\$(mktemp) && echo $script_b64 | base64 -d > \$f && NUC_RESTART=$RESTART bash \$f $app; rc=\$?; rm -f \$f; exit \$rc"
ssh "$NUC_HOST" "$ssh_cmd" < "$local_env"
echo "[app-env] done."
