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
