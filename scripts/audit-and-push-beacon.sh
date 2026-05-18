#!/usr/bin/env bash
#
# audit-and-push-beacon.sh — for every sibling mesh-* app whose DEPLOYED
# bundle is missing the `/pix.gif` beacon marker, rebuild docs/ from
# the current local mesh-common, commit, push.
#
# Idempotent: skips apps whose live bundle already contains /pix.gif.
# Logs each step + tallies skipped / ok / failed.
#
set -uo pipefail

PARENT="$(cd "$(dirname "$0")/../.." && pwd)"
COMMIT_MSG="${1:-feat: inherit pageview beacon from mesh-common 0.5.1}"

stale=0; live=0; ok=0; skip=0; fail=0
fail_names=()
stale_list=""

cd "$PARENT"

# Phase 1 — discover stale apps in parallel
for app in mesh-*; do
  [ "$app" = "mesh-common" ] && continue
  [ -d "$app/.git" ] || continue
  (
    url="https://baditaflorin.github.io/$app/"
    asset=$(curl -fsS --max-time 10 "$url" 2>/dev/null | grep -oE 'assets/index-[A-Za-z0-9_-]+\.js' | head -1)
    [ -z "$asset" ] && { echo "STALE $app (404)"; exit 0; }
    n=$(curl -fsS --max-time 10 "${url}${asset}" 2>/dev/null | grep -c 'pix.gif' 2>/dev/null)
    if [ "${n:-0}" -gt 0 ] 2>/dev/null; then
      echo "LIVE  $app"
    else
      echo "STALE $app"
    fi
  ) &
  # cap parallelism — 20 at a time
  if [ $(($(jobs -r -p | wc -l))) -ge 20 ]; then wait -n; fi
done
wait > /tmp/beacon-audit.txt
# The subshell echo lines went to stdout above; the redirect above is for `wait`,
# not for the subshell output. Re-run sequentially-ish using a tempfile.

# Re-collect cleanly
> /tmp/beacon-audit.txt
for app in mesh-*; do
  [ "$app" = "mesh-common" ] && continue
  [ -d "$app/.git" ] || continue
  url="https://baditaflorin.github.io/$app/"
  asset=$(curl -fsS --max-time 10 "$url" 2>/dev/null | grep -oE 'assets/index-[A-Za-z0-9_-]+\.js' | head -1)
  if [ -z "$asset" ]; then
    echo "STALE $app (404)" >> /tmp/beacon-audit.txt
    stale=$((stale+1)); stale_list="$stale_list $app"
    continue
  fi
  n=$(curl -fsS --max-time 10 "${url}${asset}" 2>/dev/null | grep -c 'pix.gif' 2>/dev/null)
  if [ "${n:-0}" -gt 0 ] 2>/dev/null; then
    echo "LIVE  $app" >> /tmp/beacon-audit.txt
    live=$((live+1))
  else
    echo "STALE $app" >> /tmp/beacon-audit.txt
    stale=$((stale+1)); stale_list="$stale_list $app"
  fi
done

echo "audit: live=$live, stale=$stale"
echo "stale list:$stale_list" | tr ' ' '\n' | head -20

# Phase 2 — rebuild + push each stale app
for app in $stale_list; do
  cd "$PARENT/$app" || continue
  if ! npm run smoke >/dev/null 2>&1; then
    echo "  smoke FAILED on $app — skipping"
    fail=$((fail+1)); fail_names+=("$app:smoke")
    continue
  fi
  if git diff --quiet HEAD -- src/ docs/; then
    skip=$((skip+1)); cd "$PARENT"; continue
  fi
  git add -A docs/ src/ 2>/dev/null
  if ! git -c user.name="Florin Badita" -c user.email="baditaflorin@gmail.com" \
       commit -q -m "$COMMIT_MSG" 2>/dev/null; then
    # Maybe prettier reformatted — try prettier --write then re-commit
    npx prettier --write src/ >/dev/null 2>&1 || true
    git add -A docs/ src/ 2>/dev/null
    git -c user.name="Florin Badita" -c user.email="baditaflorin@gmail.com" \
       commit -q -m "$COMMIT_MSG" 2>/dev/null || { fail=$((fail+1)); fail_names+=("$app:commit"); cd "$PARENT"; continue; }
  fi
  if ! git push -q 2>/dev/null; then
    if ! git push origin main 2>/dev/null; then
      fail=$((fail+1)); fail_names+=("$app:push"); cd "$PARENT"; continue
    fi
  fi
  ok=$((ok+1))
  echo "  OK $app"
  cd "$PARENT"
done

echo "------"
echo "pushed: $ok · skipped(no-diff): $skip · failed: $fail · already-live: $live"
if [ "$fail" -gt 0 ]; then
  printf '  fail: %s\n' "${fail_names[@]}"
fi
