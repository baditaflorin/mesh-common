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
