#!/usr/bin/env bash
#
# check-docs-updated.sh — gate for mesh-common itself: if src/index.ts adds
# a new public export, README.md and CHANGELOG.md MUST be touched in the
# same commit. Without that, primitives ship silently and apps never learn
# about them.
#
# CI (.woodpecker.yml) runs it on every pull request as
# `--range origin/main..HEAD`. Run it by hand before committing:
#
#   bash scripts/check-docs-updated.sh
#
# Behavior:
#   1. List every public name exported from src/index.ts at the new state,
#      with scripts/list-public-exports.mjs (TypeScript compiler API: sees
#      multi-line and type-only `export { … }`, declarations and
#      `export * from` re-exports).
#   2. List the same at the old state.
#   3. If new names appeared (names starting with `_` are ignored):
#       a. Each must be name-mentioned in README.md            → else FAIL
#       b. CHANGELOG.md must be changed too                    → else FAIL
#
# Modes:
#   --staged   (default) compare working-tree src/ against HEAD.
#   --range A..B          compare B against merge-base(A, B), as a PR review
#                         sees it; CI runs `--range origin/main..HEAD`.
#
# Needs node and the repo's devDependencies (`npm ci`).
#
# Exit codes:
#   0  no new exports, or all properly documented.
#   1  new exports missing README mention or CHANGELOG entry.
#   2  not run from mesh-common root, missing dependencies, unknown
#      revision, or src/index.ts could not be parsed.
#
set -euo pipefail

if [ ! -f src/index.ts ] || [ ! -f README.md ]; then
  echo "[check-docs-updated] run me from the mesh-common repo root" >&2
  exit 2
fi
# The lister and its typescript dependency come from the checkout this
# script lives in; git state comes from the current directory.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LISTER="$SCRIPT_DIR/list-public-exports.mjs"
if ! command -v node >/dev/null 2>&1 || [ ! -d "$SCRIPT_DIR/../node_modules/typescript" ]; then
  echo "[check-docs-updated] needs node and node_modules/typescript; run npm ci" >&2
  exit 2
fi

MODE="${1:---staged}"

# Public names exported by src/index.ts, sorted for comm. With a revision,
# read from git; without one, from the working tree. A lister failure is
# fatal (exit 2) rather than an empty list that would make every export look
# new or removed.
list_exports() {
  local out
  if [ $# -eq 0 ]; then
    out="$(node "$LISTER")" || exit 2
  else
    out="$(node "$LISTER" --rev "$1")" || exit 2
  fi
  printf '%s\n' "$out" | grep -v '^_' | grep -v '^$' | LC_ALL=C sort -u || true
}

verify_rev() {
  if ! git rev-parse --verify --quiet "$1^{commit}" >/dev/null; then
    echo "[check-docs-updated] unknown revision: $1 (fetch it first)" >&2
    exit 2
  fi
}

case "$MODE" in
  --staged)
    NEW="$(list_exports)"
    if git rev-parse --verify HEAD >/dev/null 2>&1; then
      OLD="$(list_exports HEAD)"
    else
      OLD=""
    fi
    ;;
  --range)
    RANGE="${2:?--range A..B}"
    case "$RANGE" in
      *...*) echo "[check-docs-updated] use A..B; the merge-base is computed for you" >&2; exit 2 ;;
      *..*) ;;
      *) echo "[check-docs-updated] --range needs A..B" >&2; exit 2 ;;
    esac
    FROM="${RANGE%%..*}"
    TIP="${RANGE#*..}"
    verify_rev "$FROM"
    verify_rev "$TIP"
    if ! BASE="$(git merge-base "$FROM" "$TIP")"; then
      echo "[check-docs-updated] no merge-base for $RANGE (shallow clone? fetch more history)" >&2
      exit 2
    fi
    OLD="$(list_exports "$BASE")"
    NEW="$(list_exports "$TIP")"
    ;;
  *)
    echo "[check-docs-updated] unknown mode: $MODE" >&2
    exit 2
    ;;
esac

echo "[check-docs-updated] $(printf '%s\n' "$NEW" | grep -c . || true) public exports (was $(printf '%s\n' "$OLD" | grep -c . || true))"

ADDED="$(LC_ALL=C comm -23 <(printf '%s\n' "$NEW") <(printf '%s\n' "$OLD") | grep -v '^$' || true)"

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
    if git diff --name-only "$BASE" "$TIP" | grep -qx CHANGELOG.md; then CHANGELOG_TOUCHED=1; fi
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
