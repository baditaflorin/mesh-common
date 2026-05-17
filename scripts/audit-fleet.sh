#!/usr/bin/env bash
#
# audit-fleet.sh — run `npm run audit:security` across the listed apps,
# commit each docs/security-audit.{json,md}, and push.
#
# Each app's report is published at:
#   https://baditaflorin.github.io/<app>/security-audit.md
#
# Usage:
#   bash mesh-common/scripts/audit-fleet.sh                 # default list
#   bash mesh-common/scripts/audit-fleet.sh mesh-foo mesh-bar
#
set -euo pipefail

PARENT="$(cd "$(dirname "$0")/../.." && pwd)"

DEFAULT_APPS=(
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

if [ "$#" -gt 0 ]; then
  APPS=("$@")
else
  APPS=("${DEFAULT_APPS[@]}")
fi

COMMIT_MSG="${AUDIT_COMMIT_MSG:-chore: publish security audit (programmatic, headless, CPU-only)}"

PASS=0
FAIL=0
SKIPPED=0
RESULTS=()

for app in "${APPS[@]}"; do
  DIR="$PARENT/$app"
  if [ ! -d "$DIR" ]; then
    echo "==> [$app] missing, skipping"
    RESULTS+=("$app: missing")
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  # Add audit:security script if absent (idempotent)
  cd "$DIR"
  if ! grep -q '"audit:security"' package.json; then
    echo "==> [$app] wiring audit:security script"
    python3 - <<'PY'
import json, pathlib
p = pathlib.Path("package.json")
d = json.loads(p.read_text())
d.setdefault("scripts", {})["audit:security"] = "bash ../mesh-common/scripts/audit-app-security.sh"
p.write_text(json.dumps(d, indent=2) + "\n")
PY
  fi

  echo "==> [$app] auditing"
  if APP_NAME="$app" bash ../mesh-common/scripts/audit-app-security.sh >/tmp/audit-$app.log 2>&1; then
    SUMMARY=$(grep -E "^[0-9]+ checks" /tmp/audit-$app.log | tail -1 || echo "audit ok")
    echo "    $SUMMARY"
    RESULTS+=("$app: $SUMMARY")
    PASS=$((PASS + 1))
  else
    echo "    AUDIT FAILED — see /tmp/audit-$app.log"
    tail -10 /tmp/audit-$app.log | sed 's/^/      /'
    RESULTS+=("$app: FAILED")
    FAIL=$((FAIL + 1))
    cd "$PARENT"
    continue
  fi

  # Auto-format so the pre-commit prettier hook is happy
  npm run fmt --silent >/dev/null 2>&1 || true

  # Commit + push
  git add docs/security-audit.json docs/security-audit.md package.json 2>/dev/null || true
  if git diff --cached --quiet; then
    echo "    no diff — already up to date"
  else
    if git -c user.name="Florin Badita" -c user.email="baditaflorin@gmail.com" \
      commit -q -m "$COMMIT_MSG" 2>/tmp/audit-commit-$app.log; then
      git push -q 2>&1 | tail -1 || echo "    push failed (after commit)"
    else
      echo "    commit failed:"
      tail -3 /tmp/audit-commit-$app.log | sed 's/^/      /'
    fi
  fi
  cd "$PARENT"
done

echo
echo "==> fleet audit summary"
printf '%s\n' "${RESULTS[@]}"
echo
echo "$PASS audited · $FAIL failed · $SKIPPED skipped"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
