#!/usr/bin/env bash
# Count characters and estimate Claude tokens for a file, folder, or whole project.
#
# Wraps `repomix --token-count-tree`, which counts with OpenAI's o200k_base tokenizer.
# That tokenizer UNDERCOUNTS Claude — measured on this repo against Claude Code's own
# /context report: CLAUDE.md 5,845 -> 9,100 (1.56x) and MEMORY.md 1,543 -> 2,300 (1.49x).
# So the raw number is multiplied by CALIBRATION before being reported. Vietnamese prose
# and markdown tables are the worst case (~1.5x); plain English code is closer to ~1.2x.
#
# The ONLY exact counter for Claude is POST /v1/messages/count_tokens (needs an API key).
# This is a fast local estimate, deliberately biased high rather than low.
#
# Usage:
#   ./tokens.sh <path>              # summary for a file / folder / project
#   ./tokens.sh <path> --tree 2000  # + per-file breakdown, files above 2000 raw tokens
#   CALIBRATION=1.2 ./tokens.sh src # override the factor (e.g. English-only codebase)
set -euo pipefail

TARGET="${1:-.}"
CALIBRATION="${CALIBRATION:-1.5}"
WINDOW="${WINDOW:-1000000}" # context window to report the percentage against

if [[ ! -e "$TARGET" ]]; then
  echo "tokens.sh: no such file or directory: $TARGET" >&2
  exit 1
fi

TREE_ARGS=()
if [[ "${2:-}" == "--tree" ]]; then
  TREE_ARGS=(--token-count-tree "${3:-1000}")
fi

# repomix packs a whole directory; for a single file, scope it with --include from its parent.
if [[ -d "$TARGET" ]]; then
  ROOT="$TARGET"
  SCOPE=()
else
  ROOT="$(dirname "$TARGET")"
  SCOPE=(--include "$(basename "$TARGET")")
fi

PACK="$(mktemp -t tokens-pack-XXXXXX.xml)"
trap 'rm -f "$PACK"' EXIT

OUTPUT="$(cd "$ROOT" && npx -y repomix@latest "${SCOPE[@]}" "${TREE_ARGS[@]}" \
  --no-file-summary --no-directory-structure -o "$PACK" 2>&1)"

RAW=$(grep -oE 'Total Tokens: *[0-9,]+' <<<"$OUTPUT" | tail -1 | tr -cd '0-9')
CHARS=$(grep -oE 'Total Chars: *[0-9,]+' <<<"$OUTPUT" | tail -1 | tr -cd '0-9')
FILES=$(grep -oE 'Total Files: *[0-9,]+' <<<"$OUTPUT" | tail -1 | tr -cd '0-9')

if [[ -z "$RAW" ]]; then
  echo "tokens.sh: repomix produced no token count. Raw output:" >&2
  echo "$OUTPUT" >&2
  exit 1
fi

if [[ ${#TREE_ARGS[@]} -gt 0 ]]; then
  # Print the per-file/per-directory tree, dropping repomix's own banner sections.
  sed -n '/Token Count Tree/,/^$/p' <<<"$OUTPUT" || true
fi

EST=$(awk -v r="$RAW" -v c="$CALIBRATION" 'BEGIN { printf "%d", r * c }')
PCT=$(awk -v e="$EST" -v w="$WINDOW" 'BEGIN { printf "%.1f", e * 100 / w }')

printf '\n%s\n' "$TARGET"
printf '  files              %s\n' "${FILES:-1}"
printf '  characters         %s\n' "$CHARS"
printf '  tokens (o200k)     %s   <- raw, undercounts Claude\n' "$RAW"
printf '  tokens (Claude~)   %s   <- x%s calibration, use this one\n' "$EST" "$CALIBRATION"
printf '  share of %s window   %s%%\n' "$WINDOW" "$PCT"
