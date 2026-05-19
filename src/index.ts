export type { MeshConfig, MeshConfigInput } from "./MeshConfig";
export { createMeshConfig } from "./MeshConfig";

export type { IceServer, TurnCredential, IceStorage } from "./iceConfig";
export {
  DEFAULT_ICE_SERVERS,
  iceStorage,
  loadIceServers,
  saveIceServers,
  resetIceServers,
  loadSignalingUrl,
  saveSignalingUrl,
  loadTurnTokenUrl,
  saveTurnTokenUrl,
  maybeFetchTurnCredentials,
} from "./iceConfig";

export type { RoomSync } from "./yjsRoom";
export { createRoomSync } from "./yjsRoom";

export type { YRoom } from "./useYRoom";
export { useYRoom } from "./useYRoom";

export type { ClockSync } from "./clockSync";
export { createClockSync } from "./clockSync";

export type { Commitment, Reveal } from "./commitReveal";
export { randomSalt, sha256Hex, commit, verifyReveal, combineSalts } from "./commitReveal";

export { MeshShell } from "./MeshShell";
export { SelfRefBar } from "./SelfRefBar";
export { SettingsDrawer } from "./SettingsDrawer";
export { InviteShareButton } from "./InviteShareButton";
export { useInviteChain, type InviteEdge, type InviteChainState } from "./useInviteChain";
export {
  useMeshBeacon,
  fireBeacon,
  beaconOptedOut,
  setBeaconOptOut,
  type BeaconParams,
} from "./useMeshBeacon";
export { MeshBeacon } from "./MeshBeacon";

export { PersonalQR } from "./PersonalQR";
export { QRExchange } from "./QRExchange";
export {
  useQRScanner,
  makeScanPayload,
  parseScanPayload,
  type QRScannerHandle,
  type QRScanResult,
  type ParsedScan,
} from "./useQRScanner";
export {
  useDirectedEdges,
  shortestPath,
  longestSimplePath,
  type Edge,
} from "./useDirectedEdges";
export {
  useIncomingScanLink,
  type IncomingScan,
} from "./useIncomingScanLink";

// ---- Layer 1 security: identity + signed writes + TOFU + moderator ----
export {
  generateKeypair,
  loadOrCreateIdentity,
  resetIdentity,
  signPayload,
  verifyPayload,
  hashPayload,
  useIdentity,
  type Keypair,
  type Identity,
} from "./identity";
export {
  usePeerRegistry,
  peerIdFromPubkey,
  trustFingerprint,
  type PubkeyRecord,
  type PeerRegistry,
} from "./tofuRegistry";
export {
  useModerator,
  DEFAULT_MODERATOR_TTL_MS,
  type ModeratorClaim,
  type ModeratorState,
  type UseModeratorOptions,
} from "./moderator";
export { ModeratorBadge } from "./ModeratorBadge";

// ---- 10 primitives (extracted 2026-05-17) ----
export { useNamedPeer, type NamedPeer } from "./useNamedPeer";
export { useEventLog, type EventLog } from "./useEventLog";
export { useVotes, type VotesState } from "./useVotes";
export { usePhase, type PhaseState } from "./usePhase";
export {
  useCommitRevealHook,
  type CommitRevealState,
  type CommitRevealEntry,
  type CommitRevealStatus,
} from "./useCommitRevealHook";
export { useMeshSlot, type MeshSlot } from "./useMeshSlot";
export { useFairRng, type FairRng } from "./useFairRng";
export { useSharedLocation, type Fix, type SharedLocation } from "./useSharedLocation";
export { Leaderboard, type LeaderboardItem } from "./Leaderboard";
export { MeshToasts, pushToast, type Toast } from "./MeshToasts";

// ---- 10 more primitives (extracted 2026-05-17, batch 2) ----
export { usePerPeerValue, type PerPeerValue } from "./usePerPeerValue";
export { useDraft, type Draft } from "./useDraft";
export { useDeadline, type DeadlineState } from "./useDeadline";
export { useFlashOnChange } from "./useFlashOnChange";
export { useRoster, type RosterState } from "./useRoster";
export { useRotatingTurn, type RotatingTurn } from "./useRotatingTurn";
export { useExpiringClaim, type ExpiringClaim, type ClaimRecord } from "./useExpiringClaim";
export { useReactions, type ReactionsState } from "./useReactions";
export { useMicLevel, ArmGate, type MicLevel } from "./useMicLevel";
export { useConfetti, ConfettiLayer, type ConfettiBurst } from "./useConfetti";

// ---- 10 sensor + capability primitives (extracted 2026-05-17, batch 3) ----
export { useDeviceMotion, type MotionSample } from "./useDeviceMotion";
export { useShake, type ShakeState } from "./useShake";
export { useDeviceOrientation, type Orientation } from "./useDeviceOrientation";
export { useTilt, type TiltState } from "./useTilt";
export { useCompass, type CompassState } from "./useCompass";
export { useStepCount, type StepCountState } from "./useStepCount";
export { useCamera, type CameraState, type CameraFacing } from "./useCamera";
export { useFlashlight, type FlashlightState } from "./useFlashlight";
export { useVibration, type VibrationState } from "./useVibration";
export { useWakeLock, type WakeLockState } from "./useWakeLock";
export { useWebShare, type WebShareState, type ShareData } from "./useWebShare";
export { useGesture, type GestureState, type GestureKind } from "./useGesture";

// ---- 12 production-ready UI primitives (Radix + Sonner-backed) ----
export * from "./ui";

// ---- 10 security + 0-day proofing primitives ----
export * from "./security";

// ---- 10 multiplayer + levels-of-play primitives ----
export * from "./multiplayer";

// ---- ecosystem batch 3 (2026-05-19) ----
// MeshErrorBoundary: drop-in class component that scopes crashes to the
// Feature subtree with copy-diagnostics affordance for users.
export {
  MeshErrorBoundary,
  type MeshErrorBoundaryProps,
} from "./MeshErrorBoundary";

// useMeshLink: canonical encoder + parser for the #r=…&p=…&x=… deep-link
// fragment, replacing ad-hoc URL concat across the fleet.
export {
  useMeshLink,
  makeMeshLinkFragment,
  parseMeshLink,
  type MeshLinkApi,
  type MeshLinkPayload,
  type ParsedMeshLink,
} from "./useMeshLink";

// ---- consolidation primitives, batch 1 (2026-05-19) ----
// useAwareness: typed wrapper around y-protocols/awareness (presence,
// cursors, typing-indicators). Replaces per-app `provider.awareness.on(...)`
// ad-hoc copies.
export { useAwareness, type AwarenessApi } from "./useAwareness";

// PeerAvatar: deterministic inline SVG seeded by peerId — zero network,
// zero PII. Pairs with tofuRegistry: same peerId == same avatar across
// every screen.
export { PeerAvatar, type PeerAvatarProps, type AvatarVariant } from "./PeerAvatar";

// useMultiRoom: run several Yjs rooms in one tab (facilitator running
// mesh-buzzer + mesh-live-poll side-by-side, embeds, dashboards).
export {
  useMultiRoom,
  type MultiRoomApi,
  type MultiRoomEntry,
} from "./useMultiRoom";

// Feature contract: zod-typed Y.Map / Y.Array wrappers — peers on old
// clients writing junk get filtered at the edge.
export {
  useTypedMap,
  useTypedArray,
  defineFeatureContract,
  type TypedMap,
  type TypedArray,
  type ContractOptions,
} from "./featureContract";

// ---- consolidation primitives, batch 2 (2026-05-19) ----

// Presence layer built on useAwareness.
export {
  usePresenceCursors,
  type PresenceCursorsApi,
  type PresenceCursorsOptions,
  type CursorState,
} from "./usePresenceCursors";
export {
  useTypingIndicator,
  type TypingIndicatorState,
  type TypingIndicatorOptions,
} from "./useTypingIndicator";
export {
  useNetworkQuality,
  type NetworkQualityState,
  type NetworkQualityOptions,
} from "./useNetworkQuality";

// Messaging.
export {
  useReadReceipts,
  type ReadReceiptsApi,
  type ReadReceiptsOptions,
} from "./useReadReceipts";
export {
  useThreadedMessages,
  type ThreadedMessage,
  type ThreadedMessagesApi,
  type ThreadedMessagesOptions,
} from "./useThreadedMessages";

// Network + lifecycle.
export {
  useNetworkOnline,
  type NetworkOnlineState,
  type NetworkOnlineOptions,
} from "./useNetworkOnline";
export {
  useOfflineQueue,
  type OfflineQueueApi,
  type OfflineQueueOptions,
  type QueueItem,
} from "./useOfflineQueue";

// Media.
export {
  useFileShare,
  type FileShareApi,
  type FileShareOptions,
  type SharedFile,
  type FileManifest,
} from "./useFileShare";
export {
  useVoiceActivity,
  type VoiceActivityOptions,
  type VoiceActivityState,
} from "./useVoiceActivity";

// Rendering.
export {
  SafeMarkdown,
  renderMarkdownToSafeHtml,
  type SafeMarkdownProps,
} from "./SafeMarkdown";

// Lifecycle UX.
export {
  useChangelogToast,
  type ChangelogToastOptions,
} from "./useChangelogToast";

// Dev tooling.
export { CrdtInspector, type CrdtInspectorProps } from "./CrdtInspector";

// Test fixture (production-safe; in prod every call collapses to Date.now()).
export {
  now as time,
  setFakeTime,
  advanceFakeTime,
  resetFakeTime,
  isFakeTimeActive,
} from "./useFakeTime";

// ---- fleet identity (2026-05-19) ----
// fleetPersona: cross-app + cross-origin display identity primitive.
// L0 (per-app local) > L1 (same-origin shared) > L2 (optional Hetzner
// service). Captures both nickname + name; apps can prefer either.
export {
  type FleetPersona,
  type FleetSyncMode,
  type PersonaSource,
  type ResolvedPersona,
  type ServiceClientOptions,
  DEFAULT_PERSONA,
  DEFAULT_FLEET_PERSONA_SERVICE_URL,
  PERSONA_FIELD_RE,
  FleetPersonaStorageKeys,
  HANDOFF_HASH_KEY,
  isValidPersonaField,
  isValidAvatarSeed,
  isValidVariant,
  isPersonaEmpty,
  sanitizePersona,
  displayLabel,
  avatarSeedFor,
  readLocalPersona,
  writeLocalPersona,
  clearLocalPersona,
  readFleetLocalPersona,
  writeFleetLocalPersona,
  clearFleetLocalPersona,
  readMode,
  writeMode,
  ensureAnonId,
  ensureWriteToken,
  readAnonId,
  readWriteToken,
  clearRemoteCredentials,
  setRemoteCredentials,
  fetchRemotePersona,
  publishRemotePersona,
  deleteRemotePersona,
  resolvePersonaSync,
  buildHandoffUrl,
  consumeHandoffFromHash,
} from "./fleetPersona";
export { useFleetPersona, type FleetPersonaApi, type UseFleetPersonaOptions } from "./useFleetPersona";
export { FleetAvatar, type FleetAvatarProps } from "./FleetAvatar";
export { FleetIdentityPanel, type FleetIdentityPanelProps } from "./FleetIdentityPanel";
