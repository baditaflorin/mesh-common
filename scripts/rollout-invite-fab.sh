#!/usr/bin/env bash
#
# rollout-invite-fab.sh — for every sibling mesh-* app whose src/App.tsx
# renders <MeshShell ... onRoomChange={setRoomId}> WITHOUT a `room=` prop,
# add `room={room}`, run `npm run smoke`, commit, and push.
#
# Idempotent: skips apps already on the new pattern. Sequential.
#
set -uo pipefail

PARENT="$(cd "$(dirname "$0")/../.." && pwd)"
COMMIT_MSG="${1:-feat(chrome): inherit invite-QR FAB + chain tracker from mesh-common 0.4.1}"

ok=0; skip=0; fail=0
fail_names=()

cd "$PARENT"
for app in mesh-*; do
  [ "$app" = "mesh-common" ] && continue
  appfile="$app/src/App.tsx"
  [ -f "$appfile" ] || continue
  # Skip apps without MeshShell entirely
  grep -q 'MeshShell' "$appfile" || { skip=$((skip+1)); continue; }
  # Skip apps already updated. Look for the EXACT MeshShell form (avoid the
  # decoy `<Feature room={room}` line which every app has).
  if grep -q 'onRoomChange={setRoomId} room={room}>' "$appfile" 2>/dev/null; then
    skip=$((skip+1)); continue
  fi
  # Only edit canonical pattern; bail loudly if not found
  if ! grep -q 'onRoomChange={setRoomId}>' "$appfile"; then
    echo "==> [$app] non-canonical App.tsx — needs manual review"
    fail=$((fail+1)); fail_names+=("$app:non-canonical"); continue
  fi
  # In-place sed: insert ` room={room}` before the closing > of MeshShell open tag
  python3 - "$appfile" <<'PY'
import sys, pathlib
p = pathlib.Path(sys.argv[1])
t = p.read_text()
old = "onRoomChange={setRoomId}>"
new = "onRoomChange={setRoomId} room={room}>"
if old in t and new not in t:
    p.write_text(t.replace(old, new, 1))
PY
  echo "==> [$app] smoke"
  if ! (cd "$app" && npm run smoke >/dev/null 2>&1); then
    echo "    smoke FAILED — reverting App.tsx"
    (cd "$app" && git checkout -q -- src/App.tsx 2>/dev/null) || true
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
    git push origin main 2>/dev/null && echo "    pushed (origin main)" || { echo "    push FAILED"; fail=$((fail+1)); fail_names+=("$app:push-failed"); cd "$PARENT"; continue; }
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
