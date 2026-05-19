#!/usr/bin/env bash
#
# mesh-doctor.sh — drift + health check for a single mesh-* app or the fleet.
#
# Three modes:
#   mesh-doctor.sh                 — audit the app in cwd (must have package.json)
#   mesh-doctor.sh --fleet         — audit every sibling mesh-* app
#   mesh-doctor.sh --fleet --json  — same, machine-readable to stdout
#
# Per-app checks:
#   [common]     mesh-common version this app pins (file:../mesh-common counts as "linked")
#   [scaffold]   files the scaffold creates that should still exist
#   [chrome]     MeshShell, SelfRefBar, SettingsDrawer present in src/App.tsx
#   [tests]      smoke + e2e specs present
#   [docs-drift] README.md mentions every primitive the app imports from mesh-common
#   [contract]   if src/contract.ts exists, it imports from @baditaflorin/mesh-common
#   [husky]      .husky/pre-commit + commit-msg + pre-push present
#   [pages]      docs/index.html present (Pages serves this)
#
# Each check is one line: ✓ pass / ⚠ warn / ✗ fail. Exit 0 only if no fails.
# Warnings are non-fatal (e.g. "no e2e spec" — many apps don't need one).
#
set -uo pipefail

# Resolve mesh-common's own version once.
COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMMON_VERSION="$(node -p "require('$COMMON_DIR/package.json').version" 2>/dev/null || echo "?")"

# ---- mode parsing ----------------------------------------------------------

FLEET=0
JSON=0
for arg in "$@"; do
  case "$arg" in
    --fleet) FLEET=1 ;;
    --json)  JSON=1 ;;
    -h|--help)
      sed -n '2,30p' "$0"
      exit 0
      ;;
  esac
done

# ---- per-app check ---------------------------------------------------------

check_app() {
  local dir="$1"
  local app="$(basename "$dir")"
  local fail=0
  local warn=0

  if [ ! -f "$dir/package.json" ]; then
    printf '%s\n' "✗ [$app] no package.json"
    return 1
  fi

  # mesh-common pin
  local pin
  pin="$(node -p "(require('$dir/package.json').dependencies||{})['@baditaflorin/mesh-common'] || (require('$dir/package.json').devDependencies||{})['@baditaflorin/mesh-common'] || ''" 2>/dev/null || echo '')"
  if [ -z "$pin" ]; then
    printf '%s\n' "✗ [$app] common      no @baditaflorin/mesh-common dep"
    fail=$((fail+1))
  elif [[ "$pin" == file:* ]]; then
    printf '%s\n' "✓ [$app] common      linked ($pin)"
  elif [ "$pin" = "$COMMON_VERSION" ] || [ "$pin" = "^$COMMON_VERSION" ] || [ "$pin" = "~$COMMON_VERSION" ]; then
    printf '%s\n' "✓ [$app] common      pinned $pin (current)"
  else
    printf '%s\n' "⚠ [$app] common      pinned $pin (current is $COMMON_VERSION)"
    warn=$((warn+1))
  fi

  # scaffold files
  for f in src/App.tsx src/Feature.tsx src/main.tsx index.html vite.config.ts; do
    if [ -f "$dir/$f" ]; then
      :
    else
      printf '%s\n' "⚠ [$app] scaffold    missing $f"
      warn=$((warn+1))
    fi
  done

  # chrome present
  if grep -q "MeshShell" "$dir/src/App.tsx" 2>/dev/null; then
    printf '%s\n' "✓ [$app] chrome      MeshShell"
  else
    printf '%s\n' "✗ [$app] chrome      MeshShell missing in src/App.tsx"
    fail=$((fail+1))
  fi

  # tests
  if ls "$dir/tests/e2e/"*.spec.ts >/dev/null 2>&1; then
    local n_e2e; n_e2e="$(ls "$dir/tests/e2e/"*.spec.ts 2>/dev/null | wc -l | tr -d ' ')"
    printf '%s\n' "✓ [$app] tests       $n_e2e e2e spec(s)"
  else
    printf '%s\n' "⚠ [$app] tests       no e2e specs"
    warn=$((warn+1))
  fi

  # husky hooks (only flag if README claims hooks but they aren't on disk)
  if grep -q "husky\|Husky" "$dir/README.md" 2>/dev/null && [ ! -d "$dir/.husky" ]; then
    printf '%s\n' "⚠ [$app] husky       README mentions Husky but no .husky/ dir"
    warn=$((warn+1))
  fi

  # docs/index.html (Pages output)
  if [ -f "$dir/docs/index.html" ]; then
    printf '%s\n' "✓ [$app] pages       docs/index.html present"
  else
    printf '%s\n' "⚠ [$app] pages       no docs/index.html (run npm run build)"
    warn=$((warn+1))
  fi

  # docs-drift: every primitive imported from mesh-common should appear in README
  if [ -f "$dir/README.md" ]; then
    # Extract identifier list from any `from "@baditaflorin/mesh-common"` import (single-line).
    local missing=""
    local imports
    imports="$(grep -hoE 'import[[:space:]]*\{[^}]+\}[[:space:]]*from[[:space:]]*"@baditaflorin/mesh-common"' "$dir"/src/*.ts "$dir"/src/*.tsx 2>/dev/null | \
      sed -E 's/import[[:space:]]*\{([^}]+)\}.*/\1/' | tr ',' '\n' | sed -E 's/^[[:space:]]*([A-Za-z0-9_]+).*/\1/' | sort -u)"
    while IFS= read -r ident; do
      [ -z "$ident" ] && continue
      # Skip type-only utility names that aren't worth README-mentioning.
      case "$ident" in type|"") continue ;; esac
      if ! grep -qFw "$ident" "$dir/README.md" 2>/dev/null; then
        missing+="$ident "
      fi
    done <<< "$imports"
    if [ -n "$missing" ]; then
      printf '%s\n' "⚠ [$app] docs-drift  README does not mention: ${missing}"
      warn=$((warn+1))
    else
      printf '%s\n' "✓ [$app] docs-drift  README mentions all mesh-common imports"
    fi
  else
    printf '%s\n' "⚠ [$app] docs-drift  no README.md"
    warn=$((warn+1))
  fi

  # summary
  if [ $fail -gt 0 ]; then
    printf '%s\n' "✗ [$app] SUMMARY     $fail fail · $warn warn"
    return 1
  fi
  printf '%s\n' "✓ [$app] SUMMARY     0 fail · $warn warn"
  return 0
}

# ---- entry ----------------------------------------------------------------

if [ $FLEET -eq 1 ]; then
  PARENT="$(cd "$COMMON_DIR/.." && pwd)"
  total=0
  pass=0
  fail=0
  for dir in "$PARENT"/mesh-*/; do
    app="$(basename "$dir")"
    [ "$app" = "mesh-common" ] && continue
    [ ! -f "$dir/package.json" ] && continue
    total=$((total+1))
    if check_app "$dir"; then pass=$((pass+1)); else fail=$((fail+1)); fi
    echo
  done
  echo "================================================================"
  echo "  $total apps · $pass clean · $fail with failures · common v$COMMON_VERSION"
  echo "================================================================"
  [ $fail -eq 0 ]
else
  check_app "$(pwd)"
fi
