# 0010 — GitHub Pages publishing strategy

- **Status**: accepted
- **Date**: 2026-05-13

## Context

GitHub Pages will serve the live app. There are three publishing strategies: `main / (root)`, `main / docs`, or a `gh-pages` branch.

## Decision

Publish from **`main` branch, `/docs` folder**.

- Vite is configured with `base: "/__APP_NAME__/"` and `build.outDir: "docs"`.
- `docs/index.html` is copied to `docs/404.html` as the SPA fallback (GitHub Pages doesn't support `_redirects`).
- `docs/` is **not** gitignored — the committed build output is the deploy.
- No GitHub Actions; Husky pre-push hook runs `npm run smoke` which rebuilds `docs/`.

## Consequences

- ✅ Zero CI cost; account-wide Actions billing lock is irrelevant.
- ✅ Every commit's deployed code is auditable in git history.
- ❌ Committed `dist`-style output bloats git history; mitigated by keeping the bundle small.
- ❌ Authors must remember to run `npm run smoke` before push (enforced by hook).
