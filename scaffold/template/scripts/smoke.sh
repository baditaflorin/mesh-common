#!/usr/bin/env bash
set -euo pipefail

npm run build

test -s docs/index.html
grep -qi "<!doctype html" docs/index.html
test -s docs/404.html
test -d docs/assets

echo "[smoke] docs/ built successfully with index.html, 404.html, and assets/"
