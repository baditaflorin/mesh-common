# mesh-common

[![license](https://img.shields.io/badge/license-MIT-green)](./LICENSE)
[![version](https://img.shields.io/badge/version-0.1.0-blue)](./package.json)

Shared scaffolding + runtime for the `baditaflorin/mesh-*` family of rootless peer-to-peer browser apps. Sister project to `baditaflorin/go-common` — the same idea applied to the frontend.

## What's in here

| Module | Purpose |
|---|---|
| `createMeshConfig` | One-call config factory: app name, accent, version, commit, plus signaling / TURN / PayPal defaults |
| `MeshShell` | Top-level chrome: ⚙ FAB → settings drawer, self-ref footer (source / tip / version) |
| `SettingsDrawer` | Room ID + signaling / TURN overrides → localStorage |
| `SelfRefBar` | Bottom-right footer with GitHub link, PayPal link, version + commit |
| `useYRoom` | React hook → `{ doc, provider, peerId, peerCount }` for a given room ID |
| `iceConfig` | Load/save signaling URL, TURN token URL, ICE servers; dead-server pruning |
| `clockSync` | NTP-over-Yjs offset → mesh-median time, stable to ~10–30 ms |
| `commitReveal` | SHA-256 commit/reveal for anonymous votes / fair RNG / role assignment |
| `scaffold/create-mesh-app.sh` | One-shot CLI that creates a new app from the template |

Apps depend on this via `file:../mesh-common` (publish to npm later if/when useful — Vite bundles the package output into each app's `docs/` so live sites are self-contained).

## Live links displayed on every app

Each app scaffolded from this template includes a `SelfRefBar` showing, on every screen of the live page:

- `source` → `https://github.com/baditaflorin/<app-name>`
- `tip ♥` → `https://www.paypal.com/paypalme/florinbadita`
- `v<version>` → from `package.json`
- short git commit SHA → injected at build time

## Scaffolding a new app

```bash
git clone https://github.com/baditaflorin/mesh-common
cd mesh-common
bash scaffold/create-mesh-app.sh mesh-when2meet "Ephemeral availability picker, QR-join, no Doodle account" "#3aa8a1"
```

The script:

1. Copies the template into `../mesh-when2meet`.
2. Substitutes placeholders (`__APP_NAME__`, `__DESCRIPTION__`, `__ACCENT__`).
3. Runs `npm install` (uses `file:../mesh-common`).
4. Runs initial build to verify it works.
5. `git init` + first commit (Conventional Commits, hook-validated).

Then you only have to edit **`src/Feature.tsx`** — the single app-specific file — and push:

```bash
cd ../mesh-when2meet
# edit src/Feature.tsx
npm run smoke
git add -A && git commit -m "feat: implement availability picker"
gh repo create baditaflorin/mesh-when2meet --public --source=. --remote=origin
git push -u origin main
gh api -X POST repos/baditaflorin/mesh-when2meet/pages \
  -f 'source[branch]=main' -f 'source[path]=/docs'
```

## Testing — CPU only

Build once (GPU), run many times (CPU). Three test layers, all in the scaffold so every new app inherits them.

| Layer | Tool | What it covers | Cost per run |
|---|---|---|---|
| Unit / pure logic | Vitest | `commitReveal`, `clockSync`, `combineSalts`, component renders with `createMockRoom` | <1 s |
| Smoke (e2e) | Playwright + Chromium | Page loads, settings drawer opens, source/tip/version visible, no console errors | ~3 s |
| Multi-peer (e2e) | Playwright | Two pages in the same browser context sync via y-webrtc's BroadcastChannel fallback — **no signaling server, no network** | ~3 s |

```bash
npm install
npm run test:unit                          # 200-700 ms, runs everywhere
npx playwright install chromium            # one-time, ~120 MB, cached globally
npm run test:e2e                           # 3-5 s per app
```

### Cross-repo orchestration

```bash
# Run a command in every sibling mesh-* dir.
./mesh-common/scripts/across.sh npm run test:unit
./mesh-common/scripts/across.sh --parallel npm run smoke

# Aggregate Playwright JSON results from every repo into one summary.
./mesh-common/scripts/across.sh npm run test:e2e
./mesh-common/scripts/judge.sh   # → /tmp/mesh-judge/summary.json + markdown table
```

The `judge.sh` output is structured JSON an LLM can ingest in one short prompt — that's the "let CPU run tests, let LLM judge when something looks off" pattern. Re-running tests is free; only the judging step costs GPU tokens.

### Adding tests to an existing app

```bash
cd mesh-foo
bash ../mesh-common/scripts/install-tests-into-app.sh
npm install
npm test
```

Idempotent — re-running just refreshes the generic test files and merges any missing devDeps / scripts.

### Per-app feature tests

The scaffold provides two generic tests that work without modification (`smoke.spec.ts` and `mesh.spec.ts`). Apps that want richer assertions add a `tests/e2e/feature.spec.ts` with app-specific multi-peer logic. See `mesh-when2meet/tests/e2e/feature.spec.ts` for the canonical pattern: open two peers, do something on page A, assert the effect on page B.

## No GitHub Actions

The `baditaflorin` GitHub account has an Actions billing lock. CI is **local Husky-style hooks** instead:

- `pre-commit` — `npm run fmt:check && npm run typecheck`
- `commit-msg` — Conventional Commits validator
- `pre-push` — full smoke build

The build output in `docs/` is committed; Pages serves it directly.

## Self-hosted infrastructure

Every app defaults to these endpoints (overridable in the settings drawer):

| Repo | Endpoint | Purpose |
|---|---|---|
| https://github.com/baditaflorin/signaling-server | `wss://turn.0docker.com/ws` | y-webrtc signaling |
| https://github.com/baditaflorin/turn-token-server | `https://turn.0docker.com/credentials` | HMAC TURN creds |
| https://github.com/baditaflorin/coturn-hetzner | `turn:turn.0docker.com:3479` | TURN relay |

## License

MIT.
