#!/usr/bin/env bash
#
# record-demo.sh — build, launch preview, open two peer browsers, run an
# app-supplied scenario, and emit:
#
#   docs/preview.png   composited side-by-side final frame (peer A | peer B)
#   docs/demo-a.webm   peer A screen recording
#   docs/demo-b.webm   peer B screen recording
#
# Optional: tests/demo/scenario.mjs exporting `default async (a, b) => …`
# drives the interaction. Without one, a generic "fill name, wait" runs.
#
# Zero shell deps beyond Node + Playwright. No ffmpeg required — the static
# preview is composited in-browser by a stitcher Playwright page.
#
set -euo pipefail

APP_DIR="$(pwd)"
APP_NAME="$(basename "$APP_DIR")"
PORT="${DEMO_PORT:-4181}"
SCENARIO_FILE="${DEMO_SCENARIO:-tests/demo/scenario.mjs}"
OUT_DIR="${DEMO_OUT:-docs}"

mkdir -p "$OUT_DIR" tests/demo

echo "==> [$APP_NAME] build"
npm run build >/dev/null

echo "==> [$APP_NAME] preview server on :$PORT"
npx vite preview --host 127.0.0.1 --port "$PORT" --strictPort >/tmp/demo-preview-$$.log 2>&1 &
PREVIEW_PID=$!
for i in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:$PORT/$APP_NAME/" >/dev/null 2>&1; then break; fi
  sleep 0.1
done

cleanup() {
  kill "$PREVIEW_PID" 2>/dev/null || true
  wait "$PREVIEW_PID" 2>/dev/null || true
  rm -f /tmp/demo-preview-$$.log
}
trap cleanup EXIT

echo "==> [$APP_NAME] recording side-by-side demo"
node --input-type=module -e "
import { chromium } from '@playwright/test';
import { mkdir, rm, readdir, rename, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const APP = '$APP_NAME';
const PORT = $PORT;
const SCENARIO = '$SCENARIO_FILE';
const OUT_DIR = '$OUT_DIR';
const TMP_VIDEO = '/tmp/mesh-demo-video-' + APP;
await rm(TMP_VIDEO, { recursive: true, force: true });
await mkdir(TMP_VIDEO, { recursive: true });

const url = 'http://127.0.0.1:' + PORT + '/' + APP + '/';
const browser = await chromium.launch();
const sharedRoom = 'demo-' + Math.random().toString(36).slice(2, 7);

const seedInit = ({ prefix, room }) => {
  try {
    localStorage.setItem(prefix + ':room', room);
    localStorage.setItem(prefix + ':signalingUrl', 'ws://localhost:1/never');
    localStorage.removeItem(prefix + ':iceServers');
  } catch {}
};

// To mesh-sync two peers without a signaling server, both must run in the
// SAME BrowserContext (y-webrtc falls back to BroadcastChannel). With
// recordVideo enabled per-context we'd need two contexts. We trade off:
// keep both peers in one context (so they mesh-sync), record videos for
// each tab separately by sharing the context's recordVideo dir.
const ctx = await browser.newContext({
  viewport: { width: 480, height: 820 },
  deviceScaleFactor: 2,
  baseURL: url,
  recordVideo: { dir: TMP_VIDEO, size: { width: 480, height: 820 } },
});
await ctx.addInitScript(seedInit, { prefix: APP, room: sharedRoom });

const a = await ctx.newPage();
const b = await ctx.newPage();
await Promise.all([a.goto(url, { waitUntil: 'networkidle' }), b.goto(url, { waitUntil: 'networkidle' })]);
await a.waitForTimeout(400);

let scenario;
const abs = path.resolve(SCENARIO);
if (existsSync(abs)) {
  scenario = (await import('file://' + abs)).default;
} else {
  scenario = async (a, b) => {
    const fill = async (page, name) => {
      const ph = page.getByPlaceholder('your name').first();
      if (await ph.count() > 0) await ph.fill(name).catch(() => {});
    };
    await fill(a, 'alice');
    await fill(b, 'bob');
    await a.waitForTimeout(3000);
  };
}

await scenario(a, b);
await a.waitForTimeout(500);

// Final side-by-side composite: snapshot each page, then render an HTML
// stage in a third page that lays them out hflex with a divider, and
// screenshot the stage.
const aBuf = await a.screenshot({ animations: 'allow' });
const bBuf = await b.screenshot({ animations: 'allow' });
const aB64 = aBuf.toString('base64');
const bB64 = bBuf.toString('base64');

// Use a fresh context (no recording) for the stitcher
const stageCtx = await browser.newContext({
  viewport: { width: 1040, height: 880 },
  deviceScaleFactor: 2,
});
const stage = await stageCtx.newPage();
const html = '<!doctype html><html><head><style>' +
  'html,body{margin:0;padding:0;background:#0e1117;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:system-ui}' +
  '.pair{position:relative;display:flex;gap:10px;padding:14px;background:#0e1117;border-radius:10px}' +
  '.pair img{width:480px;height:auto;border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,0.55);display:block}' +
  '.div{width:2px;background:#1f2937}' +
  '.badge{position:absolute;top:22px;color:#fff;font:600 11px system-ui;background:rgba(0,0,0,0.7);padding:3px 9px;border-radius:999px;backdrop-filter:blur(4px)}' +
  '.ba{left:28px}.bb{right:28px}' +
  '</style></head><body><div class=pair>' +
  '<img src=\"data:image/png;base64,' + aB64 + '\"/>' +
  '<div class=div></div>' +
  '<img src=\"data:image/png;base64,' + bB64 + '\"/>' +
  '<div class=\"badge ba\">peer A</div>' +
  '<div class=\"badge bb\">peer B</div>' +
  '</div></body></html>';
await stage.setContent(html);
await stage.waitForLoadState('domcontentloaded');
await stage.waitForTimeout(250);
await stage.locator('.pair').screenshot({ path: path.join(OUT_DIR, 'preview.png') });
await stageCtx.close();

await ctx.close();
await browser.close();

// Move two newest video files to docs/
const vids = await readdir(TMP_VIDEO);
const sorted = await Promise.all(vids.map(async (n) => ({ n, m: (await stat(path.join(TMP_VIDEO, n))).mtimeMs })));
sorted.sort((x, y) => x.m - y.m);
if (sorted.length >= 1) await rename(path.join(TMP_VIDEO, sorted[0].n), path.join(OUT_DIR, 'demo-a.webm'));
if (sorted.length >= 2) await rename(path.join(TMP_VIDEO, sorted[1].n), path.join(OUT_DIR, 'demo-b.webm'));
console.log('wrote', path.join(OUT_DIR, 'preview.png'));
if (sorted.length >= 2) console.log('wrote demo-a.webm + demo-b.webm');
"

echo "==> [$APP_NAME] done"
