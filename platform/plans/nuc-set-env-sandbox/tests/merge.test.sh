#!/usr/bin/env bash
# Tests the idempotent-upsert merge in app-env-remote.sh WITHOUT ssh/docker (NUC_ENV_FILE override + NUC_RESTART=0).
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="$HERE/../scripts/app-env-remote.sh"
pass=0; fail=0
ok() { if eval "$1"; then pass=$((pass + 1)); else fail=$((fail + 1)); echo "  FAIL: $2"; fi; }
no() { if eval "$1"; then fail=$((fail + 1)); echo "  FAIL: $2"; else pass=$((pass + 1)); fi; }
run() { NUC_ENV_FILE="$1" NUC_RESTART=0 bash "$SCRIPT" testapp >/dev/null 2>&1; } # stdin=snippet, $1=envfile

tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
env1="$tmp/.env"
printf 'EXISTING=old\n# a comment line\nKEEP=untouched\nEMPTY=\n' > "$env1"

printf 'EXISTING=new\nNEWKEY=added\nB64=LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0t==\n# ignored comment\nbad line no equals\nlower_ok=yes\n' | run "$env1"

echo "[merge.test] assertions:"
ok "grep -qx 'EXISTING=new' '$env1'"                               "existing key value REPLACED in place"
ok "grep -qx 'KEEP=untouched' '$env1'"                             "unrelated key preserved"
ok "grep -qx '# a comment line' '$env1'"                           "comment line preserved"
ok "grep -qx 'EMPTY=' '$env1'"                                     "empty-value key preserved"
ok "grep -qx 'NEWKEY=added' '$env1'"                               "new key APPENDED"
ok "grep -qx 'B64=LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0t==' '$env1'" "base64 value with trailing == preserved verbatim"
ok "grep -qx 'lower_ok=yes' '$env1'"                               "lowercase key accepted"
no "grep -q 'bad line no equals' '$env1'"                          "malformed snippet line ignored"
no "grep -q 'ignored comment' '$env1'"                             "snippet comment not injected"
ok "test -f '$env1.bak'"                                           "backup .env.bak created"
ok "grep -qx 'EXISTING=old' '$env1.bak'"                           "backup holds the PRE-merge content"

# idempotency: same snippet again -> identical file, no duplicate appends
cp "$env1" "$tmp/first"
printf 'EXISTING=new\nNEWKEY=added\nB64=LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0t==\nlower_ok=yes\n' | run "$env1"
ok "diff -q '$tmp/first' '$env1' >/dev/null"                       "idempotent: second identical run = no change"
dups="$(grep -c '^NEWKEY=' "$env1")"
ok "[ '$dups' = '1' ]"                                             "no duplicate key after re-run"

# CRLF snippet (Notepad-saved mirror) must NOT leave a trailing \r on the value
printf 'CRTEST=withcr\r\n' | run "$env1"
ok "grep -qx 'CRTEST=withcr' '$env1'"                              "CRLF snippet line -> value stored with NO trailing CR"
no "grep -qP 'CRTEST=withcr\r' '$env1'"                            "no carriage return survived into .env"

# auto-heal: orphan/malformed lines already in the .env get dropped on the next merge
printf 'GOOD=1\nMIIEvwIBADANBgkqhkiG9w0Borphanbase64line\n-----END PRIVATE KEY-----\nKEEP2=yes\n' > "$env1"
printf 'GOOD=2\n' | run "$env1"
ok "grep -qx 'GOOD=2' '$env1'"                                     "auto-heal: valid key still updated"
ok "grep -qx 'KEEP2=yes' '$env1'"                                  "auto-heal: valid key preserved"
no "grep -q 'MIIEvwIBADANBgkqhkiG9w0Borphanbase64line' '$env1'"    "auto-heal: orphan base64 line dropped"
no "grep -q 'END PRIVATE KEY' '$env1'"                             "auto-heal: orphan PEM footer dropped"

# exit-code guards (capture rc explicitly)
printf '\n# only comments\n' | NUC_ENV_FILE="$env1" NUC_RESTART=0 bash "$SCRIPT" testapp >/dev/null 2>&1; rc=$?
ok "[ $rc -ne 0 ]"                                                 "empty snippet -> nonzero exit (rejected)"
NUC_ENV_FILE="$tmp/nope.env" NUC_RESTART=0 bash "$SCRIPT" testapp </dev/null >/dev/null 2>&1; rc=$?
ok "[ $rc -ne 0 ]"                                                 "missing target .env -> nonzero exit"
printf 'X=1\n' | NUC_RESTART=0 bash "$SCRIPT" 'bad name!' >/dev/null 2>&1; rc=$?
ok "[ $rc -ne 0 ]"                                                 "bad app name -> nonzero exit"

echo "[merge.test] $pass passed, $fail failed"
[ "$fail" -eq 0 ]
