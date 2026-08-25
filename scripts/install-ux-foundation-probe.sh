#!/usr/bin/env bash
#
# install-ux-foundation-probe.sh — install the observable MeshShell contract
# plus corrected generic performance/leak probes into one existing mesh-* app
# without changing its feature source.
#
# Usage:
#   bash mesh-common/scripts/install-ux-foundation-probe.sh <path-to-app>
#
# The probe is intentionally copied rather than imported at runtime: each app
# runs it through its own Playwright configuration and deployed base URL.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE="$SCRIPT_DIR/../scaffold/template/tests/e2e/mesh-shell-foundation.spec.ts"
TARGET="${1:-}"

if [[ -z "$TARGET" ]]; then
  echo "usage: $0 <path-to-app>" >&2
  exit 64
fi
if [[ ! -f "$TEMPLATE" ]]; then
  echo "install-ux-foundation-probe: template missing: $TEMPLATE" >&2
  exit 1
fi
if [[ ! -f "$TARGET/package.json" ]]; then
  echo "install-ux-foundation-probe: app package.json missing: $TARGET" >&2
  exit 1
fi

mkdir -p "$TARGET/tests/e2e"
cp "$TEMPLATE" "$TARGET/tests/e2e/mesh-shell-foundation.spec.ts"
bash "$SCRIPT_DIR/install-perf-checks.sh" "$TARGET"
echo "installed UX foundation and generic e2e probes in $TARGET/tests/e2e"
