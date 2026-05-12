#!/usr/bin/env bash
#
# across.sh — run a command in every sibling mesh-* app directory.
#
# Usage:
#   across.sh <command> [args...]
#   across.sh --parallel <command> [args...]   # run all in parallel
#   across.sh --filter <glob> <command>        # only matching app names
#
# Examples:
#   across.sh npm test:unit
#   across.sh --parallel npm run build
#   across.sh --filter 'mesh-*-bridge' git status
#
# The script:
#   - Skips mesh-common itself.
#   - Skips dirs without package.json.
#   - Prints a per-app banner and final pass/fail summary.
#   - Exits non-zero if any app's command failed.
#
set -uo pipefail

PARALLEL=0
FILTER="mesh-*"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --parallel) PARALLEL=1; shift ;;
    --filter) FILTER="$2"; shift 2 ;;
    *) break ;;
  esac
done

if [[ $# -lt 1 ]]; then
  echo "usage: across.sh [--parallel] [--filter <glob>] <command> [args...]" >&2
  exit 64
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PARENT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PIDS=()
LOGS=()
APPS=()

shopt -s nullglob
for dir in "$PARENT"/$FILTER/; do
  app="$(basename "$dir")"
  [[ "$app" == "mesh-common" ]] && continue
  [[ ! -f "$dir/package.json" ]] && continue
  APPS+=("$app")
done

if [[ ${#APPS[@]} -eq 0 ]]; then
  echo "across.sh: no apps matched filter '$FILTER'" >&2
  exit 1
fi

mkdir -p /tmp/mesh-across-logs
> /tmp/mesh-across-logs/summary

run_one() {
  local app="$1"; shift
  local log="/tmp/mesh-across-logs/${app}.log"
  if (cd "$PARENT/$app" && "$@") > "$log" 2>&1; then
    echo "✓ $app" >> /tmp/mesh-across-logs/summary
  else
    echo "✗ $app  (see $log)" >> /tmp/mesh-across-logs/summary
  fi
}

if [[ $PARALLEL -eq 1 ]]; then
  for app in "${APPS[@]}"; do
    run_one "$app" "$@" &
    PIDS+=($!)
  done
  for pid in "${PIDS[@]}"; do
    wait "$pid" || true
  done
else
  for app in "${APPS[@]}"; do
    echo "================================================================"
    echo "  $app"
    echo "================================================================"
    if (cd "$PARENT/$app" && "$@"); then
      echo "✓ $app" >> /tmp/mesh-across-logs/summary
    else
      echo "✗ $app" >> /tmp/mesh-across-logs/summary
    fi
  done
fi

echo
echo "================================================================"
echo "  Summary"
echo "================================================================"
cat /tmp/mesh-across-logs/summary
fail_count=$(grep -c '^✗' /tmp/mesh-across-logs/summary || true)
[[ $fail_count -eq 0 ]]
