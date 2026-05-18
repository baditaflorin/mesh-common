#!/usr/bin/env node
/**
 * generate-privacy-section.mjs
 *
 * Scans every `src/**\/*.{ts,tsx}` in the current mesh-* app for imports from
 * `@baditaflorin/mesh-common`, maps each capability-bearing hook to a
 * human-readable privacy implication, and rewrites the
 * `<!-- mesh:capabilities-block:start -->` … `:end -->` region inside
 * `docs-source/privacy.md` (and `docs/privacy.md` if present).
 *
 * Rationale: the privacy section must never be *more permissive* than what
 * the code actually does. Today every app's privacy section is hand-typed
 * and drifts the moment a hook is added. This script flips that — the code
 * is the source of truth, the docs follow.
 *
 * Usage:
 *   cd mesh-foo
 *   node ../mesh-common/scripts/generate-privacy-section.mjs           # rewrite
 *   node ../mesh-common/scripts/generate-privacy-section.mjs --check   # CI mode
 *
 * Exit codes:
 *   0  in --check mode if the file is already up-to-date, OR after a rewrite.
 *   1  in --check mode if the file would change.
 *   2  no privacy.md file found.
 */
import { readdir, readFile, writeFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const CHECK = process.argv.includes("--check");
const APP_DIR = process.cwd();
const SRC_DIR = path.join(APP_DIR, "src");

const MARK_START = "<!-- mesh:capabilities-block:start -->";
const MARK_END = "<!-- mesh:capabilities-block:end -->";

/** Hook name → privacy-relevant capability description. */
const CAPABILITY_MAP = {
  useCamera: "📷 **Camera access** — only when you explicitly arm it; frames stay on-device unless a feature publishes derived values.",
  useFlashlight: "🔦 **Camera torch toggle** — needs camera permission; not transmitted.",
  useMicLevel: "🎤 **Microphone level meter** — derived loudness only, no raw audio leaves the device.",
  useSharedLocation: "📍 **Geolocation** — when you opt in, an approximate latitude/longitude is broadcast to peers in the room. Defaults to coarse precision.",
  useCompass: "🧭 **Device orientation (compass)** — direction heading; published to the room only when you opt in.",
  useDeviceMotion: "📱 **Accelerometer / device motion** — used for shake / tilt; only the derived events are published.",
  useDeviceOrientation: "📱 **Device orientation (gyro)** — only when you opt in; published as direction state.",
  useTilt: "📱 **Device tilt** — derived from orientation; published as tilt angle.",
  useShake: "📱 **Shake detection** — derived motion events.",
  useStepCount: "👣 **Step count (motion)** — derived steps, no raw motion published.",
  useVibration: "📳 **Vibration** — output only (no data leaves the device).",
  useWakeLock: "💡 **Screen wake lock** — output only.",
  useWebShare: "🔗 **Web Share Sheet** — output only; content is whatever you choose to share.",
  useIdentity: "🔑 **Ed25519 keypair** stored in localStorage; the **public** key is published to peers, the private key never leaves your device.",
  useEphemeralKey: "🔒 **X25519 ephemeral key** for E2E messages; lost on reload, public part visible to peers.",
  useRoomSeal: "🔐 **Room-wide AES-GCM seal** — encrypts published Yjs values; the passphrase must be shared out-of-band (not via the room URL).",
  useDirectMessage: "📨 **DM channel** — `from`, `to`, and timing are visible to all peers; payloads can be sealed via `useEphemeralKey`.",
  useAwareness: "👀 **Awareness (ephemeral presence)** — cursors / typing / live state; visible to all peers while you're connected, never persisted.",
  useRoster: "👥 **Heartbeat roster** — your peerId + last-seen timestamp are published to the room every few seconds.",
  useNamedPeer: "🪪 **Display name** — the name you type is published to the room.",
  useMeshBeacon: "📊 **Pageview beacon** — one fire-and-forget request to the analytics endpoint per pageview (opt-out toggle exposed in settings).",
  PersonalQR: "📷 **QR code display** — encodes your room URL + peer ID; anyone who can see the screen can join.",
  useQRScanner: "📷 **QR scanner** — requires camera permission; QR payloads are parsed locally.",
  useInviteChain: "🔗 **Invite chain** — recruitment edges (who invited whom) are written to the CRDT, visible to all peers.",
};

async function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const full = path.join(dir, name);
    const s = await stat(full);
    if (s.isDirectory()) {
      out.push(...(await walk(full)));
    } else if (/\.(ts|tsx)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

function extractMeshCommonImports(source) {
  const idents = new Set();
  const re = /import\s*\{([^}]+)\}\s*from\s*["']@baditaflorin\/mesh-common["']/g;
  let m;
  while ((m = re.exec(source))) {
    const block = m[1];
    for (const raw of block.split(",")) {
      const ident = raw.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0].trim();
      if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(ident)) idents.add(ident);
    }
  }
  return idents;
}

function renderBlock(usedIdents) {
  const relevant = [...usedIdents]
    .filter((id) => CAPABILITY_MAP[id])
    .sort();

  if (relevant.length === 0) {
    return `${MARK_START}\n*(no capability-bearing primitives detected — this app only uses pure CRDT primitives)*\n${MARK_END}`;
  }

  const lines = relevant.map((id) => `- ${CAPABILITY_MAP[id]}`);
  return `${MARK_START}\n${lines.join("\n")}\n${MARK_END}`;
}

function rewriteCapabilitiesBlock(text, newBlock) {
  const startIdx = text.indexOf(MARK_START);
  const endIdx = text.indexOf(MARK_END);
  if (startIdx < 0 || endIdx < 0 || endIdx < startIdx) {
    // No markers — append a fresh "Capabilities used" section at the end.
    return text.trimEnd() + `\n\n## Capabilities used by this app\n\n${newBlock}\n`;
  }
  const head = text.slice(0, startIdx);
  const tail = text.slice(endIdx + MARK_END.length);
  return head + newBlock + tail;
}

async function processOne(filePath, usedIdents) {
  const cur = await readFile(filePath, "utf8");
  const block = renderBlock(usedIdents);
  const next = rewriteCapabilitiesBlock(cur, block);
  if (next === cur) {
    return { path: filePath, changed: false };
  }
  if (!CHECK) {
    await writeFile(filePath, next, "utf8");
  }
  return { path: filePath, changed: true };
}

async function main() {
  if (!existsSync(SRC_DIR)) {
    console.error(`[generate-privacy] no src/ in ${APP_DIR}`);
    process.exit(2);
  }
  const files = await walk(SRC_DIR);
  const idents = new Set();
  for (const f of files) {
    const text = await readFile(f, "utf8");
    for (const id of extractMeshCommonImports(text)) idents.add(id);
  }

  const targets = [
    path.join(APP_DIR, "docs-source", "privacy.md"),
    path.join(APP_DIR, "docs", "privacy.md"),
  ].filter(existsSync);

  if (targets.length === 0) {
    console.error("[generate-privacy] no privacy.md found at docs-source/ or docs/");
    process.exit(2);
  }

  let changedAny = false;
  for (const t of targets) {
    const r = await processOne(t, idents);
    if (r.changed) {
      changedAny = true;
      console.log(`${CHECK ? "would change" : "rewrote"} ${path.relative(APP_DIR, t)}`);
    } else {
      console.log(`up-to-date ${path.relative(APP_DIR, t)}`);
    }
  }

  if (CHECK && changedAny) {
    console.error("[generate-privacy] FAIL: privacy section is out of date with imports. Run without --check to fix.");
    process.exit(1);
  }
  process.exit(0);
}

await main();
