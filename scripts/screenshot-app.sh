#!/usr/bin/env bash
#
# screenshot-app.sh — build the current app, start preview server, launch
# Playwright headless, capture docs/screenshot.png. Idempotent.
#
# Usage (run from inside any mesh-* app dir):
#   bash ../mesh-common/scripts/screenshot-app.sh
#
# Optional env vars:
#   SCREENSHOT_PORT  port for the preview server (default 4180)
#   SCREENSHOT_FILE  output file relative to app root (default docs/screenshot.png)
#   SCREENSHOT_SCRIPT  path to a JS interaction script run before screenshot
#
set -euo pipefail

APP_DIR="$(pwd)"
APP_NAME="$(basename "$APP_DIR")"
PORT="${SCREENSHOT_PORT:-4180}"
OUT="${SCREENSHOT_FILE:-docs/screenshot.png}"
SCRIPT="${SCREENSHOT_SCRIPT:-}"

mkdir -p "$(dirname "$OUT")"

echo "==> [$APP_NAME] build for screenshot"
npm run build >/dev/null

echo "==> [$APP_NAME] starting preview on :$PORT"
# Use --strictPort so we error fast if port is taken.
npx vite preview --host 127.0.0.1 --port "$PORT" --strictPort >/tmp/screenshot-preview-$$.log 2>&1 &
PREVIEW_PID=$!

# Wait for server to be ready (up to ~6s)
for i in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:$PORT/$APP_NAME/" >/dev/null 2>&1; then break; fi
  sleep 0.1
done

cleanup() {
  kill "$PREVIEW_PID" 2>/dev/null || true
  wait "$PREVIEW_PID" 2>/dev/null || true
  rm -f /tmp/screenshot-preview-$$.log
}
trap cleanup EXIT

echo "==> [$APP_NAME] capturing $OUT"
node --input-type=module -e "
import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';

const url = 'http://127.0.0.1:$PORT/$APP_NAME/';
const out = '$OUT';
const scriptPath = '$SCRIPT';

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 720, height: 900 },
  deviceScaleFactor: 2,
  baseURL: url,
});
// Seed a stable room so the screenshot looks alive.
await ctx.addInitScript(({ prefix }) => {
  try {
    localStorage.setItem(prefix + ':room', 'screenshot-demo');
    localStorage.setItem(prefix + ':signalingUrl', 'ws://localhost:1/never');
    localStorage.removeItem(prefix + ':iceServers');
    localStorage.setItem(prefix + ':displayName', 'demo');
  } catch {}
}, { prefix: '$APP_NAME' });
const page = await ctx.newPage();
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

if (scriptPath && existsSync(scriptPath)) {
  const mod = await import(scriptPath.startsWith('/') ? scriptPath : process.cwd() + '/' + scriptPath);
  if (mod && typeof mod.default === 'function') await mod.default(page);
}

await page.screenshot({ path: out, fullPage: false });
await browser.close();
console.log('wrote ' + out);
"
echo "==> [$APP_NAME] done"
