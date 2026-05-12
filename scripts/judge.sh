#!/usr/bin/env bash
#
# judge.sh — aggregate Playwright JSON test results from every sibling
# mesh-* app into one summary file that an LLM (or a human) can read.
#
# Run this AFTER running `across.sh npm run test:e2e` (Playwright writes
# test-results.json per app per the scaffolded playwright.config.ts).
#
# Output: /tmp/mesh-judge/summary.json with shape:
#   {
#     "generatedAt": "2026-05-13T...",
#     "apps": [
#       {
#         "name": "mesh-when2meet",
#         "stats": { "passed": 3, "failed": 0, "skipped": 0 },
#         "failures": [
#           { "title": "...", "error": "..." }
#         ]
#       },
#       ...
#     ],
#     "totals": { "passed": 30, "failed": 0, "skipped": 0 }
#   }
#
# Also prints a one-line-per-app markdown table to stdout.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PARENT="$(cd "$SCRIPT_DIR/../.." && pwd)"
OUTDIR=/tmp/mesh-judge
mkdir -p "$OUTDIR"
OUT="$OUTDIR/summary.json"

node - "$PARENT" "$OUT" <<'NODE'
const fs = require('fs');
const path = require('path');
const [parent, out] = process.argv.slice(2);

const apps = fs.readdirSync(parent)
  .filter((d) => d.startsWith('mesh-') && d !== 'mesh-common')
  .filter((d) => fs.existsSync(path.join(parent, d, 'package.json')))
  .sort();

const summary = { generatedAt: new Date().toISOString(), apps: [], totals: { passed: 0, failed: 0, skipped: 0 } };

function walk(node, acc) {
  if (!node) return;
  if (Array.isArray(node.suites)) node.suites.forEach((s) => walk(s, acc));
  if (Array.isArray(node.specs)) {
    node.specs.forEach((spec) => {
      const tests = spec.tests || [];
      tests.forEach((t) => {
        const result = (t.results || [])[t.results.length - 1] || {};
        const status = result.status === 'passed' ? 'passed' :
                       result.status === 'skipped' ? 'skipped' : 'failed';
        acc.stats[status]++;
        if (status === 'failed') {
          acc.failures.push({
            title: spec.title,
            file: spec.file,
            error: (result.error && (result.error.message || result.error.value)) || 'unknown',
          });
        }
      });
    });
  }
}

const lines = ['| app | passed | failed | skipped |', '|---|---:|---:|---:|'];
for (const app of apps) {
  const file = path.join(parent, app, 'test-results.json');
  if (!fs.existsSync(file)) {
    summary.apps.push({ name: app, stats: { passed: 0, failed: 0, skipped: 0 }, failures: [], note: 'no test-results.json' });
    lines.push(`| ${app} | - | - | - |`);
    continue;
  }
  let raw;
  try { raw = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) {
    summary.apps.push({ name: app, error: String(e) });
    lines.push(`| ${app} | ERR | ERR | ERR |`);
    continue;
  }
  const acc = { stats: { passed: 0, failed: 0, skipped: 0 }, failures: [] };
  walk(raw, acc);
  summary.apps.push({ name: app, stats: acc.stats, failures: acc.failures });
  summary.totals.passed += acc.stats.passed;
  summary.totals.failed += acc.stats.failed;
  summary.totals.skipped += acc.stats.skipped;
  lines.push(`| ${app} | ${acc.stats.passed} | ${acc.stats.failed} | ${acc.stats.skipped} |`);
}
lines.push(`| **totals** | **${summary.totals.passed}** | **${summary.totals.failed}** | **${summary.totals.skipped}** |`);

fs.writeFileSync(out, JSON.stringify(summary, null, 2));
console.log(lines.join('\n'));
console.log(`\nfull summary written to ${out}`);
if (summary.totals.failed > 0) {
  console.log('\nFailures:');
  summary.apps.forEach((a) => {
    (a.failures || []).forEach((f) => {
      console.log(`  ${a.name} › ${f.title}\n    ${f.error.split('\n')[0]}`);
    });
  });
  process.exit(1);
}
NODE
