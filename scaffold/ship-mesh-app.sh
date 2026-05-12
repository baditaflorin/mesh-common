#!/usr/bin/env bash
#
# ship-mesh-app.sh — finalize a mesh-* app: fmt, smoke, commit, create repo,
# push, enable Pages. Run from the app's directory after editing Feature.tsx.
#
# Usage:
#   ship-mesh-app.sh "feat: short commit message" "<gh repo description>"
#
set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "usage: $0 <commit-message> <description>" >&2
  exit 1
fi

COMMIT_MSG="$1"
DESCRIPTION="$2"
APP_NAME="$(basename "$PWD")"

echo "==> [$APP_NAME] format"
npm run fmt --silent >/dev/null

echo "==> [$APP_NAME] smoke build"
npm run smoke >/dev/null

echo "==> [$APP_NAME] commit"
git add -A
git -c user.name="Florin Badita" -c user.email="baditaflorin@gmail.com" \
  commit -q -m "$COMMIT_MSG" || echo "    (nothing to commit)"

if ! gh repo view "baditaflorin/$APP_NAME" >/dev/null 2>&1; then
  echo "==> [$APP_NAME] create repo + push"
  gh repo create "baditaflorin/$APP_NAME" --public --source=. --remote=origin \
    --description "$DESCRIPTION" --push >/dev/null
else
  echo "==> [$APP_NAME] repo exists, pushing"
  git push -u origin main >/dev/null 2>&1 || git push origin main >/dev/null
fi

echo "==> [$APP_NAME] enable Pages"
gh api -X POST "repos/baditaflorin/$APP_NAME/pages" \
  -f 'source[branch]=main' -f 'source[path]=/docs' >/dev/null 2>&1 \
  || echo "    (already enabled or transient)"

echo "==> [$APP_NAME] live: https://baditaflorin.github.io/$APP_NAME/"
