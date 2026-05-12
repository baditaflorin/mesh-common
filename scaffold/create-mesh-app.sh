#!/usr/bin/env bash
#
# create-mesh-app.sh — scaffold a new mesh-* app from the mesh-common template.
#
# Usage:
#   create-mesh-app.sh <app-name> <description> <accent-hex>
#
# Example:
#   create-mesh-app.sh mesh-when2meet "Ephemeral availability picker" "#3aa8a1"
#
# The new app is created as a sibling of mesh-common. After scaffolding, edit
# src/Feature.tsx (the only app-specific file) and run `npm run smoke` then
# commit + push.
#
set -euo pipefail

if [ "$#" -lt 3 ]; then
  echo "usage: $0 <app-name> <description> <accent-hex>" >&2
  echo "  app-name    e.g. mesh-when2meet (kebab-case, prefix mesh-)" >&2
  echo "  description short sentence used in package.json + meta tags" >&2
  echo "  accent-hex  e.g. #3aa8a1 (used as --mesh-accent CSS variable)" >&2
  exit 1
fi

APP_NAME="$1"
DESCRIPTION="$2"
ACCENT="$3"
ACCENT_NOHASH="${ACCENT#\#}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TEMPLATE_DIR="$SCRIPT_DIR/template"
COMMON_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PARENT_DIR="$(cd "$COMMON_DIR/.." && pwd)"
TARGET="$PARENT_DIR/$APP_NAME"

if [ ! -d "$TEMPLATE_DIR" ]; then
  echo "template dir not found: $TEMPLATE_DIR" >&2
  exit 1
fi

if [ -e "$TARGET" ]; then
  echo "target already exists: $TARGET" >&2
  exit 1
fi

echo "==> scaffolding $APP_NAME at $TARGET"
mkdir -p "$TARGET"

# Copy template wholesale, then substitute placeholders.
cp -R "$TEMPLATE_DIR/." "$TARGET/"

# Substitution function: replace placeholders in a file in-place.
subst() {
  local f="$1"
  # Use a temp file to avoid sed -i portability issues across BSD/GNU.
  python3 - "$f" "$APP_NAME" "$DESCRIPTION" "$ACCENT" "$ACCENT_NOHASH" <<'PY'
import sys, pathlib
path, app, desc, accent, accent_nohash = sys.argv[1:6]
p = pathlib.Path(path)
text = p.read_text()
text = text.replace("__APP_NAME__", app)
text = text.replace("__DESCRIPTION__", desc)
text = text.replace("__ACCENT_NOHASH__", accent_nohash)
text = text.replace("__ACCENT__", accent)
p.write_text(text)
PY
}

# Move .tmpl files into place and substitute placeholders.
cd "$TARGET"

shopt -s globstar nullglob
for tmpl in **/*.tmpl; do
  dest="${tmpl%.tmpl}"
  mv "$tmpl" "$dest"
  subst "$dest"
done

# Also substitute placeholders in non-tmpl files that may reference them.
for f in README.md package.json index.html vite.config.ts src/config.ts; do
  [ -f "$f" ] && subst "$f"
done

# Move docs-source to docs (the published location).
if [ -d docs-source ]; then
  mkdir -p docs/adr
  mv docs-source/*.md docs/ 2>/dev/null || true
  mv docs-source/adr/*.md docs/adr/ 2>/dev/null || true
  rmdir docs-source/adr docs-source 2>/dev/null || true
fi

chmod +x .githooks/* scripts/*.sh

echo "==> npm install"
npm install --silent

echo "==> initial build"
npm run build >/dev/null

echo "==> format"
npm run fmt --silent >/dev/null

echo "==> git init + first commit"
git init -q
git config core.hooksPath .githooks
git checkout -q -b main 2>/dev/null || true
git add -A
git -c user.name="Florin Badita" -c user.email="baditaflorin@gmail.com" \
  commit -q -m "chore: initial scaffold via mesh-common

Bootstrapped from @baditaflorin/mesh-common template.
- Mode A (pure GitHub Pages) per ADR 0001
- Pages publishes from main /docs per ADR 0010
- Settings drawer + self-ref bar + version badge from mesh-common
- Husky-style hooks gating fmt + typecheck + smoke"

echo "==> ready: $TARGET"
echo "    next: edit src/Feature.tsx, then run from $TARGET:"
echo "      npm run smoke && git add -A && git commit -m 'feat: implement core mechanic'"
echo "      gh repo create baditaflorin/$APP_NAME --public --source=. --remote=origin --description \"$DESCRIPTION\""
echo "      git push -u origin main"
echo "      gh api -X POST 'repos/baditaflorin/$APP_NAME/pages' -f 'source[branch]=main' -f 'source[path]=/docs'"
