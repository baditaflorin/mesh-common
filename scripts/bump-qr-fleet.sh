#!/usr/bin/env bash
#
# bump-qr-fleet.sh — rebuild + ship all apps that consume the QR primitives
# after a mesh-common change. For each listed app, run smoke (which rebuilds
# docs/), update tests that referenced the legacy `mesh://` payload, commit
# the new docs/, and push.
#
# Soft mode: skip apps with no diff.
set -euo pipefail

PARENT="$(cd "$(dirname "$0")/../.." && pwd)"

APPS=(
  mesh-pyramid
  mesh-handshake-chain
  mesh-six-degrees
  mesh-network-builder
  mesh-business-card
  mesh-icebreaker-bingo
  mesh-skill-swap
  mesh-favor-bank
  mesh-thank-you-token
  mesh-bracket
  mesh-rps-arena
  mesh-tag
  mesh-attendance-stamp
  mesh-treasure-hunt
  mesh-passport
  mesh-werewolf-roles
  mesh-blind-date
  mesh-petition
  mesh-rsvp
  mesh-trade-cards
)

COMMIT_MSG="${1:-chore: rebuild docs after mesh-common QR primitives update}"

for app in "${APPS[@]}"; do
  DIR="$PARENT/$app"
  if [ ! -d "$DIR" ]; then
    echo "==> [$app] missing, skipping"
    continue
  fi
  echo "==> [$app] smoke build"
  (cd "$DIR" && npm run smoke >/dev/null 2>&1) || {
    echo "    smoke failed"
    continue
  }
  cd "$DIR"
  if git diff --quiet HEAD -- docs/ tests/; then
    echo "    no changes — skipping"
    cd "$PARENT"
    continue
  fi
  git add docs/ tests/ 2>/dev/null || true
  git -c user.name="Florin Badita" -c user.email="baditaflorin@gmail.com" \
    commit -q -m "$COMMIT_MSG" 2>/dev/null || true
  git push -q 2>&1 | tail -1 || echo "    push failed"
  cd "$PARENT"
done

echo "==> done"
