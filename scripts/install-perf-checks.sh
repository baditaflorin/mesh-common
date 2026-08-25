#!/usr/bin/env bash
#
# install-perf-checks.sh — refresh the generic performance and leak probes in
# a mesh-* app. Idempotent.
#
# Usage:
#   bash mesh-common/scripts/install-perf-checks.sh <path-to-mesh-app>
#   # or from the app directory:
#   bash ../mesh-common/scripts/install-perf-checks.sh
#
# What it does:
#   - Writes tests/e2e/perf-budget.spec.ts (always; budget smoke coverage)
#   - Writes tests/e2e/memory-leak.spec.ts (skipped unless `test:leak` enables it)
#   - Adds or upgrades the conventional `test:leak` script without replacing
#     a custom command.
#
set -euo pipefail

APP_DIR="${1:-$PWD}"
APP_DIR="$(cd "$APP_DIR" && pwd)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMON_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ ! -f "$APP_DIR/package.json" ]; then
  echo "[install-perf-checks] run me from inside a mesh-* app directory" >&2
  exit 1
fi

mkdir -p "$APP_DIR/tests/e2e"

for tmpl in perf-budget memory-leak; do
  src="$COMMON_DIR/scaffold/template/tests/e2e/${tmpl}.spec.ts.tmpl"
  dst="$APP_DIR/tests/e2e/${tmpl}.spec.ts"
  if [ ! -f "$src" ]; then
    echo "[install-perf-checks] missing template $src" >&2
    exit 2
  fi
  cp "$src" "$dst"
  echo "[install-perf-checks] wrote $dst"
done

# Add/update the conventional test:leak command via node so custom scripts
# are never clobbered. The spec itself remains a fast skip under test:e2e.
node - "$APP_DIR/package.json" <<'NODE'
  const fs = require("fs");
  const path = process.argv[2];
  const p = JSON.parse(fs.readFileSync(path, "utf8"));
  p.scripts ||= {};
  let changed = false;
  const conventional = "MESH_RUN_LEAK_TEST=1 playwright test tests/e2e/memory-leak.spec.ts";
  const legacy = "playwright test tests/e2e/memory-leak.spec.ts";
  if (!p.scripts["test:leak"] || p.scripts["test:leak"] === legacy) {
    p.scripts["test:leak"] = conventional;
    changed = true;
  }
  if (changed) {
    fs.writeFileSync(path, JSON.stringify(p, null, 2) + "\n");
    console.log("[install-perf-checks] installed conventional test:leak script");
  } else {
    console.log("[install-perf-checks] preserved custom test:leak script");
  }
NODE
echo "[install-perf-checks] done"
