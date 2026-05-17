#!/usr/bin/env bash
#
# Local-CI smoke gate. Runs in CPU time only — no GPU, no network beyond
# `npm install`.
#
# Layers:
#   1. Vitest unit tests (pure logic + jsdom component tests)
#   2. Vite build → docs/
#   3. Sanity-check the build output
#
# E2E tests are NOT run here because they need `npx playwright install
# chromium` (one-time, ~120MB). Run `npm run test:e2e` separately.
#
set -euo pipefail

# Unit tests run only when the canonical src/Feature.tsx is present.
# Legacy apps that predate mesh-common have a different layout; their
# coverage is end-to-end via Playwright instead.
if [ -d tests/unit ] && ls tests/unit/*.test.* > /dev/null 2>&1; then
  npm run test:unit
fi

npm run build

test -s docs/index.html
grep -qi "<!doctype html" docs/index.html
test -s docs/404.html
test -d docs/assets

echo "[smoke] docs/ built and unit tests passed."
