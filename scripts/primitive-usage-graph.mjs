#!/usr/bin/env node
/**
 * primitive-usage-graph — scan every sibling mesh-* app for imports from
 * @baditaflorin/mesh-common and emit a dependency map.
 *
 *   node mesh-common/scripts/primitive-usage-graph.mjs              # markdown table
 *   node mesh-common/scripts/primitive-usage-graph.mjs --json       # machine-readable JSON
 *   node mesh-common/scripts/primitive-usage-graph.mjs --primitive useShake
 *       # only apps that import this primitive
 *   node mesh-common/scripts/primitive-usage-graph.mjs --app mesh-tag
 *       # only primitives this app uses
 *   node mesh-common/scripts/primitive-usage-graph.mjs --orphans
 *       # primitives exported by mesh-common but used by ZERO apps
 *
 * The graph informs:
 *   - which primitives are most-loved (candidates for stability hardening)
 *   - which are orphaned (candidates for promotion / examples / deletion)
 *   - which apps still hand-roll a pattern we have a primitive for (compare
 *     vs `--primitive <name>` after a refactor pass)
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..", "..");
const MESH_COMMON_INDEX = join(__dirname, "..", "src", "index.ts");

// ---- 1. Parse every named export from mesh-common's index.ts ----
const exports = new Set();
{
  const src = readFileSync(MESH_COMMON_INDEX, "utf8");
  // Match `export { Foo, Bar as Baz, type Quux } from "..."` or `export { ... }`
  const re = /export\s*\{([^}]+)\}/g;
  let m;
  while ((m = re.exec(src))) {
    const inner = m[1];
    for (let part of inner.split(",")) {
      part = part.trim();
      if (!part) continue;
      // Drop `type ` prefix
      part = part.replace(/^type\s+/, "");
      // Handle `Foo as Bar` → take Bar
      const m2 = part.match(/^\w+\s+as\s+(\w+)$/);
      const name = m2 ? m2[1] : part.split(/\s+/)[0];
      if (name) exports.add(name);
    }
  }
}

// ---- 2. Scan every sibling mesh-* app's src/ for imports from mesh-common ----
const apps = [];
for (const name of readdirSync(root)) {
  if (!name.startsWith("mesh-") || name === "mesh-common") continue;
  const dir = join(root, name);
  try {
    if (!statSync(dir).isDirectory()) continue;
    if (!statSync(join(dir, "package.json"))) continue;
  } catch {
    continue;
  }
  apps.push(name);
}
apps.sort();

const appToPrims = new Map(); // app → Set<primitiveName>
const primToApps = new Map(); // primitive → Set<app>

function recordImports(app, source) {
  // Match: import { A, B, type C } from "@baditaflorin/mesh-common"
  const re = /import\s*(?:type\s+)?\{([^}]+)\}\s*from\s*["']@baditaflorin\/mesh-common["']/g;
  let m;
  while ((m = re.exec(source))) {
    const inner = m[1];
    for (let part of inner.split(",")) {
      part = part.trim();
      if (!part) continue;
      part = part.replace(/^type\s+/, "");
      const m2 = part.match(/^(\w+)(?:\s+as\s+\w+)?$/);
      const name = m2?.[1];
      if (!name || !exports.has(name)) continue;
      if (!appToPrims.has(app)) appToPrims.set(app, new Set());
      appToPrims.get(app).add(name);
      if (!primToApps.has(name)) primToApps.set(name, new Set());
      primToApps.get(name).add(app);
    }
  }
}

function walk(dir, fn) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name === "node_modules" || e.name === "docs" || e.name === ".git") continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, fn);
    else if (/\.(tsx?|jsx?|mjs|cjs)$/.test(e.name)) fn(p);
  }
}

for (const app of apps) {
  walk(join(root, app, "src"), (file) => {
    try {
      const src = readFileSync(file, "utf8");
      recordImports(app, src);
    } catch {
      /* ignore */
    }
  });
}

// ---- 3. Output ----
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const valueOf = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};

if (flag("--json")) {
  const out = {
    generatedAt: new Date().toISOString(),
    apps: apps.length,
    exportsScanned: exports.size,
    appToPrims: Object.fromEntries(
      [...appToPrims.entries()].map(([k, v]) => [k, [...v].sort()]),
    ),
    primToApps: Object.fromEntries(
      [...primToApps.entries()].map(([k, v]) => [k, [...v].sort()]),
    ),
    orphans: [...exports].filter((e) => !primToApps.has(e)).sort(),
  };
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
}

if (flag("--orphans")) {
  console.log("Primitives exported by mesh-common but used by zero apps:");
  const orphans = [...exports].filter((e) => !primToApps.has(e)).sort();
  if (orphans.length === 0) {
    console.log("  (none — every export has at least one adopter)");
  } else {
    for (const o of orphans) console.log(`  - ${o}`);
  }
  process.exit(0);
}

const onlyPrim = valueOf("--primitive");
if (onlyPrim) {
  const set = primToApps.get(onlyPrim);
  console.log(`${onlyPrim} — used by ${set?.size ?? 0} app(s):`);
  if (set) for (const a of [...set].sort()) console.log(`  - ${a}`);
  process.exit(0);
}

const onlyApp = valueOf("--app");
if (onlyApp) {
  const set = appToPrims.get(onlyApp);
  console.log(`${onlyApp} — uses ${set?.size ?? 0} primitive(s):`);
  if (set) for (const p of [...set].sort()) console.log(`  - ${p}`);
  process.exit(0);
}

// Default: markdown table of primitive → app count, plus orphan list
const rows = [...primToApps.entries()]
  .map(([prim, set]) => ({ prim, n: set.size, apps: [...set].sort() }))
  .sort((a, b) => b.n - a.n || a.prim.localeCompare(b.prim));

console.log(`# mesh-common primitive usage graph`);
console.log(`Generated ${new Date().toISOString()}`);
console.log(`${apps.length} apps scanned · ${exports.size} primitives exported · ${rows.length} adopted\n`);

console.log(`| primitive | apps | adopters |`);
console.log(`|---|---:|---|`);
for (const r of rows) {
  const list = r.apps.length <= 6 ? r.apps.join(", ") : `${r.apps.slice(0, 5).join(", ")}, … (+${r.apps.length - 5})`;
  console.log(`| \`${r.prim}\` | ${r.n} | ${list} |`);
}

const orphans = [...exports].filter((e) => !primToApps.has(e)).sort();
if (orphans.length > 0) {
  console.log(`\n## Orphans (${orphans.length}) — exported but not yet adopted\n`);
  for (const o of orphans) console.log(`- \`${o}\``);
}

console.log(`\n## Apps by primitive count\n`);
const appRows = [...appToPrims.entries()]
  .map(([app, set]) => ({ app, n: set.size }))
  .sort((a, b) => b.n - a.n || a.app.localeCompare(b.app));
console.log(`| app | primitives used |`);
console.log(`|---|---:|`);
for (const r of appRows) console.log(`| ${r.app} | ${r.n} |`);
