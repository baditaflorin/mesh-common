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
| `PersonalQR` / `useQRScanner` / `QRExchange` | Inline-SVG QR (real-URL payload) + camera scanner + paste-fallback widget |
| `useDirectedEdges` / `shortestPath` / `longestSimplePath` | Append-only `Y.Array<Edge>` + graph helpers for the social-graph apps |
| `useIncomingScanLink` | One-shot consume of `#r=…&p=…&x=…` hash params after a QR-scan navigation |
| **`identity`** ⭐ | **Ed25519 keypair generation, persistence, sign/verify, `useIdentity` hook (~32 KB)** |
| **`tofuRegistry`** ⭐ | **`Y.Map<peerId, signed pubkey record>` with first-use trust pinning** |
| **`moderator`** ⭐ | **Signed first-claim-wins role, 30-min auto-expire, partition-aware tiebreak** |
| **`ModeratorBadge`** ⭐ | **Drop-in UI: "alice is moderating · auto-clears in 28m · soft role, not enforcement"** |
| **`MeshErrorBoundary`** 🆕 | **Drop-in crash containment for the `<Feature>` subtree. Fallback card with `try again`, `copy diagnostics` (clipboard blob), and `reload page`. Accepts `fallback` render-prop and `onError` handler. `MeshErrorBoundaryProps`.** |
| **`useMeshLink` / `makeMeshLinkFragment` / `parseMeshLink`** 🆕 | **Type-safe encoder + parser for the `#r=…&p=…&x=…` deep-link fragment. JSON-encodes object payloads; raw strings pass through. Wire-format versioned via `&v=`. `MeshLinkApi`, `MeshLinkPayload`, `ParsedMeshLink`.** |
| `@baditaflorin/mesh-common/eslint` 🆕 | **Shared ESLint flat config preset.** One import + one spread in each app's `eslint.config.js`. |
| `@baditaflorin/mesh-common/prettier` 🆕 | **Shared Prettier preset.** `"prettier": "@baditaflorin/mesh-common/prettier"` in each app's `package.json`. |
| `scripts/generate-privacy-section.mjs` 🆕 | **Rewrites the auto-generated `Capabilities used` block in `docs/privacy.md` from `src/` imports.** Run with `--check` in pre-push to fail the build if drift is detected. |
| `scripts/install-perf-checks.sh` 🆕 | **Installs `tests/e2e/perf-budget.spec.ts` (LCP + INP + TBT budgets) and `tests/e2e/memory-leak.spec.ts` (heap growth detector) into an existing app.** |
| **`useAwareness`** 🆕 | **Typed wrapper around `y-protocols/awareness` — presence / cursors / typing indicators with one hook. Returns `AwarenessApi<T>`.** |
| **`PeerAvatar`** 🆕 | **Deterministic inline-SVG avatar from a peerId (`beam` blob or `grid` identicon). Props on `PeerAvatarProps`; selectable via `AvatarVariant`. Zero network, zero PII.** |
| **`useMultiRoom`** 🆕 | **Run several Yjs rooms in one tab — facilitator dashboards, embeds, side-by-side mesh apps. Shape: `MultiRoomApi` over `MultiRoomEntry[]`.** |
| **`useTypedMap` / `useTypedArray` / `defineFeatureContract`** 🆕 | **Zod-validated `Y.Map` / `Y.Array` — old/hostile peers' invalid writes get filtered at the edge. Returns `TypedMap` / `TypedArray`; configure via `ContractOptions`.** |
| **`useRoomSeal` / `deriveRoomKey` / `sealerFromKey`** 🆕 | **Room-wide AES-GCM seal via PBKDF2(passphrase, roomId) — opt-in E2E with no key-exchange UX. Returns `RoomSeal`; configure via `RoomSealOptions`.** |
| **`usePresenceCursors`** 🆕 | **Figma-style live cursors built on `useAwareness`; throttled to ~30 Hz with auto-coloring per `peerId`. Drop in `<CursorLayer />` and call `setLocalCursor()` from `onPointerMove`.** |
| **`useTypingIndicator`** 🆕 | **"alice is typing…" with idle-expiry. Wire `bump()` into your input handlers; the hook returns `typing[]` + `names[]` for everyone else.** |
| **`useNetworkQuality`** 🆕 | **Per-peer RTT over awareness pings; returns a `median` you can use to auto-degrade animations on slow links.** |
| **`useReadReceipts`** 🆕 | **Per-peer monotone "last seen at message N" over a `Y.Map`. `markSeen(n)` advances; `readersOf(n)` lists peers who reached `n`.** |
| **`useThreadedMessages`** 🆕 | **`Y.Map<msgId, {parent, body, by, at, sig}>` with `post()` / `reply()` / pre-flattened `threads` for rendering.** |
| **`useNetworkOnline`** 🆕 | **Honest online detector: `navigator.onLine` + a periodic 204 probe. Distinguishes "online" from "captive portal hostage".** |
| **`useOfflineQueue`** 🆕 | **Buffer writes when isolated; replay through `flush()` when reconnected. Persisted in `localStorage`. At-least-once — make `flush` idempotent via the caller-supplied id.** |
| **`useFileShare`** 🆕 | **Chunked file share through the existing Yjs transport (5 MB cap; tune `chunkBytes`). Receiver gets `download(fileId)` and `blobOf(fileId)`.** |
| **`useVoiceActivity`** 🆕 | **VAD by RMS energy + zero-crossing rate. Pure Web Audio, ~100 lines, no ML payload. Returns `{ active, rms, zcr }`.** |
| **`SafeMarkdown` / `renderMarkdownToSafeHtml`** 🆕 | **Markdown rendering via `marked` (single file, 0 deps) + an allow-list sanitizer. No raw HTML pass-through; safe schemes only.** |
| **`useChangelogToast`** 🆕 | **One-shot "what's new in vX.Y" toast on the first session after a version bump. Per-peer state in `localStorage`.** |
| **`CrdtInspector`** 🆕 | **Dev-only overlay (`?inspect=1`) showing every shared type, sizes, updates/sec, peer count, your peerId. Don't ship default-on.** |
| **`useFakeTime` / `time` / `setFakeTime` / `advanceFakeTime`** 🆕 | **Test fixture: in production every call collapses to `Date.now()`; in tests you freeze and step the clock. `clockSync` honors it transparently.** |
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

## Shared lint + format preset

One bump fixes formatting and lint rules across every mesh-* app.

```js
// eslint.config.js — in any mesh-* app
import meshCommon from "@baditaflorin/mesh-common/eslint";
export default meshCommon();
```

```json
// package.json — in any mesh-* app
{
  "prettier": "@baditaflorin/mesh-common/prettier"
}
```

The eslint preset declares its own dependencies as peers — install once per app:

```bash
npm i -D eslint typescript-eslint eslint-plugin-react-hooks eslint-config-prettier
```

We don't bundle these into `mesh-common`'s `dependencies` because the linter belongs in `devDependencies`, not the runtime tree shipped to GitHub Pages.

## Privacy section, auto-generated

The privacy section of every app's `docs/privacy.md` must accurately reflect the capabilities the code actually uses (camera, location, motion, identity, etc.). Hand-typed privacy sections drift the moment a hook is added; this script makes drift impossible:

```bash
cd mesh-foo
node ../mesh-common/scripts/generate-privacy-section.mjs           # rewrite
node ../mesh-common/scripts/generate-privacy-section.mjs --check   # pre-push gate
```

The script walks `src/**` for imports from `@baditaflorin/mesh-common`, maps each capability-bearing hook (e.g. `useCamera` → "📷 Camera access") to a privacy bullet, and rewrites the `<!-- mesh:capabilities-block:start -->…end -->` region inside `docs-source/privacy.md` and `docs/privacy.md`.

In `--check` mode the script exits non-zero if the file would change — wire this into your pre-push hook so the docs can never lag behind the code.

## Performance budgets + memory leak detector

Two Playwright specs live in the scaffold template and can be installed into any existing app:

```bash
cd mesh-foo
bash ../mesh-common/scripts/install-perf-checks.sh
```

This drops two specs and adds one `npm` script:

- `tests/e2e/perf-budget.spec.ts` — captures LCP + TBT on cold load + INP after one interaction; fails over configurable thresholds (defaults: LCP ≤ 2500 ms, TBT ≤ 600 ms, INP ≤ 300 ms). Runs in the default Playwright pass (≈3 s).
- `tests/e2e/memory-leak.spec.ts` — two-peer 60 s noise loop, before/after heap deltas, fails over 15 MB growth. Long-running, so it's opt-in via `npm run test:leak`.

Override thresholds per app via env vars:

```bash
MESH_BUDGET_LCP_MS=4000 MESH_BUDGET_INP_MS=500 npx playwright test tests/e2e/perf-budget.spec.ts
MESH_LEAK_DURATION_MS=120000 MESH_LEAK_BUDGET_MB=10 npm run test:leak
```

### Recording specs interactively

```bash
cd mesh-foo
bash ../mesh-common/scripts/test-record.sh
```

Builds the app, boots `vite preview`, opens chromium with `playwright codegen`, and writes your clicks/typing to `tests/e2e/recorded.spec.ts`. Clean up afterward (replace `waitForTimeout` with `locator.waitFor`, add `expect()` assertions, rename to `feature.spec.ts`) and commit.

### Fleet drift audit

```bash
bash mesh-common/scripts/mesh-doctor.sh           # audit cwd app
bash mesh-common/scripts/mesh-doctor.sh --fleet   # audit every sibling mesh-*
```

Reports mesh-common pin freshness, scaffold completeness, `MeshShell` presence, e2e spec count, Pages output, and README-vs-imports drift. Fails on missing essentials; warns on stale pins.

## Documentation drift policy

Every commit that adds a public `src/index.ts` export must also touch `README.md` and `CHANGELOG.md`. Enforced by `scripts/check-docs-updated.sh`, wired into the pre-commit hook via:

```bash
bash scripts/install-hooks.sh
```

The hook diffs `src/index.ts` against `HEAD`. For every newly exported identifier:

1. The identifier name must appear somewhere in `README.md`.
2. `CHANGELOG.md` must be touched in the same commit (staged, unstaged, or untracked).

Reviewers can run `bash scripts/check-docs-updated.sh --range main..HEAD` on a PR branch before merge.

Why this exists: a new primitive that ships without a README mention is invisible to the 135 apps that could use it — and to me, six months later, trying to remember what I built.

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

## Security model — the four-layer stack

> One cryptographic foundation (layer 1), the moderator is the first feature it powers, and layers 2–4 stay opt-in and honest.

| Layer | Status | What it gives you | Bundle cost |
|---|---|---|---:|
| **1. Default everywhere** | Lives in `mesh-common` — every app inherits | TOFU pubkey registry, Ed25519-signed sensitive writes, moderator role | ~35 KB |
| **2. Per-app opt-in** | App imports a helper when needed | Commit-reveal RNG, E2E DMs (X25519 + AES-GCM via WebCrypto) | ~0 KB (native) |
| **3. Specialty only** | Lazy-loaded for the one or two apps that need it | Shamir secret-sharing for vault-style, SNARKs for anon-attestation | 10 KB / 3 MB |
| **4. Never claim** | Honesty contract in every README's privacy section | "End-to-end private" is not what we sell — peers in the room see the Yjs state | — |

### Using layer 1 in an app

```tsx
import { useIdentity, useModerator, ModeratorBadge } from "@baditaflorin/mesh-common";

function Body({ room, config }) {
  const identity = useIdentity(config.storagePrefix);
  const moderator = useModerator(room, config.storagePrefix, identity);

  return (
    <>
      <ModeratorBadge state={moderator} resolveName={(id) => names.get(id)} />
      {moderator.isMe && <button onClick={() => triggerRound()}>start round</button>}
      {/* Sign any sensitive write so peers can verify provenance: */}
      <button onClick={() => {
        const payload = { vote: "yes", round: 3 };
        const sig = identity.sign(payload);
        ballots.set(room.peerId, { ...payload, sig, pubkey: identity.pubkey });
      }}>vote</button>
    </>
  );
}
```

### What the moderator role can and cannot do

**Can**: lead UI ceremonies, authoritative-looking display, soft moderation (a flag peers running the standard client honor by default), tiebreaks on CRDT-merged contradictions.

**Cannot**: kick peers off the mesh, force-delete data, rate-limit, or prevent a hostile fork from ignoring the role. The role is a **coordination affordance, not an enforcement boundary** — the UI labels it "moderator (auto-clears in 30 min)" precisely to set that expectation.

### The honesty contract

Three things never to claim in any mesh-* app's README:

1. **"End-to-end private"** — peers in the room see the Yjs state. We protect *integrity* (signed who-said-what), not *secrecy* (who-saw-what).
2. **"Admin enforces rules"** — peers can ignore moderator commands. Display, don't deny.
3. **"Data is deleted"** — CRDT history is monotone. Redaction marks bytes; the bytes still exist on every peer who synced.

Correct phrasing for every app's privacy section:

> Everything you publish to a room is visible to every peer in that room. Your local device's name, key, and choices stay local. Cryptographic signatures prove **who** wrote each entry; they do **not** prevent peers from reading or copying entries. The room URL is the access control — share it deliberately.
