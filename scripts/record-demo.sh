#!/usr/bin/env bash
#
# record-demo.sh — build, launch preview, open two peer browsers, run an
# app-supplied scenario, and emit a side-by-side preview PNG + a 15s GIF.
#
# Outputs (into $DEMO_OUT, default docs/):
#   preview.png      composited side-by-side final frame (peer A | peer B)
#   demo.gif         15s GIF (10fps, side-by-side composite, palette-quantised)
#
# Optional: tests/demo/scenario.mjs exporting `default async (a, b) => …`
# drives the interaction. Without one, a generic ~13s scenario runs.
#
# Requirements: node, @playwright/test (in mesh-common's node_modules), ffmpeg.
#
set -euo pipefail

APP_DIR="$(pwd)"
APP_NAME="$(basename "$APP_DIR")"
PORT="${DEMO_PORT:-4181}"
SCENARIO_FILE="${DEMO_SCENARIO:-tests/demo/scenario.mjs}"
OUT_DIR="${DEMO_OUT:-docs}"
GIF_SECONDS="${DEMO_SECONDS:-15}"
GIF_FPS="${DEMO_FPS:-8}"
GIF_WIDTH="${DEMO_WIDTH:-360}"

# Resolve mesh-common dir so we can find its node_modules (Playwright).
MESH_COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "[record-demo] ffmpeg not found — please install it (brew install ffmpeg)" >&2
  exit 1
fi

mkdir -p "$OUT_DIR" tests/demo

echo "==> [$APP_NAME] build"
npm run build >/dev/null

echo "==> [$APP_NAME] preview server on :$PORT"
npx vite preview --host 127.0.0.1 --port "$PORT" --strictPort >/tmp/demo-preview-$$.log 2>&1 &
PREVIEW_PID=$!
for _ in $(seq 1 80); do
  if curl -fsS "http://127.0.0.1:$PORT/$APP_NAME/" >/dev/null 2>&1; then break; fi
  sleep 0.1
done

cleanup() {
  kill "$PREVIEW_PID" 2>/dev/null || true
  wait "$PREVIEW_PID" 2>/dev/null || true
  rm -f /tmp/demo-preview-$$.log
}
trap cleanup EXIT

echo "==> [$APP_NAME] recording two-peer side-by-side ($GIF_SECONDS s budget)"
NODE_PATH="$MESH_COMMON_DIR/node_modules" node --input-type=module -e "
import { chromium } from '@playwright/test';
import { mkdir, rm, readdir, rename, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const APP = '$APP_NAME';
const PORT = $PORT;
const SCENARIO = '$SCENARIO_FILE';
const OUT_DIR = '$OUT_DIR';
const MAX_SECONDS = $GIF_SECONDS;
const TMP_VIDEO = '/tmp/mesh-demo-video-' + APP + '-' + process.pid;
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

// Two peers MUST share a BrowserContext so y-webrtc falls back to
// BroadcastChannel (no signaling server needed). One context = one video
// stream; we record the context-level video and rely on the side-by-side
// stitcher below for the final composite.
const ctx = await browser.newContext({
  viewport: { width: 480, height: 820 },
  deviceScaleFactor: 2,
  baseURL: url,
  recordVideo: { dir: TMP_VIDEO, size: { width: 480, height: 820 } },
});
await ctx.addInitScript(seedInit, { prefix: APP, room: sharedRoom });

const a = await ctx.newPage();
const b = await ctx.newPage();
// 'domcontentloaded' instead of 'networkidle' — the v0.5.1 MeshBeacon
// fires a long-lived fetch on init which prevents the network from ever
// reaching idle in some apps.
await Promise.all([
  a.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 }),
  b.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 }),
]);
await a.waitForTimeout(800);

let scenario;
const abs = path.resolve(SCENARIO);
if (existsSync(abs)) {
  scenario = (await import('file://' + abs)).default;
} else {
  // Generic ~13s fallback: type names, click any obvious primary button on
  // peer A, wait long enough for the GIF to capture meaningful motion.
  scenario = async (a, b) => {
    const tryFill = async (page, placeholderRe, value) => {
      const ph = page.getByPlaceholder(placeholderRe).first();
      if (await ph.count() > 0) await ph.fill(value).catch(() => {});
    };
    const clickPrimary = async (page) => {
      const btn = page.locator('button:visible').first();
      if (await btn.count() > 0) await btn.click({ trial: false }).catch(() => {});
    };
    await tryFill(a, /your name|name/i, 'alice');
    await tryFill(b, /your name|name/i, 'bob');
    await a.waitForTimeout(1500);
    await clickPrimary(a).catch(() => {});
    await b.waitForTimeout(1500);
    await clickPrimary(b).catch(() => {});
    // Let any post-action animations / peer mesh-sync render
    await a.waitForTimeout(8000);
  };
}

const startedAt = Date.now();
const deadline = startedAt + (MAX_SECONDS * 1000) + 1500;
const scenarioPromise = scenario(a, b).catch((err) => console.error('[scenario]', err && err.message ? err.message : err));
const deadlinePromise = new Promise((r) => setTimeout(r, MAX_SECONDS * 1000 + 500));
await Promise.race([scenarioPromise, deadlinePromise]);
const remaining = deadline - Date.now();
if (remaining > 0) await a.waitForTimeout(Math.min(remaining, 1500));

// Final side-by-side composite still
const aBuf = await a.screenshot({ animations: 'allow' });
const bBuf = await b.screenshot({ animations: 'allow' });
const aB64 = aBuf.toString('base64');
const bB64 = bBuf.toString('base64');

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

// The two newest videos (per page) get moved out for ffmpeg.
const vids = await readdir(TMP_VIDEO);
const sorted = await Promise.all(vids.map(async (n) => ({ n, m: (await stat(path.join(TMP_VIDEO, n))).mtimeMs })));
sorted.sort((x, y) => x.m - y.m);
const tmpA = sorted[0] && path.join(TMP_VIDEO, sorted[0].n);
const tmpB = sorted[1] && path.join(TMP_VIDEO, sorted[1].n);
if (tmpA) await rename(tmpA, path.join(TMP_VIDEO, 'a.webm'));
if (tmpB) await rename(tmpB, path.join(TMP_VIDEO, 'b.webm'));
console.log('TMP_VIDEO_DIR=' + TMP_VIDEO);
console.log('preview=' + path.join(OUT_DIR, 'preview.png'));
"

# Locate the ffmpeg input dir produced by the Node script above. The Node
# script printed `TMP_VIDEO_DIR=…`; parse it back out from this stdout.
TMP_VIDEO_DIR="/tmp/mesh-demo-video-${APP_NAME}-$$"
# The Node child used its own pid, not ours. Find the most-recent matching dir.
LATEST_DIR="$(ls -dt /tmp/mesh-demo-video-${APP_NAME}-* 2>/dev/null | head -1 || true)"
if [ -n "$LATEST_DIR" ] && [ -d "$LATEST_DIR" ]; then
  TMP_VIDEO_DIR="$LATEST_DIR"
fi

if [ ! -f "$TMP_VIDEO_DIR/a.webm" ] || [ ! -f "$TMP_VIDEO_DIR/b.webm" ]; then
  echo "[record-demo] missing peer videos in $TMP_VIDEO_DIR" >&2
  exit 1
fi

echo "==> [$APP_NAME] ffmpeg → demo.gif (${GIF_SECONDS}s, ${GIF_FPS}fps, side-by-side, ${GIF_WIDTH}px each)"
# Build a hstacked GIF from both peer videos with a thin divider, then
# palette-quantise for size. -t caps duration; -t before -i seeks input but
# here we use it as an output-time cap so we always get the first N seconds.
ffmpeg -y \
  -i "$TMP_VIDEO_DIR/a.webm" \
  -i "$TMP_VIDEO_DIR/b.webm" \
  -filter_complex "
    [0:v]fps=${GIF_FPS},scale=${GIF_WIDTH}:-1:flags=lanczos,setsar=1,pad=iw+2:ih:0:0:color=0x0e1117[a];
    [1:v]fps=${GIF_FPS},scale=${GIF_WIDTH}:-1:flags=lanczos,setsar=1[b];
    [a][b]hstack=inputs=2[stack];
    [stack]split[s0][s1];
    [s0]palettegen=stats_mode=diff[p];
    [s1][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle
  " \
  -t "$GIF_SECONDS" -loop 0 "$OUT_DIR/demo.gif" 2>/tmp/ffmpeg-$$.log || {
    echo "[record-demo] ffmpeg failed; tail of log:" >&2
    tail -20 /tmp/ffmpeg-$$.log >&2
    rm -f /tmp/ffmpeg-$$.log
    exit 1
  }
rm -f /tmp/ffmpeg-$$.log
rm -rf "$TMP_VIDEO_DIR"

GIF_SIZE="$(stat -f '%z' "$OUT_DIR/demo.gif" 2>/dev/null || stat -c '%s' "$OUT_DIR/demo.gif")"
echo "==> [$APP_NAME] done — $OUT_DIR/demo.gif ($((GIF_SIZE / 1024)) KB) + $OUT_DIR/preview.png"
