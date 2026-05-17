#!/usr/bin/env bash
#
# add-audit-link.sh — idempotently insert a "security audit" link into each
# app's README.md, right under the PayPal tip line.
#
set -euo pipefail
PARENT="$(cd "$(dirname "$0")/../.." && pwd)"

APPS=(
  mesh-pyramid mesh-handshake-chain mesh-six-degrees mesh-network-builder
  mesh-business-card mesh-icebreaker-bingo mesh-skill-swap mesh-favor-bank
  mesh-thank-you-token mesh-bracket mesh-rps-arena mesh-tag
  mesh-attendance-stamp mesh-treasure-hunt mesh-passport mesh-werewolf-roles
  mesh-blind-date mesh-petition mesh-rsvp mesh-trade-cards
)

for app in "${APPS[@]}"; do
  DIR="$PARENT/$app"
  README="$DIR/README.md"
  [ -f "$README" ] || { echo "==> [$app] no README; skipping"; continue; }
  if grep -q "security-audit.md" "$README"; then
    echo "==> [$app] already linked; skipping"
    continue
  fi
  cd "$DIR"
  echo "==> [$app] inserting audit link into README"
  APP="$app" python3 - <<'PY'
import re, pathlib, os
app = os.environ.get("APP", "")
p = pathlib.Path("README.md")
text = p.read_text()
needle = "**Tip the dev (buy a coffee) → https://www.paypal.com/paypalme/florinbadita**"
addition = f"\n\n**Security audit (programmatic, headless, CPU-only) → [docs/security-audit.md](./docs/security-audit.md)** — re-run with `npm run audit:security`"
if needle in text:
    text = text.replace(needle, needle + addition, 1)
else:
    text = text.rstrip() + "\n" + addition + "\n"
p.write_text(text)
PY
  npm run fmt --silent >/dev/null 2>&1 || true
  git add README.md
  if git diff --cached --quiet; then
    cd "$PARENT"
    continue
  fi
  git -c user.name="Florin Badita" -c user.email="baditaflorin@gmail.com" \
    commit -q -m "docs: link security audit in README"
  git push -q 2>&1 | tail -1 || echo "    push failed"
  cd "$PARENT"
done

echo "==> done"
