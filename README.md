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
