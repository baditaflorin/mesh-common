#!/usr/bin/env bash
#
# rollout-beacon.sh — for every sibling mesh-* app:
#   - if it uses <MeshShell>: just rebuild docs/ (the beacon comes free
#     via mesh-common 0.5.1's MeshShell.useMeshBeacon call)
#   - if it's a non-MeshShell holdout: also mount <MeshBeacon/> next to
#     the InviteShareButton already retrofitted earlier
# Then commit + push.
#
# Idempotent: skips apps whose committed bundle already contains
# `mesh-beacon-marker` (a stable string injected by useMeshBeacon).
#
set -uo pipefail

PARENT="$(cd "$(dirname "$0")/../.." && pwd)"
COMMIT_MSG="${1:-feat(chrome): inherit pageview beacon from mesh-common 0.5.1}"

# A stable marker that survives minification — we grep the built JS for
# this to know whether the beacon is already deployed. useMeshBeacon's
# URL constant contains "/pix.gif" so we use that as the marker.
MARKER='/pix.gif'

ok=0; skip=0; fail=0
fail_names=()

cd "$PARENT"
for app in mesh-*; do
  [ "$app" = "mesh-common" ] && continue
  appfile="$app/src/App.tsx"
  mainfile="$app/src/main.tsx"
  [ -f "$appfile" ] || continue

  # Skip if the deployed JS already includes the marker.
  if ls "$app"/docs/assets/*.js >/dev/null 2>&1 && \
     grep -q "$MARKER" "$app"/docs/assets/*.js 2>/dev/null; then
    skip=$((skip+1)); continue
  fi

  # For holdouts: ensure <MeshBeacon/> is mounted in App.tsx.
  if ! grep -q 'MeshShell' "$appfile"; then
    if ! grep -q 'MeshBeacon' "$appfile"; then
      if ! grep -q 'InviteShareButton' "$appfile"; then
        # Holdout missed the earlier retrofit; skip — needs manual review.
        fail=$((fail+1)); fail_names+=("$app:no-invite-share-button"); continue
      fi
      # Detect config alias from the InviteShareButton call.
      cfg_name=$(grep -oE 'appName=\{[a-zA-Z0-9_]+\.appName\}' "$appfile" | head -1 | sed -E 's/.*\{([a-zA-Z0-9_]+)\.appName\}/\1/')
      [ -z "$cfg_name" ] && cfg_name="appConfig"
      # Detect the room/bench id variable name from the InviteShareButton call.
      room_arg=$(grep -oE 'roomId=\{[a-zA-Z0-9_]+\}' "$appfile" | head -1 | sed -E 's/.*\{([a-zA-Z0-9_]+)\}/\1/')
      [ -z "$room_arg" ] && room_arg="roomId"

      python3 - "$appfile" "$cfg_name" "$room_arg" <<'PY'
import sys, pathlib, re
p, cfg, room = sys.argv[1:4]
path = pathlib.Path(p)
text = path.read_text()
if "MeshBeacon" in text:
    sys.exit(0)
# Add MeshBeacon to existing mesh-common import or add a new one
if 'from "@baditaflorin/mesh-common"' in text:
    text = re.sub(
        r'import \{([^}]*)\} from "@baditaflorin/mesh-common";',
        lambda m: 'import {' + m.group(1).rstrip().rstrip(',') + ", MeshBeacon" + '} from "@baditaflorin/mesh-common";',
        text,
        count=1,
    )
else:
    # add a fresh import after the last existing import
    lines = text.splitlines(True)
    last_import = 0
    for i, line in enumerate(lines):
        if line.startswith("import "):
            last_import = i
    lines.insert(last_import + 1, 'import { MeshBeacon } from "@baditaflorin/mesh-common";\n')
    text = "".join(lines)
# Insert the component near the InviteShareButton
pattern = re.compile(r'([ \t]*)<InviteShareButton[^/]*/>', re.MULTILINE)
m = pattern.search(text)
if m is None:
    sys.exit(2)
indent = m.group(1)
snippet = f"{indent}<MeshBeacon app={{{cfg}.appName}} room={{{room}}} />\n"
text = text[:m.end()] + "\n" + snippet + text[m.end():]
path.write_text(text)
PY
      [ $? -eq 0 ] || { fail=$((fail+1)); fail_names+=("$app:edit-failed"); continue; }
    fi
  fi

  # Rebuild — picks up new mesh-common code unconditionally.
  echo "==> [$app] smoke"
  if ! (cd "$app" && npm run smoke >/dev/null 2>&1); then
    echo "    smoke FAILED — reverting"
    (cd "$app" && git checkout -q -- src/App.tsx src/main.tsx 2>/dev/null) || true
    fail=$((fail+1)); fail_names+=("$app:smoke-failed"); continue
  fi

  cd "$app"
  if git diff --quiet HEAD -- src/ docs/; then
    echo "    nothing to commit — skipping"
    cd "$PARENT"; skip=$((skip+1)); continue
  fi
  git add src/ docs/ 2>/dev/null
  git -c user.name="Florin Badita" -c user.email="baditaflorin@gmail.com" \
    commit -q -m "$COMMIT_MSG" 2>/dev/null || true
  if ! git push -q 2>/dev/null; then
    if ! git push origin main 2>/dev/null; then
      echo "    push FAILED"; fail=$((fail+1)); fail_names+=("$app:push-failed"); cd "$PARENT"; continue
    fi
  fi
  cd "$PARENT"
  ok=$((ok+1))
  echo "    OK"
done

echo "------"
echo "shipped: $ok · skipped: $skip · failed: $fail"
if [ "$fail" -gt 0 ]; then
  printf '  %s\n' "${fail_names[@]}"
fi
