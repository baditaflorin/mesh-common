#!/usr/bin/env bash
#
# install-ux-foundation-probe.sh — refresh the generic browser-release suite
# in one existing mesh-* app without changing its feature source.
#
# Usage:
#   bash mesh-common/scripts/install-ux-foundation-probe.sh <path-to-app>
#
# The probe is intentionally copied rather than imported at runtime: each app
# runs it through its own Playwright configuration and deployed base URL.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_DIR="$SCRIPT_DIR/../scaffold/template/tests/e2e"
TARGET="${1:-}"

if [[ -z "$TARGET" ]]; then
  echo "usage: $0 <path-to-app>" >&2
  exit 64
fi
if [[ ! -f "$TARGET/package.json" ]]; then
  echo "install-ux-foundation-probe: app package.json missing: $TARGET" >&2
  exit 1
fi

mkdir -p "$TARGET/tests/e2e"
for template in smoke.spec.ts mesh.spec.ts mesh-shell-foundation.spec.ts; do
  source="$TEMPLATE_DIR/$template"
  if [[ ! -f "$source" ]]; then
    echo "install-ux-foundation-probe: template missing: $source" >&2
    exit 1
  fi
  cp "$source" "$TARGET/tests/e2e/$template"
done
bash "$SCRIPT_DIR/install-perf-checks.sh" "$TARGET"
echo "refreshed smoke, mesh, UX foundation, performance, and leak probes in $TARGET/tests/e2e"
