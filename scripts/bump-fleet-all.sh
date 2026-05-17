#!/usr/bin/env bash
#
# bump-fleet-all.sh — rebuild + ship every sibling mesh-* app after a
# mesh-common bump. Unlike bump-qr-fleet.sh (which targets the 20 QR apps),
# this script walks ALL sibling apps with a package.json.
#
# For each app:
#   1. npm run smoke  (builds docs/, runs typecheck, runs e2e — Husky pre-push
#      already enforces this on commits, but we do it here to fail fast)
#   2. if docs/ or tests/ changed, commit + push
#   3. record pass/fail in /tmp/mesh-bump/summary
#
# Usage:
#   bump-fleet-all.sh "<commit-message>"
#
# Soft on failures: continues even if individual apps fail, then reports
# the full pass/fail breakdown at the end. Exit code is non-zero if any app
# failed its smoke build.
set -uo pipefail

PARENT="$(cd "$(dirname "$0")/../.." && pwd)"
COMMIT_MSG="${1:-chore: rebuild docs after mesh-common bump}"
LOG_DIR="/tmp/mesh-bump"
mkdir -p "$LOG_DIR"
> "$LOG_DIR/summary"

shopt -s nullglob
APPS=()
for dir in "$PARENT"/mesh-*/; do
  app="$(basename "$dir")"
  [[ "$app" == "mesh-common" ]] && continue
  [[ ! -f "$dir/package.json" ]] && continue
  APPS+=("$app")
done

echo "==> bumping ${#APPS[@]} apps"

total=${#APPS[@]}
pass=0
nochange=0
fail=0
pushed=0

i=0
for app in "${APPS[@]}"; do
  i=$((i + 1))
  DIR="$PARENT/$app"
  printf '[%d/%d] %s ' "$i" "$total" "$app"

  # Auto-format first so the pre-commit hook's `fmt:check` doesn't reject
  # commits caused by agent-touched files that aren't prettier-clean.
  (cd "$DIR" && npm run fmt) > "$LOG_DIR/$app.log" 2>&1 || true

  if ! (cd "$DIR" && npm run smoke) >> "$LOG_DIR/$app.log" 2>&1; then
    echo "✗ smoke"
    echo "✗ $app  (smoke failed — see $LOG_DIR/$app.log)" >> "$LOG_DIR/summary"
    fail=$((fail + 1))
    continue
  fi

  cd "$DIR"
  if git diff --quiet HEAD -- docs/ tests/ src/ 2>/dev/null; then
    echo "✓ no changes"
    nochange=$((nochange + 1))
    echo "= $app  (no changes)" >> "$LOG_DIR/summary"
    cd "$PARENT"
    continue
  fi

  git add docs/ tests/ src/ 2>/dev/null || true
  if git -c user.name="Florin Badita" -c user.email="baditaflorin@gmail.com" \
       commit -q -m "$COMMIT_MSG" >> "$LOG_DIR/$app.log" 2>&1; then
    if git push -q >> "$LOG_DIR/$app.log" 2>&1; then
      echo "✓ pushed"
      pushed=$((pushed + 1))
      pass=$((pass + 1))
      echo "✓ $app  (pushed)" >> "$LOG_DIR/summary"
    else
      echo "✗ push failed"
      echo "✗ $app  (push failed)" >> "$LOG_DIR/summary"
      fail=$((fail + 1))
    fi
  else
    echo "✗ commit failed"
    echo "✗ $app  (commit failed)" >> "$LOG_DIR/summary"
    fail=$((fail + 1))
  fi
  cd "$PARENT"
done

echo
echo "================================================================"
echo "  $total apps · $pushed pushed · $nochange no-change · $fail failed"
echo "================================================================"
[[ $fail -eq 0 ]]
