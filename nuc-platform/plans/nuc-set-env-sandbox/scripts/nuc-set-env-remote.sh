#!/usr/bin/env bash
# nuc-set-env-remote.sh - runs ON THE NUC (the local front-end base64-sends it over ssh, never installs it there).
# Reads a KEY=VALUE snippet from STDIN and idempotently UPSERTs it into the app's .env:
#   existing key -> value replaced in place; new key -> appended; every other line (comments, other keys) untouched.
# Atomic (temp + mv on the same fs), preserves chmod 600, keeps one .env.bak. NEVER prints values. Optional recreate.
# Secrets arrive via STDIN only (never argv -> not visible in `ps`/history) and live solely in 0600 files.
#   arg $1 = app name.   env: NUC_RESTART=0 to skip recreate; NUC_ENV_FILE=<path> to override target (tests only).
set -eu

app="${1:-}"
case "$app" in "" | *[!a-z0-9-]*) echo "nuc-set-env: bad app name '$app'" >&2; exit 2 ;; esac
envf="${NUC_ENV_FILE:-/opt/apps/$app/.env}"
[ -f "$envf" ] || { echo "nuc-set-env: no .env at $envf (is the app deployed?)" >&2; exit 3; }
dir="$(dirname "$envf")"

snip="$(mktemp "$dir/.snip.XXXXXX")" || { echo "nuc-set-env: cannot write in $dir (permissions?)" >&2; exit 4; }
out="$(mktemp "$dir/.envnew.XXXXXX")"
chmod 600 "$snip" "$out"
trap 'rm -f "$snip" "$out"' EXIT

cat > "$snip" # STDIN = the pasted KEY=VALUE snippet
grep -qE '^[[:space:]]*[A-Za-z_][A-Za-z0-9_]*=' "$snip" \
  || { echo "nuc-set-env: snippet has no KEY=VALUE lines - nothing to do" >&2; exit 5; }

# Merge - file1 = snippet (overrides), file2 = existing .env (rewrite matched keys in place, append the rest).
awk '
  FNR==NR {
    if ($0 ~ /^[[:space:]]*($|#)/) next
    eq = index($0, "="); if (eq == 0) next
    k = substr($0, 1, eq-1); gsub(/^[[:space:]]+|[[:space:]]+$/, "", k)
    if (k !~ /^[A-Za-z_][A-Za-z0-9_]*$/) next
    val[k] = substr($0, eq+1)
    if (!(k in seen)) { ord[++m] = k; seen[k] = 1 }
    next
  }
  {
    eq = index($0, "=")
    if (eq > 0) {
      ck = substr($0, 1, eq-1); gsub(/^[[:space:]]+|[[:space:]]+$/, "", ck)
      if (ck in val && !(ck in done)) { print ck "=" val[ck]; done[ck] = 1; next }
    }
    print $0
  }
  END { for (i = 1; i <= m; i++) { k = ord[i]; if (!(k in done)) print k "=" val[k] } }
' "$snip" "$envf" > "$out"

cp -p -- "$envf" "$envf.bak"
mv -- "$out" "$envf"
chmod 600 "$envf"

echo "nuc-set-env: keys now in $envf:"
grep -oE '^[A-Za-z_][A-Za-z0-9_]*=' "$envf" | sed 's/=$//' | sort | sed 's/^/  - /'

if [ "${NUC_RESTART:-1}" = "1" ]; then
  if [ -f "$dir/docker-compose.yml" ] || [ -f "$dir/compose.yml" ] || [ -f "$dir/compose.yaml" ]; then
    echo "nuc-set-env: recreating '$app' to apply the new env..."
    (cd "$dir" && docker compose up -d --force-recreate)
  else
    echo "nuc-set-env: no compose file in $dir - restart the app manually to apply the new env." >&2
  fi
else
  echo "nuc-set-env: .env updated; container NOT restarted (--no-restart)."
fi
