#!/usr/bin/env node
/**
 * build-demo-dashboard.mjs — render docs/demos/index.html for the recorded
 * fleet. Reads `docs/demos/<app>/{demo.gif,preview.png,status,record.log}`
 * and emits a single grid page. Optionally enriches with TRL + display name
 * from services-registry/services.json if present.
 *
 * Usage (from mesh-common/):
 *   node scripts/build-demo-dashboard.mjs
 */

import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const DEMOS_DIR = path.join(ROOT, "docs", "demos");
const REGISTRY_PATH = path.resolve(ROOT, "..", "services-registry", "services.json");
const OUT_PATH = path.join(DEMOS_DIR, "index.html");

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));

const registryById = new Map();
if (existsSync(REGISTRY_PATH)) {
  try {
    const data = JSON.parse(await readFile(REGISTRY_PATH, "utf8"));
    for (const svc of data) if (svc?.id) registryById.set(svc.id, svc);
  } catch (e) {
    console.warn("registry parse failed:", e.message);
  }
}

const entries = (await readdir(DEMOS_DIR, { withFileTypes: true }))
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

const cards = [];
let okCount = 0;
let failCount = 0;

for (const app of entries) {
  const appDir = path.join(DEMOS_DIR, app);
  const statusPath = path.join(appDir, "status");
  const gifPath = path.join(appDir, "demo.gif");
  const pngPath = path.join(appDir, "preview.png");
  const logPath = path.join(appDir, "record.log");
  const status = existsSync(statusPath) ? (await readFile(statusPath, "utf8")).trim() : "MISSING";
  const hasGif = existsSync(gifPath) && (await stat(gifPath)).size > 0;
  const hasPng = existsSync(pngPath) && (await stat(pngPath)).size > 0;
  const reg = registryById.get(app);
  const name = reg?.name || app;
  const trl = reg?.trl ?? "";
  const pagesUrl = reg?.url || `https://baditaflorin.github.io/${app}/`;
  const ok = status === "OK" && hasGif;
  if (ok) okCount++;
  else failCount++;

  // Extract a short error hint if the record failed
  let errHint = "";
  if (!ok && existsSync(logPath)) {
    try {
      const log = await readFile(logPath, "utf8");
      const tail = log.trim().split("\n").slice(-5).join("\n");
      errHint = tail.slice(-280);
    } catch {}
  }

  cards.push(`
    <article class="card ${ok ? "ok" : "fail"}">
      <header>
        <a class="title" href="${escapeHtml(pagesUrl)}" target="_blank" rel="noreferrer">${escapeHtml(name)}</a>
        ${trl !== "" ? `<span class="trl trl-${trl}">TRL ${escapeHtml(trl)}</span>` : ""}
        <span class="status status-${ok ? "ok" : "fail"}">${escapeHtml(status)}</span>
      </header>
      <div class="media">
        ${hasGif
          ? `<img class="gif" src="${escapeHtml(app)}/demo.gif" alt="${escapeHtml(name)} demo" loading="lazy" />`
          : hasPng
          ? `<img class="gif" src="${escapeHtml(app)}/preview.png" alt="${escapeHtml(name)} preview" loading="lazy" />`
          : `<div class="empty">no recording</div>`}
      </div>
      <footer>
        <code class="slug">${escapeHtml(app)}</code>
        ${errHint ? `<details class="errhint"><summary>log tail</summary><pre>${escapeHtml(errHint)}</pre></details>` : ""}
      </footer>
    </article>
  `);
}

const generatedAt = new Date().toISOString();
const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Mesh fleet demos — ${entries.length} apps</title>
  <style>
    :root { color-scheme: dark; }
    html, body { margin: 0; padding: 0; background: #0e1117; color: #e6edf3; font: 14px/1.5 system-ui, -apple-system, Segoe UI, sans-serif; }
    header.page { padding: 28px 24px 12px; max-width: 1400px; margin: 0 auto; }
    header.page h1 { margin: 0 0 6px; font-size: 22px; font-weight: 600; }
    header.page .sub { color: #8b949e; font-size: 13px; }
    main { max-width: 1400px; margin: 0 auto; padding: 16px 24px 48px; display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 20px; }
    .card { background: #161b22; border: 1px solid #30363d; border-radius: 10px; overflow: hidden; display: flex; flex-direction: column; }
    .card.fail { border-color: #5a2222; }
    .card header { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid #21262d; }
    .card .title { color: #58a6ff; text-decoration: none; font-weight: 600; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .card .title:hover { text-decoration: underline; }
    .trl { padding: 2px 7px; border-radius: 999px; font-size: 11px; background: #2d333b; color: #e6edf3; }
    .trl-1, .trl-2 { background: #4a1f1f; color: #ffb4b4; }
    .trl-3, .trl-4 { background: #4a3f1f; color: #ffd9a4; }
    .trl-5, .trl-6 { background: #1f3f4a; color: #a4d8ff; }
    .trl-7, .trl-8, .trl-9 { background: #1f4a2f; color: #a4ffb4; }
    .status { padding: 2px 7px; border-radius: 999px; font-size: 11px; font-weight: 600; }
    .status-ok { background: #133929; color: #56d364; }
    .status-fail { background: #3d1f1f; color: #ff7b72; }
    .media { background: #0e1117; aspect-ratio: 1.17 / 1; display: flex; align-items: center; justify-content: center; overflow: hidden; }
    .media .gif { width: 100%; height: auto; display: block; }
    .media .empty { color: #6e7681; font-style: italic; padding: 24px; }
    .card footer { padding: 8px 12px; border-top: 1px solid #21262d; display: flex; align-items: center; gap: 8px; }
    .slug { font-family: ui-monospace, SF Mono, Menlo, monospace; color: #8b949e; font-size: 12px; flex: 1; }
    .errhint summary { cursor: pointer; color: #ff7b72; font-size: 12px; }
    .errhint pre { background: #0e1117; padding: 8px; border-radius: 4px; font-size: 11px; max-height: 120px; overflow: auto; white-space: pre-wrap; margin: 6px 0 0; }
    footer.page { max-width: 1400px; margin: 0 auto; padding: 12px 24px 32px; color: #6e7681; font-size: 12px; }
  </style>
</head>
<body>
  <header class="page">
    <h1>Mesh fleet demos</h1>
    <div class="sub">
      ${entries.length} apps recorded · ${okCount} OK · ${failCount} failed · generated ${escapeHtml(generatedAt)}
    </div>
  </header>
  <main>
    ${cards.join("\n")}
  </main>
  <footer class="page">
    Each card shows a ~15s side-by-side recording of two BroadcastChannel-meshed peers. Source: mesh-common/scripts/record-demo.sh.
  </footer>
</body>
</html>
`;

await writeFile(OUT_PATH, html);
console.log(`wrote ${OUT_PATH}`);
console.log(`  total apps: ${entries.length}`);
console.log(`  OK:         ${okCount}`);
console.log(`  failed:     ${failCount}`);
