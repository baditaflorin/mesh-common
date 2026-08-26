# mesh-common

## Eighth capability wave

`useAvailabilityGrid`, `useRankedBallot`, `useSharedForm`, and
`useSharedChecklist` and the shared collaboration primitives provide small,
validated shared coordination surfaces.
`useImageCapture`, `useMediaRecorder`, and `useScreenShare` wrap browser
capture lifecycles without acquiring a stream or sending media anywhere on
their own.

[![license](https://img.shields.io/badge/license-MIT-green)](./LICENSE)
[![version](https://img.shields.io/badge/version-0.1.0-blue)](./package.json)

Shared scaffolding + runtime for the `baditaflorin/mesh-*` family of rootless peer-to-peer browser apps. Sister project to `baditaflorin/go-common` — the same idea applied to the frontend.

## What's in here

| Module                                                                | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createMeshConfig`                                                    | One-call config factory: stable app ID, human display name, visual profile, shell layout, accent, version, commit, plus signaling / TURN / PayPal defaults. `meshAccentText()` keeps hex-accent actions readable.                                                                                                                                                                                                            |
| `MeshShell`                                                           | Product utility bar with Invite + Settings; connection diagnostics and About details are progressive rather than permanent viewport chrome                                                                                                                                                                                                                                                                                   |
| `MeshBreadcrumbs`                                                     | Semantic, responsive location trail with native links or local-state buttons; apps start disabled until they can describe real navigation                                                                                                                                                                                                                                                                                    |
| `SettingsDrawer`                                                      | Room ID + signaling / TURN overrides → localStorage, plus source/support/version/commit in its About footer                                                                                                                                                                                                                                                                                                                  |
| `MeshVisualProfileProvider` / `MeshLaunch` / presentation primitives  | Calm profiles plus reusable entry, surface, button, presence, and status components for a polished first viewport                                                                                                                                                                                                                                                                                                            |
| `SelfRefBar`                                                          | Optional legacy compact source/support/version strip; no longer mounted by `MeshShell`                                                                                                                                                                                                                                                                                                                                       |
| `useYRoom`                                                            | React hook → `{ doc, provider, peerId, peerCount }` for a given room ID                                                                                                                                                                                                                                                                                                                                                      |
| `iceConfig`                                                           | Load/save signaling URL, TURN token URL, ICE servers; dead-server pruning                                                                                                                                                                                                                                                                                                                                                    |
| `clockSync`                                                           | NTP-over-Yjs offset → mesh-median time, stable to ~10–30 ms                                                                                                                                                                                                                                                                                                                                                                  |
| `commitReveal`                                                        | SHA-256 commit/reveal for anonymous votes / fair RNG / role assignment                                                                                                                                                                                                                                                                                                                                                       |
| `PersonalQR` / `useQRScanner` / `QRExchange`                          | Inline-SVG QR (real-URL payload) + camera scanner + paste-fallback widget                                                                                                                                                                                                                                                                                                                                                    |
| `useDirectedEdges` / `shortestPath` / `longestSimplePath`             | Append-only `Y.Array<Edge>` + graph helpers for the social-graph apps                                                                                                                                                                                                                                                                                                                                                        |
| `useIncomingScanLink`                                                 | One-shot consume of `#r=…&p=…&x=…` hash params after a QR-scan navigation (parsed shape: `IncomingScan`)                                                                                                                                                                                                                                                                                                                     |
| **`identity`** ⭐                                                     | **Ed25519 keypair generation, persistence, sign/verify, `useIdentity` hook (~32 KB)**                                                                                                                                                                                                                                                                                                                                        |
| **`tofuRegistry`** ⭐                                                 | **`Y.Map<peerId, signed pubkey record>` with first-use trust pinning**                                                                                                                                                                                                                                                                                                                                                       |
| **`moderator`** ⭐                                                    | **Signed first-claim-wins role, 30-min auto-expire, partition-aware tiebreak**                                                                                                                                                                                                                                                                                                                                               |
| **`ModeratorBadge`** ⭐                                               | **Drop-in UI: "alice is moderating · auto-clears in 28m · soft role, not enforcement"**                                                                                                                                                                                                                                                                                                                                      |
| **`MeshErrorBoundary`** 🆕                                            | **Drop-in crash containment for the `<Feature>` subtree. Fallback card with `try again`, `copy diagnostics` (clipboard blob), and `reload page`. Accepts `fallback` render-prop and `onError` handler. `MeshErrorBoundaryProps`.**                                                                                                                                                                                           |
| **`useMeshLink` / `makeMeshLinkFragment` / `parseMeshLink`** 🆕       | **Type-safe encoder + parser for the `#r=…&p=…&x=…` deep-link fragment. JSON-encodes object payloads; raw strings pass through. Wire-format versioned via `&v=`. `MeshLinkApi`, `MeshLinkPayload`, `ParsedMeshLink`.**                                                                                                                                                                                                       |
| `@baditaflorin/mesh-common/eslint` 🆕                                 | **Shared ESLint flat config preset.** One import + one spread in each app's `eslint.config.js`.                                                                                                                                                                                                                                                                                                                              |
| `@baditaflorin/mesh-common/prettier` 🆕                               | **Shared Prettier preset.** `"prettier": "@baditaflorin/mesh-common/prettier"` in each app's `package.json`.                                                                                                                                                                                                                                                                                                                 |
| `scripts/generate-privacy-section.mjs` 🆕                             | **Rewrites the auto-generated `Capabilities used` block in `docs/privacy.md` from `src/` imports.** Run with `--check` in pre-push to fail the build if drift is detected.                                                                                                                                                                                                                                                   |
| `scripts/install-perf-checks.sh` 🆕                                   | **Installs `tests/e2e/perf-budget.spec.ts` (LCP + INP + TBT budgets) and `tests/e2e/memory-leak.spec.ts` (heap growth detector) into an existing app.**                                                                                                                                                                                                                                                                      |
| **`useAwareness`** 🆕                                                 | **Typed wrapper around `y-protocols/awareness` — presence / cursors / typing indicators with one hook. Returns `AwarenessApi<T>`.**                                                                                                                                                                                                                                                                                          |
| **`PeerAvatar`** 🆕                                                   | **Deterministic inline-SVG avatar from a peerId (`beam` blob or `grid` identicon). Props on `PeerAvatarProps`; selectable via `AvatarVariant`. Zero network, zero PII.**                                                                                                                                                                                                                                                     |
| **`useMultiRoom`** 🆕                                                 | **Run several Yjs rooms in one tab — facilitator dashboards, embeds, side-by-side mesh apps. Shape: `MultiRoomApi` over `MultiRoomEntry[]`.**                                                                                                                                                                                                                                                                                |
| **`useTypedMap` / `useTypedArray` / `defineFeatureContract`** 🆕      | **Zod-validated `Y.Map` / `Y.Array` — old/hostile peers' invalid writes get filtered at the edge. Returns `TypedMap` / `TypedArray`; configure via `ContractOptions`.**                                                                                                                                                                                                                                                      |
| **`useRoomSeal` / `deriveRoomKey` / `sealerFromKey`** 🆕              | **Room-wide AES-GCM seal via PBKDF2(passphrase, roomId) — opt-in E2E with no key-exchange UX. Returns `RoomSeal`; configure via `RoomSealOptions`.**                                                                                                                                                                                                                                                                         |
| **`usePresenceCursors`** 🆕                                           | **Figma-style live cursors built on `useAwareness`; throttled to ~30 Hz with auto-coloring per `peerId`. Drop in `<CursorLayer />` and call `setLocalCursor()` from `onPointerMove`.**                                                                                                                                                                                                                                       |
| **`useTypingIndicator`** 🆕                                           | **"alice is typing…" with idle-expiry. Wire `bump()` into your input handlers; the hook returns `typing[]` + `names[]` for everyone else.**                                                                                                                                                                                                                                                                                  |
| **`useNetworkQuality`** 🆕                                            | **Per-peer RTT over awareness pings; returns a `median` you can use to auto-degrade animations on slow links.**                                                                                                                                                                                                                                                                                                              |
| **`useReadReceipts`** 🆕                                              | **Per-peer monotone "last seen at message N" over a `Y.Map`. `markSeen(n)` advances; `readersOf(n)` lists peers who reached `n`.**                                                                                                                                                                                                                                                                                           |
| **`useThreadedMessages`** 🆕                                          | **`Y.Map<msgId, {parent, body, by, at, sig}>` with `post()` / `reply()` / pre-flattened `threads` for rendering.**                                                                                                                                                                                                                                                                                                           |
| **`useNetworkOnline`** 🆕                                             | **Honest online detector: `navigator.onLine` + a periodic 204 probe. Distinguishes "online" from "captive portal hostage".**                                                                                                                                                                                                                                                                                                 |
| **`useSharedCollection`** 🆕                                          | **Validated ordered CRDT collection with stable IDs, CRUD, and reordering. Use for app-owned shared lists without rebuilding Y.Array lifecycle code.**                                                                                                                                                                                                                                                                       |
| **`useSharedChecklist`** 🆕                                           | **Validated attributed shared checklist built on `useSharedCollection`: bounded plain-text tasks, deterministic item identity, and completion/reopen state.**                                                                                                                                                                                                                                                                |
| **`useRoomCapacity`** 🆕                                              | **Room-admission vocabulary over expiring deterministic CRDT leases: `join`, `leave`, admitted/waitlisted state, position, and remaining capacity.**                                                                                                                                                                                                                                                                         |
| **`useImageCapture`** 🆕                                              | **Explicit local still-image capture built on `useCamera`; returns a JPEG data URL or a Blob only after an armed camera frame is ready and never uploads it. Pair `captureBlob()` with an explicit, bounded sharing flow when needed.**                                                                                                                                                                                      |
| **`useFileDrop`** 🆕                                                  | **Accessible local drop/input state with MIME/extension, size, count, and custom validation. It does not upload or share selected files.**                                                                                                                                                                                                                                                                                   |
| **`usePermission`** 🆕                                                | **Permission-state observer plus an app-owned, gesture-bound request callback. Never prompts on mount or invents a browser grant.**                                                                                                                                                                                                                                                                                          |
| **`useFullscreen` / `usePageVisibility`** 🆕                          | **User-gesture fullscreen controls and local foreground/focus state for display and timer experiences.**                                                                                                                                                                                                                                                                                                                     |
| **`useInstallPrompt` / `useNotification`** 🆕                         | **Explicit PWA-install and browser-notification flows; neither prompts automatically.**                                                                                                                                                                                                                                                                                                                                      |
| **`useBeforeUnload`** 🆕                                              | **Small, opt-in protection for unsaved local work while leaving a page.**                                                                                                                                                                                                                                                                                                                                                    |
| **`useSpeechRecognition` / `useGamepad` / `usePointerLock`** 🆕       | **Explicit local input surfaces for voice, controller, and mouse-driven experiences; nothing is shared until an app chooses to publish it.**                                                                                                                                                                                                                                                                                 |
| **`useLocalGeolocation` / `useFileDownload`** 🆕                      | **Gesture-bound local position lookup and client-side text/JSON export with no implicit upload.**                                                                                                                                                                                                                                                                                                                            |
| **`useSharedRsvp` / `useSharedAgenda`** 🆕                            | **Peer-attributed attendance plus an ordered, selected shared agenda for browser-local events and facilitation.**                                                                                                                                                                                                                                                                                                            |
| **`useSharedScoreboard` / `useSharedPromptDeck`** 🆕                  | **Bounded peer scores and ordered selected prompts for lightweight games, practice, and group conversation.**                                                                                                                                                                                                                                                                                                                |
| **`useSharedResponses`** 🆕                                           | **One validated, bounded plain-text response per peer for walls, check-ins, and exit tickets.**                                                                                                                                                                                                                                                                                                                              |
| **`useSharedPoll` / `useSharedRoles`** 🆕                             | **One-choice-per-peer polling and first-claim role assignment for lightweight facilitated sessions.**                                                                                                                                                                                                                                                                                                                        |
| **`useSharedPairings` / `useSharedTurnOrder` / `useSharedHost`** 🆕   | **Replicated pairs, turn rotation, and host handoff for group activities.**                                                                                                                                                                                                                                                                                                                                                  |
| **`useSharedRatings` / `useSharedWordCloud` / `useSharedLottery`** 🆕 | **Shared feedback, words, and participant picks for facilitated sessions.**                                                                                                                                                                                                                                                                                                                                                  |
| **`useSharedMilestones` / `useSharedPlaylist`** 🆕                    | **Collaborative milestones and an ordered browser-local playlist.**                                                                                                                                                                                                                                                                                                                                                          |
| **`useSharedBudget` / `useSharedCardStack`** 🆕                       | **Peer-attributed budgets and shared flip cards without service-side storage.**                                                                                                                                                                                                                                                                                                                                              |
| **`useSharedNotes` / `useSharedRound` / `useSharedReactions`** 🆕     | **Attributed notes, replicated round state, and de-duplicated peer reactions for browser-local activities.**                                                                                                                                                                                                                                                                                                                 |
| **`useSharedStickyBoard` / `useSharedPixelGrid`** 🆕                  | **Bounded, peer-attributed sticky notes and a compact shared pixel canvas for creative boards, retros, and collaborative mosaics.**                                                                                                                                                                                                                                                                                          |
| **`useSharedWordRelay` / `useSharedCaptionContest`** 🆕               | **An ordered short-text relay plus one-caption-per-peer prompt contest with independent, de-duplicated votes.**                                                                                                                                                                                                                                                                                                              |
| **`useSharedBingoBoard`** 🆕                                          | **Configurable shared bingo squares while retaining each participant’s individual claims.**                                                                                                                                                                                                                                                                                                                                  |
| **`useSharedQueue`** 🆕                                               | **FIFO CRDT queue with expiring soft claims, acknowledgement, release, and deterministic oldest-available claiming.**                                                                                                                                                                                                                                                                                                        |
| **`useSharedTimer`** 🆕                                               | **Drift-free shared countdown/stopwatch: peers store lifecycle timestamps and derive display time from the mesh clock—no per-tick writes.**                                                                                                                                                                                                                                                                                  |
| **`useScheduledCue`** 🆕                                              | **One-shot, validated shared-clock cue with bounded lead time, cancellation, expiry, and lateness diagnostics. Use for rehearsal-scale light, sound, or capture cues; production installations may keep this API over a coordinator relay.**                                                                                                                                                                                 |
| **`useCrdtUndo`** 🆕                                                  | **Scoped local Yjs undo/redo wrapper with capture boundaries, stack state, and safe listener cleanup.**                                                                                                                                                                                                                                                                                                                      |
| **`useClipboard`** 🆕                                                 | **Clipboard read/write capability hook with a copy fallback, transient copied state, and explicit errors.**                                                                                                                                                                                                                                                                                                                  |
| **`MeshDialog` / `MeshConnectionStatus`** 🆕                          | **Public accessible centered dialog and a compact, live-announced room/network-health indicator built from the existing Radix and network primitives.**                                                                                                                                                                                                                                                                      |
| **`useSharedReservation` / `useTurnLock` / `useQuorum`** 🆕           | **Expiring capacity reservations, facilitator-safe soft locks, and roster-derived participant quorum checks.**                                                                                                                                                                                                                                                                                                               |
| **`usePeerCapabilities` / `MeshPermissionGate`** 🆕                   | **Ephemeral capability negotiation plus accessible, reusable permission-request and fallback UI.**                                                                                                                                                                                                                                                                                                                           |
| **`useConsensusAction` / `useCrdtSnapshot` / `useNetworkRetry`** 🆕   | **Small coordination, persistence, and retry helpers for shared workflows.**                                                                                                                                                                                                                                                                                                                                                 |
| **`MeshQrDialog` / `MeshLiveRegion`** 🆕                              | **Reusable QR-sharing modal and accessible real-time announcement surface.**                                                                                                                                                                                                                                                                                                                                                 |
| **`useSharedSet` / `useSharedCounter`** 🆕                            | **Validated de-duplicated CRDT membership and peer-attributed bounded counters.**                                                                                                                                                                                                                                                                                                                                            |
| **`useCrdtMigrations`** 🆕                                            | **Numbered, idempotent shared-document migrations with explicit schema version state.**                                                                                                                                                                                                                                                                                                                                      |
| **`useSharedSearchIndex` / `useSharedTagIndex`** 🆕                   | **Local derived search, tag aggregation, and filtering over replicated collections—no second CRDT copy.**                                                                                                                                                                                                                                                                                                                    |
| **`useRoomLifecycle` / `useIdleDetector`** 🆕                         | **Provider connection/retry state and local interaction-idle tracking without requesting the browser's sensitive Idle Detection permission.**                                                                                                                                                                                                                                                                                |
| **`useMediaSession` / `useHapticPattern` / `useOrientationLock`** 🆕  | **Safe media-control integration, user-preference haptic feedback, and capability-gated screen orientation management.**                                                                                                                                                                                                                                                                                                     |
| **`useOfflineQueue`** 🆕                                              | **Buffer writes when isolated; replay through `flush()` when reconnected. Persisted in `localStorage`. At-least-once — make `flush` idempotent via the caller-supplied id.**                                                                                                                                                                                                                                                 |
| **`useFileShare`** 🆕                                                 | **Chunked file share through the existing Yjs transport (5 MB cap; tune `chunkBytes`). Writes yield every eight chunks by default so mobile browsers stay responsive. Manifests preserve a per-app stable `deviceId` when available, alongside the ephemeral session author id; receiver gets `download(fileId)` and `blobOf(fileId)`.**                                                                                     |
| **`useVoiceActivity`** 🆕                                             | **VAD by RMS energy + zero-crossing rate. Pure Web Audio, ~100 lines, no ML payload. Returns `{ active, rms, zcr }`.**                                                                                                                                                                                                                                                                                                       |
| **`SafeMarkdown` / `renderMarkdownToSafeHtml`** 🆕                    | **Markdown rendering via `marked` (single file, 0 deps) + an allow-list sanitizer. No raw HTML pass-through; safe schemes only.**                                                                                                                                                                                                                                                                                            |
| **`useChangelogToast`** 🆕                                            | **One-shot "what's new in vX.Y" toast on the first session after a version bump. Per-peer state in `localStorage`.**                                                                                                                                                                                                                                                                                                         |
| **`CrdtInspector`** 🆕                                                | **Dev-only overlay (`?inspect=1`) showing every shared type, sizes, updates/sec, peer count, your peerId. Don't ship default-on.**                                                                                                                                                                                                                                                                                           |
| **`useFakeTime` / `time` / `setFakeTime` / `advanceFakeTime`** 🆕     | **Test fixture: in production every call collapses to `Date.now()`; in tests you freeze and step the clock. `clockSync` honors it transparently.**                                                                                                                                                                                                                                                                           |
| **`useFleetPersona` / `FleetAvatar` / `FleetIdentityPanel`** 🆕       | **Cross-app + cross-origin display identity. L0 (per-app local) > L1 (same-origin shared) > L2 (optional `https://fleet-persona.0exec.com`). Captures nickname + name + avatar; apps pick what to render. Service URL defaults to the canonical fleet endpoint — pass `serviceUrl={null}` to disable L2. Includes argon2id-gated write tokens, strict-ASCII allowlist, and QR-able handoff URLs for cross-origin transfer.** |
| **`useTone` / `createToneEngine`** 🆕                                 | **WebAudio cue engine — short oscillator tones with a gain envelope, one lazily-created `AudioContext`, and `resume()` on first gesture (the autoplay footgun every hand-rolled copy skipped). `play()` / `sequence()` / `beep()`. Shapes: `ToneSpec`, `ToneApi`, `ToneEngine`, `ToneEngineOptions`. Replaces the duplicated oscillator code in doorbell / metronome / firefly-walk / pair-rotation.**                       |
| **`useSharedStrokes`** 🆕                                             | **Collaborative freehand drawing over `Y.Array<Stroke>`. App owns the canvas + pointer handling; the hook owns replication, `add()` (commit on pointer-up), `clear()`, `undoLast(peerId?)`, and a `replay(ctx)` helper for the duplicated draw loop. Returns `SharedStrokesApi`. Used by pictionary / exquisite-corpse / brain-write / light-paint / retro.**                                                                |
| **`useHotkeys`** 🆕                                                   | **Normalized keyboard-shortcut binding: case- and modifier-order-independent combos (`"space"`, `"ctrl+enter"`, `"shift+?"`), skips form fields by default, reads the map live so object literals don't re-subscribe. Types: `HotkeyMap`, `HotkeyHandler`, `HotkeysOptions`.**                                                                                                                                               |
| `scaffold/create-mesh-app.sh`                                         | One-shot CLI that creates a new app from the template                                                                                                                                                                                                                                                                                                                                                                        |

Apps depend on this via `file:../mesh-common` (publish to npm later if/when useful — Vite bundles the package output into each app's `docs/` so live sites are self-contained).

## UX foundation for every mesh app

The shared app layer removes repeated connection, capability, mobile-layout,
form, and workflow code from individual services. Start new applications with
`MeshThemeProvider`, `MeshAppProvider`, and `MeshAppFrame`; the scaffold now
does this by default. `MeshThemeProvider` exposes `meshLightThemeTokens`,
`meshDarkThemeTokens`, `meshThemeVariables`, `useMeshTheme`, and
`useOptionalMeshTheme` for a controlled light, dark, or system palette.

- **Room and readiness:** `useRoomDiagnostics` turns connection state into
  `RoomDiagnostics` / `RoomDiagnosticStatus`, while `MeshRoomGate`,
  `MeshConnectionPanel`, `MeshCapabilityGate`, and `MeshReadinessPanel` give
  users a clear, keyboard-accessible route through offline, reconnecting,
  permission, and waiting states—including Safari-style gesture-only
  capability fallbacks. `MeshAppCapabilityState`,
  `MeshCapabilityDefinition`, `MeshCapabilitySnapshot`,
  `MeshCapabilityStatus`, and `MeshPeerReadiness` keep custom presentations
  headless and typed.
- **Shared chrome and feedback:** `MeshAppProvider`, `useMeshApp`,
  `useOptionalMeshApp`, `MeshAppFrame`, and `MeshToastController` centralize
  room/config/network context. `MeshAsyncAction` and `useMeshAsyncAction`
  protect against double submission and announce success or failures; use
  `MeshAsyncActionState` / `MeshAsyncActionStatus` when supplying custom UI.
  Existing `MeshShell` applications inherit the provider, semantic dark
  compatibility theme, and `MeshSessionProvider` automatically. When an app
  passes its `room` to the shell, Settings also gains progressive connection
  diagnostics and a contract-safe lifecycle marker. Apps that deliberately
  create a room deeper in their feature tree retain honest no-room shell
  state until they render `MeshShellConnectionBridge` with their own real
  room/lifecycle after its user gesture—no duplicate WebRTC room is created.
  `MeshShellConnectionBridgeProvider`, `useMeshShellConnectionBridge`, and
  `useOptionalMeshShellConnectionBridge` support declarative or event-driven
  status handoff. The shell uses `useNetworkOnline({ probeUrl: false })`, a passive
  browser online/offline signal that does not make a third-party probe request.
- **Responsive, accessible UI:** `MeshPage`, `MeshStack`, `MeshCluster`,
  `MeshGrid`, and `MeshBottomBar` provide responsive, safe-area-aware layout.
  `MeshForm`, `useMeshForm`, `useOptionalMeshForm`, `MeshField`,
  `MeshSelect`, `MeshTextArea`, and `MeshFormSubmit` provide labelled,
  validated forms. `MeshListbox` and `MeshCommandList` provide a searchable,
  roving-focus selection model via `MeshListboxOption`,
  `MeshListboxOptionState`, and `MeshCommand`.
- **Visual entry and hierarchy:** `MeshVisualProfileProvider` and
  `MeshVisualProfile` offer the five intentional profiles (`utility`, `play`,
  `studio`, `gather`, and `field`). `MeshAppBar`, `MeshBreadcrumbs`, `MeshLaunch`, `MeshSurface`,
  `MeshButton`, `MeshStatusPill`, and `MeshPresence` provide text-first,
  mobile-safe chrome, entry states, hierarchy, primary actions, and humane
  room presence. `humanizeMeshAppName()` gives legacy `mesh-*` identifiers a
  clean default product name without changing URLs, rooms, storage, or repos.
  Add an explicit `shellLayout` as part of an app visual migration:
  `"inset"` reserves a real top row for document-style and dashboard apps,
  while `"overlay"` is only for an app that has made its own safe space for
  compact controls. Omitting it preserves legacy chrome until that app has a
  deliberate first-viewport redesign.
  `breadcrumbs: false` is the deliberate default. When an app gains genuine
  locations, give its config a stable trail for modern shell chrome, or render
  `<MeshBreadcrumbs>` / pass `breadcrumbs` to `MeshAppFrame` for stateful
  feature navigation. Do not add a one-item or invented trail just to make an
  app look more complex.
  For a safe fleet baseline, run
  `node ../mesh-common/scripts/add-breadcrumbs-config.mjs --write .` from an
  app checkout; it parses the supported config shapes and makes exactly one
  insertion after `appName`. Use `--check` in a rollout gate once configured.
  `meshAccentText()` is also applied by `MeshThemeProvider` when an app
  overrides only its hex accent, preserving readable primary-action text.
- **Session and media workflows:** `MeshSessionProvider`, `useMeshSession`,
  `useMeshSessionContext`, `sharesKnownBrowserDevice`, `MeshRoster`,
  `useMeshRoster`, and `meshSessionLabel` make local-vs-other device state
  honest instead of guessing from browser tabs. `useMeshMediaFlow` exposes a
  consent → capture → review → share state machine through
  `MeshMediaFlowState` and `MeshMediaFlow`, so sensitive media work remains
  explicit, cancellable, and never opens a camera merely from persisted
  consent.
- **Shared flow primitives:** `MeshCountdown`, `MeshCueBanner`,
  `formatMeshDuration`, and `meshCueMessage` keep timed moments readable and
  in sync without announcing every visual tick. `defineSharedEntity` creates
  bounded, validated shared records
  with `SharedEntityAction`, `SharedEntityContext`, `SharedEntityDefinition`,
  `DefinedSharedEntity`, and `DefinedSharedEntityCollection` rather than
  duplicating CRDT guard code. `MeshOnboarding`, `useMeshOnboarding`, and
  `MESH_ONBOARDING_STEPS` make the first-use flow resumable and accessible.
- **Fleet quality gate:** `evaluateMeshUxContract`, `assertMeshUxContract`,
  `MeshUxContractError`, `MeshUxViolation`, `MeshUxViolationCode`, and
  `MeshAppLifecycleState` provide a deterministic DOM-level UX check for
  common app regressions before release.

All components accept typed `*Props` / options types (`MeshAppProviderProps`,
`MeshAppFrameProps`, `RoomDiagnosticsOptions`, `MeshRoomGateProps`,
`MeshConnectionPanelProps`, `MeshCapabilityGateProps`,
`MeshReadinessPanelProps`, `MeshRosterOptions`, `MeshRosterProps`,
`MeshSessionOptions`, `MeshSessionProviderProps`, `MeshMediaFlowOptions`,
`MeshCountdownProps`, `MeshCueBannerProps`, `MeshOnboardingProps`,
`UseMeshOnboardingOptions`, and `MeshUxContractOptions`) so apps can use
the shared behavior without adopting a fixed visual skin.

For fully custom compositions, the corresponding state and render contracts
are public too: `MeshAppContextValue`, `MeshAppFrameShellOptions`,
`MeshRoomGateRenderState`, `MeshRoomGateFallback`, `MeshRosterPeer`,
`MeshRosterPeerState`, `MeshRosterState`, `MeshSessionActivity`,
`MeshSessionIdentity`, `MeshOnboardingStep`,
`MeshOnboardingStepDefinition`, `MeshOnboardingController`, and
`MeshUxContractResult`, `MeshShellConnection`, and
`MeshShellConnectionBridgeValue`. UI contracts include `MeshThemeProviderProps`,
`MeshThemeContextValue`, `MeshThemeMode`, `MeshResolvedTheme`,
`MeshThemeTokens`, `UseMeshAsyncActionOptions`, `MeshAsyncActionProps`,
`MeshPageProps`, `MeshStackProps`, `MeshClusterProps`, `MeshGridProps`,
`MeshBottomBarProps`, `MeshFormProps`, `MeshFormState`, `MeshFormStatus`,
`MeshFormErrorValue`, `MeshFormErrors`, `MeshFormResult`, `MeshFieldProps`,
`MeshSelectOption`, `MeshSelectProps`, `MeshTextAreaProps`,
`MeshFormSubmitProps`, `MeshListboxProps`, and `MeshCommandListProps`.

## About details

`MeshShell` keeps the first viewport focused on the app itself. Source,
support, version, and commit stay available in **Settings** rather than being
permanently overlaid on the live product surface. `SelfRefBar` remains public
for a deliberately embedded or internal view, but is no longer mounted by the
default shell.

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

| Layer             | Tool                  | What it covers                                                                                                            | Cost per run |
| ----------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Unit / pure logic | Vitest                | `commitReveal`, `clockSync`, `combineSalts`, component renders with `createMockRoom`                                      | <1 s         |
| Smoke (e2e)       | Playwright + Chromium | Page loads, settings drawer opens, source/tip/version visible, no console errors                                          | ~3 s         |
| Multi-peer (e2e)  | Playwright            | Two pages in the same browser context sync via y-webrtc's BroadcastChannel fallback — **no signaling server, no network** | ~3 s         |

```bash
npm install
npm run test:unit                          # 200-700 ms, runs everywhere
npx playwright install chromium            # one-time, ~120 MB, cached globally
npm run test:e2e                           # ~15-25 s per app (the long leak test skips)
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

One bump fixes formatting and lint rules across every mesh-\* app.

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
- `tests/e2e/memory-leak.spec.ts` — two-peer 60 s noise loop, before/after heap deltas, fails over 15 MB growth. It stays installed but skips during `test:e2e`; `npm run test:leak` explicitly enables it and gets a duration-aware timeout.

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

### Fleet UX rollout checks

`MeshShell` is the compatibility boundary for existing applications, so a
fleet release rebuilds each app's committed Pages bundle against the current
local `mesh-common` checkout. Use the catalog-driven runner rather than a
directory glob: it includes every published card and uses deterministic
20-app batches.

```bash
# Read-only inventory for the first 20 catalog apps.
node scripts/fleet-ux-check.mjs --list

# Test one batch with bounded workers and collision-free Playwright ports.
node scripts/fleet-ux-check.mjs --batch 1 --run typecheck,unit,smoke,e2e --jobs 4

# Refresh the generic smoke/mesh suite, observable MeshShell contract, and
# generic performance + opt-in leak probes before a per-app release.
bash scripts/install-ux-foundation-probe.sh ../mesh-queue
```

The runner never clones, installs, edits, commits, or pushes by itself.
App-release automation must deliberately install the probes, run the checks,
review the generated `docs/` bundle, and merge each app's PR. The UX probe
checks real shell/theme/settings behavior and distinguishes a shell-owned room
from a feature-owned room so it does not reward a fabricated connection state.
The installer also refreshes generic Settings-dialog handling: an intentional
first-visit Settings sheet is closed only inside content/performance/leak
checks, while the Settings check itself validates the accessible dialog. It
then refreshes the package-derived generic URLs and safe enabled button
selection used by the performance/leak tests.

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

| Repo                                              | Endpoint                               | Purpose            |
| ------------------------------------------------- | -------------------------------------- | ------------------ |
| https://github.com/baditaflorin/signaling-server  | `wss://turn.0docker.com/ws`            | y-webrtc signaling |
| https://github.com/baditaflorin/turn-token-server | `https://turn.0docker.com/credentials` | HMAC TURN creds    |
| https://github.com/baditaflorin/coturn-hetzner    | `turn:turn.0docker.com:3479`           | TURN relay         |

## License

MIT.

## Security model — the four-layer stack

> One cryptographic foundation (layer 1), the moderator is the first feature it powers, and layers 2–4 stay opt-in and honest.

| Layer                     | Status                                             | What it gives you                                                              |    Bundle cost |
| ------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------ | -------------: |
| **1. Default everywhere** | Lives in `mesh-common` — every app inherits        | TOFU pubkey registry, Ed25519-signed sensitive writes, moderator role          |         ~35 KB |
| **2. Per-app opt-in**     | App imports a helper when needed                   | Commit-reveal RNG, E2E DMs (X25519 + AES-GCM via WebCrypto)                    | ~0 KB (native) |
| **3. Specialty only**     | Lazy-loaded for the one or two apps that need it   | Shamir secret-sharing for vault-style, SNARKs for anon-attestation             |   10 KB / 3 MB |
| **4. Never claim**        | Honesty contract in every README's privacy section | "End-to-end private" is not what we sell — peers in the room see the Yjs state |              — |

### Using layer 1 in an app

```tsx
import {
  useIdentity,
  useModerator,
  ModeratorBadge,
} from "@baditaflorin/mesh-common";

function Body({ room, config }) {
  const identity = useIdentity(config.storagePrefix);
  const moderator = useModerator(room, config.storagePrefix, identity);

  return (
    <>
      <ModeratorBadge state={moderator} resolveName={(id) => names.get(id)} />
      {moderator.isMe && (
        <button onClick={() => triggerRound()}>start round</button>
      )}
      {/* Sign any sensitive write so peers can verify provenance: */}
      <button
        onClick={() => {
          const payload = { vote: "yes", round: 3 };
          const sig = identity.sign(payload);
          ballots.set(room.peerId, {
            ...payload,
            sig,
            pubkey: identity.pubkey,
          });
        }}
      >
        vote
      </button>
    </>
  );
}
```

### What the moderator role can and cannot do

**Can**: lead UI ceremonies, authoritative-looking display, soft moderation (a flag peers running the standard client honor by default), tiebreaks on CRDT-merged contradictions.

**Cannot**: kick peers off the mesh, force-delete data, rate-limit, or prevent a hostile fork from ignoring the role. The role is a **coordination affordance, not an enforcement boundary** — the UI labels it "moderator (auto-clears in 30 min)" precisely to set that expectation.

### The honesty contract

Three things never to claim in any mesh-\* app's README:

1. **"End-to-end private"** — peers in the room see the Yjs state. We protect _integrity_ (signed who-said-what), not _secrecy_ (who-saw-what).
2. **"Admin enforces rules"** — peers can ignore moderator commands. Display, don't deny.
3. **"Data is deleted"** — CRDT history is monotone. Redaction marks bytes; the bytes still exist on every peer who synced.

Correct phrasing for every app's privacy section:

> Everything you publish to a room is visible to every peer in that room. Your local device's name, key, and choices stay local. Cryptographic signatures prove **who** wrote each entry; they do **not** prevent peers from reading or copying entries. The room URL is the access control — share it deliberately.
