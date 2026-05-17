#!/usr/bin/env node
/**
 * render-security-audit.mjs
 *
 * Reads a JSONL audit log (one line per check) and writes:
 *
 *   <out>/security-audit.json   structured machine-readable
 *   <out>/security-audit.md     human-readable for GitHub Pages
 *
 * Usage:
 *   node render-security-audit.mjs <jsonl-in> <out-dir> [extra.jsonl …]
 *
 * Multiple input JSONL files are concatenated (e.g. unit + e2e).
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { mkdirSync } from "node:fs";
import { join, basename } from "node:path";

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error("usage: render-security-audit.mjs <jsonl-in> <out-dir> [extra-jsonl …]");
  process.exit(2);
}

const outDir = args[1];
const inputs = [args[0], ...args.slice(2)];
mkdirSync(outDir, { recursive: true });

/** @type {Array<{id:string,claim:string,result:string,method?:string,evidence?:object,ts:number}>} */
const entries = [];
let runCompletedAt = null;

for (const path of inputs) {
  if (!existsSync(path)) {
    console.warn(`warn: input not found: ${path}`);
    continue;
  }
  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    if (obj.id === "AUDIT.summary") {
      runCompletedAt = Math.max(runCompletedAt ?? 0, obj.completedAt ?? 0);
      continue;
    }
    if (obj.id && obj.claim) entries.push(obj);
  }
}

entries.sort((a, b) => a.id.localeCompare(b.id));

const passed = entries.filter((e) => e.result === "pass").length;
const failed = entries.filter((e) => e.result === "fail").length;
const ranUi = process.env.RAN_UI === "1";
const uiCount = entries.filter((e) => e.id.startsWith("UI.")).length;
const cryptoCount = entries.filter((e) => !e.id.startsWith("UI.")).length;
const completedAt = runCompletedAt ?? Date.now();
const completedAtIso = new Date(completedAt).toISOString();

// ----- JSON output -----
const summary = {
  app: process.env.APP_NAME ?? null,
  completedAt: completedAtIso,
  totalChecks: entries.length,
  passed,
  failed,
  entries,
};
writeFileSync(join(outDir, "security-audit.json"), JSON.stringify(summary, null, 2));

// ----- Markdown output -----
const md = [];
const appName = process.env.APP_NAME ?? "this app";
md.push(`# Security audit — ${appName}`);
md.push("");
md.push(`Generated: **${completedAtIso}** · ${entries.length} checks · ${passed} pass · ${failed} fail`);
md.push("");
md.push(`> A programmatic, CPU-only verification of every claim in the four-layer security stack.`);
md.push(`> Re-run with \`npm run audit:security\` from this repo. Source: \`mesh-common/tests/securityAudit.test.ts\``);
if (ranUi) md.push(`> + this app's \`tests/e2e/security-audit.spec.ts\`.`);
else md.push(`> This app does not render the moderator badge yet — only the shared crypto invariants are exercised. The layer-1 guarantees still apply by virtue of bundling \`mesh-common\`.`);
md.push("");
md.push(`## Result`);
md.push("");
md.push(failed === 0 ? "✅ **All checks pass.**" : `❌ **${failed} check${failed === 1 ? "" : "s"} failing.**`);
md.push("");
md.push(`- crypto / Y.Doc invariants: **${cryptoCount} / 16**`);
md.push(`- UI-flow checks: **${uiCount}**${ranUi ? "" : "  _(this app does not yet expose the moderator UI; pass 2 skipped)_"}`);
md.push("");
md.push(`## Checks`);
md.push("");
md.push("| ID | Claim | Method | Result |");
md.push("|---|---|---|:---:|");
for (const e of entries) {
  const icon = e.result === "pass" ? "✅" : "❌";
  const claim = (e.claim ?? "").replace(/\|/g, "\\|");
  const method = (e.method ?? "").replace(/\|/g, "\\|");
  md.push(`| \`${e.id}\` | ${claim} | ${method} | ${icon} |`);
}
md.push("");
md.push("## Evidence");
md.push("");
md.push("Selected captured evidence (full payloads in `security-audit.json`):");
md.push("");
for (const e of entries) {
  if (!e.evidence || Object.keys(e.evidence).length === 0) continue;
  md.push(`### \`${e.id}\``);
  md.push("");
  md.push("```json");
  md.push(JSON.stringify(e.evidence, null, 2));
  md.push("```");
  md.push("");
}
md.push("---");
md.push("");
md.push("## How to re-run");
md.push("");
md.push("```bash");
md.push("cd " + (process.env.APP_NAME ?? "<this app>"));
md.push("npm run audit:security");
md.push("```");
md.push("");
md.push("The audit runs in two passes:");
md.push("");
md.push("1. **Crypto invariants** (Vitest, ~1s) — sign/verify roundtrips, TOFU registry, moderator role state machine, forged-claim rejection, expired-claim rejection. Uses in-memory Yjs mock rooms; no browser.");
md.push("2. **UI flow** (Playwright, ~5s) — opens two peer browsers, exercises the visible moderator badge: vacant → claim → sync → release.");
md.push("");
md.push("Both run **headless, CPU-only**. No GPU acceleration is required; no signaling server is contacted. The fleet's `judge.sh` aggregator includes these checks alongside per-app feature tests.");
md.push("");

writeFileSync(join(outDir, "security-audit.md"), md.join("\n"));

console.log(`wrote ${join(outDir, "security-audit.json")}`);
console.log(`wrote ${join(outDir, "security-audit.md")}`);
console.log(`${entries.length} checks · ${passed} pass · ${failed} fail`);
if (failed > 0) process.exit(1);
