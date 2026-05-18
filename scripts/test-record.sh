#!/usr/bin/env bash
#
# test-record.sh — interactive Playwright codegen wrapper that boots the app
# in `vite preview`, opens two side-by-side peers in chromium, and records
# both interactions to a single .spec.ts file.
#
# Use this when adding a per-app feature spec: you click, the script writes.
# The emitted spec is a starting point — clean it up afterward (add asserts,
# remove waitForTimeout calls that codegen inserts).
#
# Output:
#   tests/e2e/recorded.spec.ts   (rename + clean up; commit when happy)
#
# Requirements: this app must depend on mesh-common (so Playwright is in the
# resolvable node_modules tree) and have a working `npm run build`.
#
set -euo pipefail

APP_DIR="$(pwd)"
APP_NAME="$(basename "$APP_DIR")"
PORT="${RECORD_PORT:-4182}"
OUT_FILE="${RECORD_OUT:-tests/e2e/recorded.spec.ts}"
MESH_COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ ! -f package.json ]; then
  echo "[test-record] run me from inside a mesh-* app directory" >&2
  exit 1
fi

mkdir -p "$(dirname "$OUT_FILE")"

echo "==> [$APP_NAME] build"
npm run build >/dev/null

echo "==> [$APP_NAME] preview server on :$PORT"
npx vite preview --host 127.0.0.1 --port "$PORT" --strictPort >/tmp/test-record-preview-$$.log 2>&1 &
PREVIEW_PID=$!
for _ in $(seq 1 80); do
  if curl -fsS "http://127.0.0.1:$PORT/$APP_NAME/" >/dev/null 2>&1; then break; fi
  sleep 0.1
done

cleanup() {
  kill "$PREVIEW_PID" 2>/dev/null || true
  wait "$PREVIEW_PID" 2>/dev/null || true
  rm -f /tmp/test-record-preview-$$.log
}
trap cleanup EXIT

URL="http://127.0.0.1:$PORT/$APP_NAME/"

cat <<EOF

==> [$APP_NAME] recording session
    Two chromium windows will open. Use them like a real user — click, type,
    drag. When you're done, close the windows (or hit Ctrl-C in the codegen
    panel) to stop recording. The generated spec lands at:

        $OUT_FILE

    HINT: clean it up afterward:
      - Replace literal localStorage values with deterministic fixtures
      - Replace waitForTimeout(...) with locator.waitFor()
      - Add expect() assertions on what should be visible
      - Rename it from recorded.spec.ts → feature.spec.ts when ready

EOF

# Codegen writes to the file via --output. We point it at the app URL.
NODE_PATH="$MESH_COMMON_DIR/node_modules" \
  npx playwright codegen \
  --target=playwright-test \
  --output="$OUT_FILE" \
  --viewport-size="480,820" \
  "$URL"

echo "==> [$APP_NAME] saved $OUT_FILE"
