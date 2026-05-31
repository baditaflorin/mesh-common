# Changelog

All notable changes to `@baditaflorin/mesh-common` are recorded here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The `scripts/check-docs-updated.sh` pre-commit hook fails any commit that
adds a new `src/index.ts` export without a corresponding entry here and a
mention in `README.md`.

## [Unreleased]

## [0.10.4] — 2026-05-31 — useNamedPeer is fleet-wide; openNPeers test helper

### Fixed

- **Display name now carries across apps on first try.** A name typed in one
  `baditaflorin.github.io/<app>` app was not remembered by sibling apps: it
  was written only to the per-app `<prefix>:displayName` key, and the
  `createMeshConfig` fleet bridge only publishes at module load — i.e. before
  the user has typed anything. The name reached the shared fleet store only
  after an extra reload of the first app, so opening a second app showed no
  name. `useNamedPeer` now (a) adopts the same-origin fleet persona (L1, key
  `mesh-fleet:v1:fleet`) when it has no per-app name on first render, and
  (b) mirrors every name change back into that persona immediately. Names are
  strict-ASCII gated (matching the persona allowlist) and the write is
  merge-preserving, so a non-conforming name stays app-local and never
  clobbers an existing fleet name/avatar.

### Added

- `openNPeers(browser, url, { storagePrefix, count })` in
  `@baditaflorin/mesh-common/testing` — opens `n` pages in one browser context
  joined to one room, for e2e tests of games that need 3+ peers (hidden-role
  assignment, quorum voting, rotating turns). Companion to `openTwoPeers`;
  returns `{ context, peers, cleanup }` (type `MeshGroup`).

### Tested

- Two new `useNamedPeer` cases: a name set in app A is read by a fresh app B on
  first render (no reload); a non-ASCII name stays app-local and does not
  overwrite an existing fleet name. Full suite green (407 tests).

## [0.10.3] — 2026-05-20 — bridge all three per-app name-key conventions

### Fixed

- 0.10.2 only bridged `<prefix>:myName`, but the fleet uses three
  conventions across ~134 apps (surveyed 2026-05-20):
  - `<prefix>:displayName` — ~54 apps via `useNamedPeer` (canonical)
  - `<prefix>:name` — ~7 apps directly (e.g. mesh-mafia)
  - `<prefix>:myName` — ~2 apps (e.g. mesh-applause)
    `createMeshConfig` now reads/writes all three. Hydrate writes the
    fleet nickname into all three keys (harmless — apps read only their
    own convention); publish takes the first non-empty value and also
    mirrors it back into the other keys so same-tab consumers in the
    same app stay consistent.

### Tested

- `tests/configBridge.test.ts` expanded to 9 cases — one per key
  convention for both hydrate and publish, plus the same-tab mirror
  invariant.

## [0.10.2] — 2026-05-20 — bridge per-app `myName` ↔ fleet persona

### Fixed

- Each `mesh-*` app's existing name input writes to a per-app
  `${storagePrefix}:myName` key and used to be independent of the
  fleet persona shown in the settings drawer — so typing a name in
  one app and opening another in the same browser produced an empty
  field, not the cross-app suggestion. **Now `createMeshConfig`
  bridges the two synchronously at module load**, _before_
  `App.tsx`'s `useState(() => localStorage.getItem(...))` runs:
  - If `<prefix>:myName` is empty and `mesh-fleet:v1:fleet` has a
    nickname → hydrate the app key from the fleet.
  - If `<prefix>:myName` is set and fleet is empty → publish the
    name into the fleet (strict-ASCII-allowlist gated; non-conforming
    names stay app-local).
    No per-app code changes required — just rebuild.

### Tested

- 6 new vitest tests in `tests/configBridge.test.ts` covering
  hydrate, no-overwrite-L0, publish-from-app, allowlist refusal,
  corrupt-fleet-tolerance, and `name`-fallback-when-`nickname`-empty.

## [0.10.1] — 2026-05-20 — `MeshShell` integrates `FleetIdentityPanel`

### Changed

- **`MeshShell`** now renders `FleetIdentityPanel` inside the settings drawer
  by default, so every app gets cross-app identity for free on rebuild — no
  per-app code changes required. Apps that want to opt out (kiosks, apps that
  own their own identity flow) can pass `fleetIdentityServiceUrl={null}`.
- Apps that want to override the service URL (e.g. point at a staging
  instance) pass `fleetIdentityServiceUrl="https://staging.example"`.

## [0.10.0] — 2026-05-20 — fleet identity (`fleetPersona`)

### Added — cross-app + cross-origin display identity

- **`useFleetPersona({ appName, serviceUrl? })`** — per-app hook that returns
  `{ persona, source, label, avatarSeed, setNickname, setName, setAvatar,
setPersona, forgetLocal, forgetEverywhere, mode, setMode, buildHandoffUrl,
importHandoff, hasRemoteCredentials, suggestion, loading }`. Three-tier
  resolution — L0 (per-app local) > L1 (same-origin shared) > L2 (optional
  remote service). The L2 fetch is 2 s timeout, fire-and-forget, never blocks
  the UI. `FleetPersona` carries both **nickname** and **name** so apps pick
  what to render; the **avatar** (seed + variant + palette) rides along.
- **`FleetAvatar`** — drop-in avatar for the current persona, built on
  `PeerAvatar`. Same seed → same picture across every fleet app, no network.
- **`FleetIdentityPanel`** — drop-in settings UI: nickname + name + avatar
  picker, sync mode radio (off / same-browser / cross-domain), QR-able handoff
  URL generator, and a "Forget me everywhere" kill switch. `serviceUrl`
  defaults to the canonical fleet service; pass `null` to disable L2.
- **`DEFAULT_FLEET_PERSONA_SERVICE_URL`** — canonical public URL
  (`https://fleet-persona.0exec.com`) baked in so apps don't have to hard-code.
- Low-level helpers: `readLocalPersona`, `writeFleetLocalPersona`,
  `ensureAnonId`, `fetchRemotePersona`, `publishRemotePersona`,
  `deleteRemotePersona`, `buildHandoffUrl`, `consumeHandoffFromHash`,
  `sanitizePersona`, `isValidPersonaField`, `resolvePersonaSync`.

### Wire surface

Strict ASCII allowlist (`^[A-Za-z0-9_\- .]{1,32}$`) on every text field — same
regex on the client and on the server, neutralising stored-XSS / homoglyph
concerns. anonId + writeToken are 128-bit hex; the writeToken never leaves
the primitive's module so app code can't accidentally exfiltrate it.

### Tests

39 new vitest tests (`tests/fleetPersona.test.ts` + `tests/useFleetPersona.test.tsx`)
covering validation, L0/L1 storage isolation, mode toggling, resolution order,
anon/token lifecycle, handoff URL round-trip, and service-client fetch/publish/delete
under success, failure, timeout, and 5xx.

### Companion service

`github.com/baditaflorin/go-fleet-persona` — Go binary, pure-Go SQLite,
argon2id writeToken hashing, fixed-window rate-limit, daily-rotated salted
IP-hash, deployed at `https://fleet-persona.0exec.com` via the standard
fleet IaC chain (services-registry + fleet-runner + dockerhost compose).

## [0.9.0] — 2026-05-19 — consolidation batch 2 (13 primitives)

### Added — presence layer (built on `useAwareness`)

- **`usePresenceCursors(room, opts)`** — Figma-style live cursors throttled
  to ~30 Hz. Returns `{ peers, setLocalCursor, CursorLayer }`. Deterministic
  per-peer color. Replaces ad-hoc per-app cursor implementations.
- **`useTypingIndicator(room, { name?, idleAfterMs? })`** — "alice is typing…"
  with auto-expiry. Wire `bump()` to your input handler; the hook returns
  `typing[]` + display `names[]` for everyone else.
- **`useNetworkQuality(room, opts)`** — per-peer RTT via awareness ping/pong.
  Returns `{ rtts, median, mine }`. Use the median to decide whether to
  auto-degrade cursors / animations.

### Added — messaging

- **`useReadReceipts(room, { mapName? })`** — per-peer monotone "last seen at
  message N" over a `Y.Map<peerId, number>`. `markSeen(n)` is monotone
  (backward writes are ignored); `readersOf(n)` returns peers ≥ `n`.
- **`useThreadedMessages<T>(room, { mapName? })`** — `Y.Map<msgId, {parent,
body, by, at, sig}>` with `post()`, `reply()`, and a pre-flattened
  `threads` array (parent-first, depth-first) ready for render. `remove(id)`
  drops a message; replies become orphans (callers can re-parent).

### Added — network + lifecycle

- **`useNetworkOnline({ probeUrl?, probeIntervalMs?, retryIntervalMs? })`** —
  augments `navigator.onLine` with a periodic HEAD probe. Distinguishes
  "really online" from "interface-up-but-captive-portal". Default probe
  target is `https://www.gstatic.com/generate_204`.
- **`useOfflineQueue<T>({ online, flush, storageKey?, retryMs?, maxAgeMs?,
maxItems? })`** — buffer writes when isolated, replay on reconnect.
  Persisted to `localStorage` so writes survive a tab reload. At-least-once
  delivery; make `flush` idempotent via the caller-supplied id.

### Added — media

- **`useFileShare(room, { mapName?, chunkBytes?, maxBytes? })`** — chunked
  file share through the existing Yjs transport. Default 16 KB chunks,
  5 MB cap. `send(blob)` returns the file id; receiver gets `download(id)`
  and `blobOf(id)`. Honest: files live in Yjs history until the room is
  GC'd; not for secrets — use `useRoomSeal` first if you care.
- **`useVoiceActivity({ stream, rmsThreshold?, zcrMin?, zcrMax?, hangoverMs? })`**
  — voice activity detection by RMS energy + zero-crossing rate. Pure Web
  Audio, no ML payload. Returns `{ active, rms, zcr }`. Good enough for
  "alice is speaking", not for speech-to-text gating.

### Added — rendering

- **`SafeMarkdown` / `renderMarkdownToSafeHtml(source, gfm?, inline?)`** —
  markdown rendering via `marked` (single file, 0 deps) plus an allow-list
  HTML sanitizer. Permitted: paragraphs, emphasis, lists, headings, code,
  blockquote, `<a>` with `href` (scheme-validated, `javascript:` and
  `data:text/*` rejected), `<span class>`. Adds `rel="noopener noreferrer"
target="_blank"` to every anchor. No raw HTML pass-through.

### Added — lifecycle UX

- **`useChangelogToast({ appName, version, onUpgrade, skipFirstInstall? })`** —
  one-shot "what's new in vX.Y" toast on the first session after a version
  bump. Per-app key in `localStorage`. First install is silent by default.

### Added — dev tooling

- **`CrdtInspector`** — `?inspect=1`-gated overlay showing shared types,
  sizes, updates/sec, peer count, your peerId. Don't ship default-on
  (observing every doc update is non-zero overhead).
- **`useFakeTime` / `time` / `setFakeTime(ms)` / `advanceFakeTime(deltaMs)`
  / `resetFakeTime()`** — test fixture: in production every call returns
  `Date.now()`; in tests you freeze and step the clock. `clockSync` now
  reads through this so awareness-based timing logic is deterministic
  under Vitest / Playwright.

### Changed

- `clockSync.ts` reads `now()` from `useFakeTime` instead of calling
  `Date.now()` directly. Default behavior is unchanged (no fake time set →
  `Date.now()` passthrough).
- `package.json` adds `marked@^16` (one file, zero transitive deps).

### Not changed

- Net new runtime payload (gzipped): `marked` (~14 KB) + the 13 hooks/
  components (~10 KB combined). The `CrdtInspector` (~2 KB) is dev-only and
  trivially tree-shakes if you don't import it.

---

## [0.8.0] — 2026-05-19 — consolidation batch 1 (5 primitives + docs-sync gate)

### Added

- **`useAwareness<T>(room)`** — typed wrapper around `y-protocols/awareness`
  for ephemeral per-peer state (cursors, "typing…", live reactions). Sister
  to `useRoster` (heartbeat-based, persistent) and `usePerPeerValue`
  (CRDT-persisted) but explicitly _ephemeral_ — disappears on disconnect,
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
- **`scripts/mesh-doctor.sh`** — single-app or `--fleet` drift audit.
- **`scripts/check-docs-updated.sh`** — diff `src/index.ts` against HEAD;
  fail if new exports landed without README + CHANGELOG entry.
- **`scripts/install-hooks.sh`** — installs the pre-commit gate.

### Changed

- `GestureKind` widened to include `"longpress"`.

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
  mesh-\* app crashed the whole tab on any Yjs observer throw; one drop-in
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
