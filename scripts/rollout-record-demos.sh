#!/usr/bin/env bash
#
# rollout-record-demos.sh — record a 15s side-by-side two-peer demo GIF for
# every mesh-* app in the Codex workspace, in parallel, and stash the
# artifacts in this repo at:
#
#   mesh-common/docs/demos/<app>/demo.gif
#   mesh-common/docs/demos/<app>/preview.png
#
# Plus a single status log per app at:
#
#   mesh-common/docs/demos/<app>/record.log
#
# That layout means the whole fleet's walkthroughs live in ONE commit to
# mesh-common, served at https://baditaflorin.github.io/mesh-common/demos/
#
# Usage (from mesh-common/):
#   bash scripts/rollout-record-demos.sh                  # all apps
#   bash scripts/rollout-record-demos.sh mesh-pyramid …   # specific apps
#   PARALLEL=2 bash scripts/rollout-record-demos.sh       # fewer concurrent
#
# Side effect: each app's docs/ is rebuilt (vite build). That's already the
# state the parallel beacon-rollout left most apps in, so it's a wash —
# this script does not touch any app's git tree beyond what `npm run build`
# does as a side effect.
#
set -euo pipefail

WORKSPACE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MESH_COMMON_DIR="$WORKSPACE_DIR/mesh-common"
DEMOS_DIR="$MESH_COMMON_DIR/docs/demos"
RECORD_SCRIPT="$MESH_COMMON_DIR/scripts/record-demo.sh"
PARALLEL="${PARALLEL:-4}"
BASE_PORT="${BASE_PORT:-4200}"

mkdir -p "$DEMOS_DIR"

# Pick the app list.
if [ $# -gt 0 ]; then
  APPS=("$@")
else
  APPS=()
  while IFS= read -r d; do APPS+=("$(basename "$d")"); done < <(
    find "$WORKSPACE_DIR" -maxdepth 1 -mindepth 1 -type d -name 'mesh-*' \
      | grep -v '/mesh-common$' \
      | sort
  )
fi

echo "[rollout] $(date '+%H:%M:%S') — ${#APPS[@]} apps, $PARALLEL parallel workers"

# Worker function: record one app. Allocates its own port. Idempotent.
record_one() {
  local app="$1"
  local port="$2"
  local app_dir="$WORKSPACE_DIR/$app"
  local out_dir="$DEMOS_DIR/$app"
  local log="$out_dir/record.log"
  mkdir -p "$out_dir"

  if [ ! -d "$app_dir" ]; then
    echo "MISSING_DIR" > "$out_dir/status"
    echo "[$app] no such directory: $app_dir" > "$log"
    return
  fi
  if [ ! -f "$app_dir/package.json" ]; then
    echo "NO_PACKAGE_JSON" > "$out_dir/status"
    echo "[$app] no package.json" > "$log"
    return
  fi
  if [ ! -d "$app_dir/node_modules" ]; then
    echo "NO_NODE_MODULES" > "$out_dir/status"
    echo "[$app] node_modules missing — run 'npm install' first" > "$log"
    return
  fi

  # record-demo.sh writes to $DEMO_OUT. Point it directly at our central
  # destination so the app's own docs/ doesn't accumulate demo artifacts.
  # If mesh-common/scenarios/<app>.mjs exists, use it instead of the app's
  # own tests/demo/scenario.mjs (centralised gameplay scenarios = one repo
  # to edit for richer fleet-wide demos).
  local scenario_arg=""
  if [ -f "$MESH_COMMON_DIR/scenarios/$app.mjs" ]; then
    scenario_arg="$MESH_COMMON_DIR/scenarios/$app.mjs"
  fi
  (
    cd "$app_dir"
    DEMO_PORT="$port" \
    DEMO_OUT="$out_dir" \
    DEMO_SCENARIO="${scenario_arg:-tests/demo/scenario.mjs}" \
      bash "$RECORD_SCRIPT" \
      >"$log" 2>&1
  ) && {
    if [ -s "$out_dir/demo.gif" ]; then
      echo "OK" > "$out_dir/status"
    else
      echo "EMPTY_GIF" > "$out_dir/status"
    fi
  } || {
    echo "RECORD_FAILED" > "$out_dir/status"
  }
}
export -f record_one
export WORKSPACE_DIR MESH_COMMON_DIR DEMOS_DIR RECORD_SCRIPT

# Dispatch with bounded parallelism. Each worker gets a unique port.
INDEX=0
PIDS=()
for app in "${APPS[@]}"; do
  port=$(( BASE_PORT + (INDEX % PARALLEL) ))
  record_one "$app" "$port" &
  PIDS+=($!)
  INDEX=$((INDEX + 1))
  # Throttle at PARALLEL outstanding workers
  while [ "$(jobs -rp | wc -l | tr -d ' ')" -ge "$PARALLEL" ]; do
    wait -n 2>/dev/null || sleep 0.5
  done
done
wait

# Summary
OK=0; FAIL=0; SKIP=0
declare -a FAIL_LIST=()
for app in "${APPS[@]}"; do
  s="$(cat "$DEMOS_DIR/$app/status" 2>/dev/null || echo MISSING_STATUS)"
  case "$s" in
    OK) OK=$((OK+1));;
    NO_NODE_MODULES|MISSING_DIR|NO_PACKAGE_JSON) SKIP=$((SKIP+1)); FAIL_LIST+=("$app: $s");;
    *) FAIL=$((FAIL+1)); FAIL_LIST+=("$app: $s");;
  esac
done

echo "[rollout] $(date '+%H:%M:%S') — done"
echo "  OK:   $OK"
echo "  FAIL: $FAIL"
echo "  SKIP: $SKIP"
if [ "${#FAIL_LIST[@]}" -gt 0 ]; then
  echo "  details:"
  for line in "${FAIL_LIST[@]}"; do echo "    $line"; done
fi
