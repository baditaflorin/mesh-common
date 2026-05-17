#!/usr/bin/env bash
#
# install-tests-into-app.sh — backport the mesh-common test scaffolding into
# an already-scaffolded mesh-* app.
#
# Usage:
#   install-tests-into-app.sh                    # current dir
#   install-tests-into-app.sh <path-to-app>      # specific dir
#
# Idempotent: re-running just refreshes the generic test files. Per-app
# test files (tests/e2e/feature.spec.ts, tests/unit/feature.test.tsx) are
# never overwritten if they already exist.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TEMPLATE_DIR="$(cd "$SCRIPT_DIR/../scaffold/template" && pwd)"
TARGET="${1:-$PWD}"
TARGET="$(cd "$TARGET" && pwd)"

if [[ ! -f "$TARGET/package.json" ]]; then
  echo "install-tests-into-app.sh: $TARGET has no package.json" >&2
  exit 1
fi

cd "$TARGET"
APP_NAME="$(node -p "require('./package.json').name")"

echo "==> installing test scaffolding into $APP_NAME"

# 1. Copy generic test infra files (always refresh).
cp "$TEMPLATE_DIR/vitest.config.ts" vitest.config.ts
cp "$TEMPLATE_DIR/playwright.config.ts" playwright.config.ts

mkdir -p tests/unit tests/e2e
cp "$TEMPLATE_DIR/tests/setup.ts" tests/setup.ts
cp "$TEMPLATE_DIR/tests/e2e/smoke.spec.ts" tests/e2e/smoke.spec.ts
cp "$TEMPLATE_DIR/tests/e2e/mesh.spec.ts" tests/e2e/mesh.spec.ts

# 2. Drop in the placeholder unit test only if (a) src/Feature.tsx exists (the
#    canonical mesh-common-scaffolded shape), and (b) no unit tests exist yet.
#    Legacy apps that predate mesh-common have src/App.tsx + src/features/<x>
#    instead — skip the placeholder there and keep e2e-only coverage.
if [[ ! -f "src/Feature.tsx" ]]; then
  rm -f tests/unit/Feature.test.tsx
  rmdir tests/unit 2>/dev/null || true
elif [[ ! -e tests/unit/Feature.test.tsx ]] && ls tests/unit/*.test.* >/dev/null 2>&1; then
  : # has other unit tests already, skip placeholder
elif [[ ! -e tests/unit/Feature.test.tsx ]]; then
  cp "$TEMPLATE_DIR/tests/unit/Feature.test.tsx" tests/unit/Feature.test.tsx
fi

# 3. Refresh the smoke script + tsconfig.app.json + .prettierignore + .gitignore.
cp "$TEMPLATE_DIR/scripts/smoke.sh" scripts/smoke.sh
cp "$TEMPLATE_DIR/tsconfig.app.json" tsconfig.app.json
cp "$TEMPLATE_DIR/.prettierignore" .prettierignore
cp "$TEMPLATE_DIR/.gitignore" .gitignore

# 3b. Patch vite.config.ts to add resolve.dedupe if missing (idempotent).
node - <<'NODE'
const fs = require('fs');
const p = 'vite.config.ts';
if (!fs.existsSync(p)) process.exit(0);
let s = fs.readFileSync(p, 'utf8');
if (!s.includes('dedupe:')) {
  s = s.replace(
    /(define:\s*\{[^}]*\},\s*)/,
    `$1
    resolve: {
      dedupe: ["react", "react-dom", "yjs", "y-webrtc"],
    },
    `,
  );
  fs.writeFileSync(p, s);
  console.log('  patched vite.config.ts with resolve.dedupe');
}
NODE

# 4. Merge package.json: add missing devDeps + scripts without clobbering.
node - "$TEMPLATE_DIR" <<'NODE'
const fs = require('fs');
const path = require('path');
const templateDir = process.argv[2];
const tmpl = JSON.parse(fs.readFileSync(path.join(templateDir, 'package.json.tmpl'), 'utf8'));
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

pkg.scripts = { ...pkg.scripts, ...tmpl.scripts };
pkg.devDependencies = { ...(pkg.devDependencies || {}), ...tmpl.devDependencies };

// mesh-common lives in the template's `dependencies` (the canonical layout
// also imports it at runtime). For legacy apps, it's only needed for the
// test helpers — but it must be in `dependencies` for npm to install it
// since the test files import it at e2e time.
pkg.dependencies = pkg.dependencies || {};
if (tmpl.dependencies && tmpl.dependencies["@baditaflorin/mesh-common"]) {
  pkg.dependencies["@baditaflorin/mesh-common"] = tmpl.dependencies["@baditaflorin/mesh-common"];
}

fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log('  merged scripts + devDependencies + mesh-common dep');
NODE

# 5. Mark scripts executable.
chmod +x scripts/*.sh .githooks/* 2>/dev/null || true

echo "==> done. Next:"
echo "    npm install"
echo "    npm run test:unit          # CPU-only, fast"
echo "    npx playwright install chromium   # one-time, ~120MB"
echo "    npm run test:e2e           # CPU-only, browser-driven"
