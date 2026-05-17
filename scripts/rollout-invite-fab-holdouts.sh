#!/usr/bin/env bash
#
# rollout-invite-fab-holdouts.sh — for each sibling mesh-* app whose
# src/App.tsx does NOT use <MeshShell>, retrofit a standalone
# <InviteShareButton/> next to the app's existing settings-fab and ensure
# the mesh-common styles.css is imported so .mesh-invite-* classes render.
#
# Conservative: only touches apps with a recognisable canonical layout:
#   - src/shared/config.ts exporting `appConfig.appName`
#   - src/App.tsx with `<button ... className="settings-fab"`
#   - @baditaflorin/mesh-common already in dependencies
#   - src/main.tsx importable for the styles bridge
#
# Idempotent: skips apps already retrofitted.
#
set -uo pipefail

PARENT="$(cd "$(dirname "$0")/../.." && pwd)"
COMMIT_MSG="${1:-feat(chrome): add InviteShareButton retrofit + mesh-common styles bridge}"

ok=0; skip=0; fail=0
fail_names=()

cd "$PARENT"
for app in mesh-*; do
  [ "$app" = "mesh-common" ] && continue
  appfile="$app/src/App.tsx"
  mainfile="$app/src/main.tsx"
  cfgfile="$app/src/shared/config.ts"
  [ -f "$appfile" ] || continue

  # Skip apps that already use MeshShell (rollout-invite-fab.sh handled them)
  if grep -q 'MeshShell' "$appfile"; then skip=$((skip+1)); continue; fi
  # Skip apps already retrofitted
  if grep -q 'InviteShareButton' "$appfile"; then skip=$((skip+1)); continue; fi
  # Bail on apps missing the canonical settings-fab marker
  if ! grep -q 'className="settings-fab"' "$appfile"; then
    fail=$((fail+1)); fail_names+=("$app:no-settings-fab"); continue
  fi
  # Bail on apps missing the canonical appConfig.appName
  if ! grep -q 'appName:' "$cfgfile" 2>/dev/null; then
    fail=$((fail+1)); fail_names+=("$app:no-appName-in-config"); continue
  fi

  # Detect the import alias for the app's local config (usually `appConfig`).
  # Read the line that imports config to extract the named binding.
  cfg_import_name=$(grep -E 'from "\./shared/config"' "$appfile" | head -1 | sed -E 's/.*\{ *([a-zA-Z0-9_]+) *\}.*/\1/')
  if [ -z "$cfg_import_name" ]; then
    cfg_import_name="appConfig"
  fi

  echo "==> [$app] retrofit (config alias: $cfg_import_name)"

  python3 - "$appfile" "$mainfile" "$cfg_import_name" <<'PY'
import sys, pathlib, re
appfile, mainfile, cfg_name = sys.argv[1:4]

# 1) App.tsx: add InviteShareButton import + render before settings-fab
app_p = pathlib.Path(appfile)
text = app_p.read_text()

if "InviteShareButton" not in text:
    # Insert import after the last existing `import ... from ".../...";` line at top
    import_line = 'import { InviteShareButton } from "@baditaflorin/mesh-common";\n'
    # Place it right after the last top-of-file import line
    lines = text.splitlines(True)
    last_import_idx = 0
    for i, line in enumerate(lines):
        if line.startswith("import "):
            last_import_idx = i
    lines.insert(last_import_idx + 1, import_line)
    text = "".join(lines)

    # Insert the component before the settings-fab button. Match the opening of:
    #   <button
    #     type="button"
    #     className="settings-fab"
    # ...preserving leading whitespace.
    pattern = re.compile(
        r'([ \t]*)<button\s+type="button"\s+className="settings-fab"',
        re.MULTILINE,
    )
    m = pattern.search(text)
    if m is None:
        raise SystemExit("settings-fab button not found")
    indent = m.group(1)
    snippet = (
        f'{indent}<InviteShareButton appName={{{cfg_name}.appName}} roomId={{roomId}} />\n'
    )
    insert_at = m.start()
    text = text[:insert_at] + snippet + text[insert_at:]
    app_p.write_text(text)

# 2) main.tsx: add `import "@baditaflorin/mesh-common/styles.css";` if absent
main_p = pathlib.Path(mainfile)
if main_p.exists():
    mtext = main_p.read_text()
    if "@baditaflorin/mesh-common/styles.css" not in mtext:
        # Insert before the local `./styles.css` import so namespaced rules apply first
        if 'import "./styles.css";' in mtext:
            mtext = mtext.replace(
                'import "./styles.css";',
                'import "@baditaflorin/mesh-common/styles.css";\nimport "./styles.css";',
                1,
            )
        else:
            # fallback: append at top of file
            mtext = 'import "@baditaflorin/mesh-common/styles.css";\n' + mtext
        main_p.write_text(mtext)
PY

  if [ $? -ne 0 ]; then
    echo "    python edit FAILED — reverting"
    (cd "$app" && git checkout -q -- src/App.tsx src/main.tsx 2>/dev/null) || true
    fail=$((fail+1)); fail_names+=("$app:edit-failed"); continue
  fi

  echo "    smoke"
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
    git push origin main 2>/dev/null && echo "    pushed (origin main)" || {
      echo "    push FAILED"; fail=$((fail+1)); fail_names+=("$app:push-failed"); cd "$PARENT"; continue;
    }
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
