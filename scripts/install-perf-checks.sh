#!/usr/bin/env bash
#
# install-perf-checks.sh — copy perf-budget.spec.ts and memory-leak.spec.ts
# into a mesh-* app, substituting __APP_NAME__. Idempotent.
#
# Usage:
#   cd mesh-foo
#   bash ../mesh-common/scripts/install-perf-checks.sh
#
# What it does:
#   - Writes tests/e2e/perf-budget.spec.ts (always; ~3s, fits in pre-push)
#   - Writes tests/e2e/memory-leak.spec.ts (long; you opt-in via npm script)
#   - Adds a `test:leak` script to package.json if missing
#
set -euo pipefail

APP_DIR="$(pwd)"
APP_NAME="$(basename "$APP_DIR")"
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
  sed "s|__APP_NAME__|$APP_NAME|g" "$src" > "$dst"
  echo "[install-perf-checks] wrote $dst"
done

# Add test:leak script via node so we don't shell-edit JSON.
node -e '
  const fs = require("fs");
  const p = JSON.parse(fs.readFileSync("package.json", "utf8"));
  p.scripts ||= {};
  let changed = false;
  if (!p.scripts["test:leak"]) {
    p.scripts["test:leak"] = "playwright test tests/e2e/memory-leak.spec.ts";
    changed = true;
  }
  if (changed) {
    fs.writeFileSync("package.json", JSON.stringify(p, null, 2) + "\n");
    console.log("[install-perf-checks] added test:leak script to package.json");
  } else {
    console.log("[install-perf-checks] package.json already has test:leak");
  }
'
echo "[install-perf-checks] done"
