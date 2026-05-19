# Changelog

All notable changes to `@baditaflorin/mesh-common` are recorded here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The `scripts/check-docs-updated.sh` pre-commit hook fails any commit that
adds a new `src/index.ts` export without a corresponding entry here and a
mention in `README.md`.

## [Unreleased]

## [0.8.0] — 2026-05-19 — consolidation batch 1 (5 primitives + docs-sync gate)

### Added
- **`useAwareness<T>(room)`** — typed wrapper around `y-protocols/awareness`
  for ephemeral per-peer state (cursors, "typing…", live reactions). Sister
  to `useRoster` (heartbeat-based, persistent) and `usePerPeerValue`
  (CRDT-persisted) but explicitly *ephemeral* — disappears on disconnect,
  not part of CRDT history. Replaces ad-hoc `provider.awareness.on(...)`
  copies in apps.
- **`PeerAvatar`** — deterministic inline-SVG avatar seeded from a peerId
  or pubkey. Zero network, zero PII, zero new deps (uses existing
  `@noble/hashes`). Two variants: `beam` (soft blob) and `grid`
  (5×5 horizontally-symmetric identicon). Pairs with `tofuRegistry` for
  soft "same person" recognition.
- **`useRoomSeal({ roomId, passphrase })`** (security) — room-wide AES-GCM
  envelope. Key derived from PBKDF2-SHA256 (200k iterations) over the
  passphrase + room-scoped salt. Pure-function variants `deriveRoomKey` and
  `sealerFromKey` for non-React contexts. Use when the room URL alone
  shouldn't grant read access (e.g. sealed votes, forwarded invites).
  Honest: metadata still leaks; pair with `useSignedWrite` for provenance.
- **`useMultiRoom(config, [roomIds], { initialActive })`** — run several
  Yjs WebRTC rooms in one tab without cross-talk. Tab-strip facilitator
  pattern (`tabs.setActive("beta")`), each room gets its own Y.Doc + provider.
- **Feature contract (Zod)** — `useTypedMap`, `useTypedArray`,
  `defineFeatureContract`. Validates every read; filters out invalid
  entries written by old/hostile peers and surfaces them via `lastInvalid`.
  New runtime dep: `zod@^4` (zero transitive deps, ~14 KB gzip).
- **Long-press gesture** — `useGesture({ longPressMs, onLongPress })` now
  fires a dedicated `longpress` kind after the hold threshold (default
  600 ms), with optional `navigator.vibrate(40)` haptic feedback when
  available.
- **`scripts/test-record.sh`** — interactive `playwright codegen` wrapper.
  Boots `vite preview`, opens chromium, records clicks/typing to
  `tests/e2e/recorded.spec.ts` for any mesh-* app.
- **`scripts/mesh-doctor.sh`** — single-app or `--fleet` drift audit.
  Reports mesh-common pin freshness, scaffold completeness, chrome
  presence, test/Pages output, and README-vs-imports drift.
- **`scripts/check-docs-updated.sh`** — diff `src/index.ts` against HEAD
  (or a `--range A..B`); fail if new exports landed without README mention
  and CHANGELOG entry.
- **`scripts/install-hooks.sh`** — installs the pre-commit gate into
  `.git/hooks/` (no Husky dependency).

### Changed
- `GestureKind` widened to include `"longpress"`.
- `package.json` version bumped 0.7.0 → 0.8.0 (lands after ecosystem batch 3).

### Infrastructure
- Vitest `environmentMatchGlobs` extended for the new jsdom-needing tests.
- `package.json` adds `zod` to `dependencies`.

## [0.7.0] — 2026-05-19 — ecosystem batch 3

### Added

#### Components
- **`<MeshErrorBoundary>`** — class component that scopes crashes to the
  Feature subtree. Renders a fallback card with `try again`, `copy
  diagnostics` (clipboard-writes a structured blob with app/version/UA/
  stack/component-stack), and `reload page`. Accepts a custom `fallback`
  render-prop and `onError` side-effect handler. Until this landed every
  mesh-* app crashed the whole tab on any Yjs observer throw; one drop-in
  wrapper fixes the entire fleet.

#### Hooks + helpers
- **`useMeshLink(config)`** — canonical encoder + parser for the
  `#r=<roomId>&p=<peerId>&x=<extra>` deep-link fragment that every app
  needs for QR / share / paste flows. Pure-fn variants
  `makeMeshLinkFragment` and `parseMeshLink` are exported for use in
  workers and non-React contexts. JSON-encodes object payloads, raw
  strings pass through unchanged. Wire-format versioned via `&v=` so
  future schema bumps stay parseable.

#### Presets
- **`@baditaflorin/mesh-common/eslint`** — shared ESLint flat config.
  Wraps `typescript-eslint`'s recommended set, adds `react-hooks/*`,
  enforces house style, disables rules that conflict with prettier.
  Consumer's `eslint.config.js` is one import + one spread.
- **`@baditaflorin/mesh-common/prettier`** — shared formatter preset
  (100-char lines, 2-space, semicolons, double quotes). Consumer's
  `package.json` adds `"prettier": "@baditaflorin/mesh-common/prettier"`.
  Required peer deps for the eslint preset (one-time install per app):
  `eslint typescript-eslint eslint-plugin-react-hooks eslint-config-prettier`.

#### Scripts
- **`scripts/generate-privacy-section.mjs`** (also `bin: mesh-privacy`) —
  walks `src/**` for `@baditaflorin/mesh-common` imports, maps each
  capability-bearing hook to a privacy implication, rewrites the
  `<!-- mesh:capabilities-block:start -->…end -->` region inside
  `docs-source/privacy.md` and `docs/privacy.md`. Supports `--check` for
  pre-push gating. The privacy doc can never be more permissive than the
  imports.
- **`scripts/install-perf-checks.sh`** — drops `tests/e2e/perf-budget.spec.ts`
  and `tests/e2e/memory-leak.spec.ts` into an existing app and adds a
  `test:leak` package.json script. Idempotent.

#### Scaffold additions
- **`scaffold/template/tests/e2e/perf-budget.spec.ts.tmpl`** — Playwright
  spec that measures LCP + TBT on cold load and INP after one interaction;
  fails over configurable thresholds (defaults: LCP ≤ 2500ms, TBT ≤ 600ms,
  INP ≤ 300ms). Inherited by every newly-scaffolded app.
- **`scaffold/template/tests/e2e/memory-leak.spec.ts.tmpl`** — two-peer
  60s noise loop with before/after `HeapProfiler.collectGarbage` +
  `performance.memory.usedJSHeapSize` deltas; fails over 15 MB growth by
  default. Opt-in via `npm run test:leak` (long-running, not in default
  smoke).
- **`scaffold/template/README.md.tmpl`** + **`docs-source/privacy.md.tmpl`** —
  add `<!-- mesh:privacy-section:start -->` and
  `<!-- mesh:capabilities-block:start -->` markers so the privacy
  generator + a future `mesh-doctor` drift check have a stable anchor.

### Package
- **`exports`**: new `./eslint` and `./prettier` subpath exports.
- **`bin`**: `mesh-privacy` invokes the privacy generator.
- **`files`**: now ships `presets/` alongside `src` / `testing` / etc.
- **Version bump**: 0.5.1 → 0.7.0 (this batch ships in parallel with
  batch-1 / batch-2 in sibling worktrees; merge order will determine the
  final published bump).

### Not changed
- No new runtime dependencies — the eslint preset declares its
  dependencies as peer (consumer installs them once for their linter).
- Existing primitives untouched; this batch is purely additive.

---

## [0.5.1] — 2026-05-18

- Universal pageview beacon (`useMeshBeacon`, `MeshBeacon`).

## [0.5.0] — 2026-05-17

- 20 security + multiplayer primitives (`security/*`, `multiplayer/*`).
- 30 hook primitives extracted from the live app fleet (sensors, presence,
  voting, reactions, confetti, gestures, …).

## Older

See `git log -- src/` for pre-0.5.0 history.
