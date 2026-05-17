#!/usr/bin/env bash
#
# audit-app-security.sh — shared programmatic security audit for any mesh-* app.
#
# Two passes, both headless and GPU-free:
#
#   1. crypto invariants (vitest in jsdom) — runs the shared mesh-common suite
#      `tests/securityAudit.test.ts` regardless of which app invoked us. These
#      are the foundation guarantees (Ed25519 sign/verify, TOFU registry,
#      moderator state machine, forged/expired claim rejection) — they apply
#      to every app that bundles mesh-common.
#
#   2. UI flow (playwright in chromium headless) — runs ONLY if this app has a
#      `tests/e2e/security-audit.spec.ts`. Apps that don't expose the moderator
#      UI yet get pass 1 only, and the report says so explicitly.
#
# Outputs `docs/security-audit.{json,md}` so each app's GitHub Pages serves
# a publicly verifiable audit at:
#   https://baditaflorin.github.io/<app-name>/security-audit.md
#
set -euo pipefail

APP_DIR="$(pwd)"
APP_NAME="$(basename "$APP_DIR")"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
COMMON_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TMP="/tmp/mesh-audit-$APP_NAME"
mkdir -p "$TMP"
UNIT_LOG="$TMP/unit.jsonl"
E2E_LOG="$TMP/e2e.jsonl"
UI_SPEC="tests/e2e/security-audit.spec.ts"

# --- pass 1: unit / crypto invariants (always runs) --------------------------
echo "==> [$APP_NAME] audit pass 1/2 — crypto invariants (vitest)"
(
  cd "$COMMON_DIR"
  MESH_AUDIT_FILE="$UNIT_LOG" npx vitest run tests/securityAudit.test.ts --reporter=dot
)

# --- pass 2: UI flow (only if this app has the spec) ------------------------
RAN_UI=0
if [ -f "$UI_SPEC" ]; then
  echo "==> [$APP_NAME] audit pass 2/2 — UI flow (playwright)"
  MESH_AUDIT_FILE="$E2E_LOG" npx playwright test "$UI_SPEC" --reporter=line
  RAN_UI=1
else
  echo "==> [$APP_NAME] no UI spec at $UI_SPEC — skipping pass 2"
  : > "$E2E_LOG"
fi

# --- render report -----------------------------------------------------------
echo "==> [$APP_NAME] rendering report"
APP_NAME="$APP_NAME" RAN_UI="$RAN_UI" \
  node "$COMMON_DIR/scripts/render-security-audit.mjs" \
  "$UNIT_LOG" docs "$E2E_LOG"

echo "==> [$APP_NAME] done — see docs/security-audit.md"
