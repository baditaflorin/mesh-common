#!/usr/bin/env bash
#
# check-docs-updated.sh — gate for mesh-common itself: if src/index.ts adds
# a new public export, README.md and CHANGELOG.md MUST be touched in the
# same commit. Without that, primitives ship silently and apps never learn
# about them.
#
# Wire this into mesh-common/.husky/pre-commit (or run manually):
#
#   bash scripts/check-docs-updated.sh
#
# Behavior:
#   1. Compute set of public idents currently exported from src/index.ts.
#   2. Compute set from src/index.ts at HEAD (git show).
#   3. If new idents appeared:
#       a. Each must be name-mentioned in README.md            → else FAIL
#       b. CHANGELOG.md must be in the staged diff             → else FAIL
#
# Modes:
#   --staged   (default) compare working-tree index.ts against HEAD.
#   --range A..B          compare end of range vs start (for PR review).
#
# Exit codes:
#   0  no new exports, or all properly documented.
#   1  new exports missing README mention or CHANGELOG entry.
#   2  not run from mesh-common root.
#
set -euo pipefail

if [ ! -f src/index.ts ] || [ ! -f README.md ]; then
  echo "[check-docs-updated] run me from the mesh-common repo root" >&2
  exit 2
fi

MODE="${1:---staged}"

# Identifier extraction: every `export { … }` or `export function|class|const NAME` line.
extract_exports() {
  # stdin = an index.ts file body
  awk '
    /^export[[:space:]]*\{/ {
      gsub(/.*\{/, "")
      gsub(/\}.*/, "")
      n = split($0, parts, ",")
      for (i = 1; i <= n; i++) {
        ident = parts[i]
        # strip "type ", " as alias", whitespace
        gsub(/[[:space:]]+/, " ", ident)
        gsub(/^[[:space:]]+|[[:space:]]+$/, "", ident)
        sub(/^type /, "", ident)
        # take just the identifier (before any " as ")
        split(ident, p, " as ")
        ident = p[1]
        if (ident ~ /^[A-Za-z_][A-Za-z0-9_]*$/) print ident
      }
    }
    /^export[[:space:]]+(function|class|const|let|var|type|interface|enum)[[:space:]]+[A-Za-z_]/ {
      for (i = 1; i <= NF; i++) {
        if ($i ~ /^(function|class|const|let|var|type|interface|enum)$/) {
          ident = $(i+1)
          gsub(/[<(:=].*/, "", ident)
          if (ident ~ /^[A-Za-z_][A-Za-z0-9_]*$/) print ident
          break
        }
      }
    }
  ' | sort -u
}

case "$MODE" in
  --staged)
    NEW="$(extract_exports < src/index.ts)"
    if git rev-parse --verify HEAD >/dev/null 2>&1; then
      OLD="$(git show HEAD:src/index.ts 2>/dev/null | extract_exports || true)"
    else
      OLD=""
    fi
    ;;
  --range)
    RANGE="${2:?--range A..B}"
    BASE="${RANGE%..*}"
    TIP="${RANGE#*..}"
    OLD="$(git show "$BASE:src/index.ts" 2>/dev/null | extract_exports || true)"
    NEW="$(git show "$TIP:src/index.ts" 2>/dev/null | extract_exports || true)"
    ;;
  *)
    echo "[check-docs-updated] unknown mode: $MODE" >&2
    exit 2
    ;;
esac

ADDED="$(comm -23 <(printf '%s\n' "$NEW") <(printf '%s\n' "$OLD"))"

if [ -z "$ADDED" ]; then
  echo "[check-docs-updated] no new public exports — ok"
  exit 0
fi

echo "[check-docs-updated] new public exports detected:"
printf '  + %s\n' $ADDED
echo

# 1. Each new identifier must appear in README.md
MISSING_IN_README=""
for ident in $ADDED; do
  if ! grep -qFw "$ident" README.md; then
    MISSING_IN_README+="$ident "
  fi
done

# 2. CHANGELOG.md must be touched (staged or in the range).
CHANGELOG_TOUCHED=0
case "$MODE" in
  --staged)
    # Any of: staged, unstaged, or untracked — all count as "touched in this change".
    if git status --porcelain CHANGELOG.md 2>/dev/null | grep -q .; then CHANGELOG_TOUCHED=1; fi
    ;;
  --range)
    if git diff --name-only "$RANGE" | grep -qx CHANGELOG.md; then CHANGELOG_TOUCHED=1; fi
    ;;
esac

FAIL=0
if [ -n "$MISSING_IN_README" ]; then
  echo "[check-docs-updated] ✗ README.md does not mention: $MISSING_IN_README"
  FAIL=1
fi
if [ $CHANGELOG_TOUCHED -eq 0 ]; then
  if [ ! -f CHANGELOG.md ]; then
    echo "[check-docs-updated] ✗ CHANGELOG.md does not exist"
  else
    echo "[check-docs-updated] ✗ CHANGELOG.md was not modified in this change"
  fi
  FAIL=1
fi

if [ $FAIL -eq 1 ]; then
  cat >&2 <<EOF

============================================================
A new mesh-common export landed without doc updates.

Required:
  1. Add a one-line mention to README.md (typically in the
     "What's in here" table or the relevant section).
  2. Append a bullet under CHANGELOG.md's [Unreleased] or the
     current pending version section.

If this is intentional (e.g. an internal-only helper that
happens to be reachable), prefix the identifier with an
underscore so this check ignores it.
============================================================
EOF
  exit 1
fi

echo "[check-docs-updated] ✓ all new exports documented"
exit 0
