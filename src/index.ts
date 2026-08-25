export type {
  MeshConfig,
  MeshConfigInput,
  MeshShellLayout,
  MeshVisualProfileName,
} from "./MeshConfig";
export {
  createMeshConfig,
  humanizeMeshAppName,
  meshAccentText,
} from "./MeshConfig";

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
  isValidSignalingUrl,
  isValidTurnTokenUrl,
  maybeFetchTurnCredentials,
} from "./iceConfig";

export type { RoomSync } from "./yjsRoom";
export { createRoomSync } from "./yjsRoom";

export { ensureDeviceId } from "./deviceId";

export type { YRoom } from "./useYRoom";
export { useYRoom } from "./useYRoom";

export type { ClockSync } from "./clockSync";
export { createClockSync } from "./clockSync";

export type { Commitment, Reveal } from "./commitReveal";
export {
  randomSalt,
  sha256Hex,
  commit,
  verifyReveal,
  combineSalts,
} from "./commitReveal";

export { MeshShell } from "./MeshShell";
export { SelfRefBar } from "./SelfRefBar";
export { SettingsDrawer } from "./SettingsDrawer";
export {
  MeshPermissionGate,
  type MeshPermissionGateProps,
} from "./MeshPermissionGate";
export { MeshQrDialog } from "./MeshQrDialog";
export { MeshLiveRegion } from "./MeshLiveRegion";
export {
  MeshConnectionStatus,
  type MeshConnectionStatusProps,
} from "./MeshConnectionStatus";
export {
  MeshAppProvider,
  useMeshApp,
  useOptionalMeshApp,
  type MeshToastController,
  type MeshAppCapabilityState,
  type MeshAppContextValue,
  type MeshAppProviderProps,
} from "./MeshAppProvider";
export {
  MeshShellConnectionBridgeProvider,
  MeshShellConnectionBridge,
  useMeshShellConnectionBridge,
  useOptionalMeshShellConnectionBridge,
  type MeshShellConnection,
  type MeshShellConnectionBridgeValue,
  type MeshShellConnectionBridgeProviderProps,
  type MeshShellConnectionBridgeProps,
} from "./MeshShellConnectionBridge";
export {
  MeshAppFrame,
  type MeshAppFrameProps,
  type MeshAppFrameShellOptions,
} from "./MeshAppFrame";
export {
  useRoomDiagnostics,
  type RoomDiagnosticStatus,
  type RoomDiagnostics,
  type RoomDiagnosticsOptions,
} from "./useRoomDiagnostics";
export {
  MeshRoomGate,
  type MeshRoomGateProps,
  type MeshRoomGateRenderState,
  type MeshRoomGateFallback,
} from "./MeshRoomGate";
export {
  MeshConnectionPanel,
  type MeshConnectionPanelProps,
} from "./MeshConnectionPanel";
export {
  MeshCapabilityGate,
  type MeshCapabilityStatus,
  type MeshCapabilitySnapshot,
  type MeshCapabilityDefinition,
  type MeshCapabilityGateProps,
} from "./MeshCapabilityGate";
export {
  MeshReadinessPanel,
  type MeshPeerReadiness,
  type MeshReadinessPanelProps,
} from "./MeshReadinessPanel";
export {
  MeshRoster,
  useMeshRoster,
  meshSessionLabel,
  type MeshRosterPeerState,
  type MeshRosterPeer,
  type MeshRosterState,
  type MeshRosterOptions,
  type MeshRosterProps,
} from "./MeshRoster";
export {
  MeshSessionProvider,
  useMeshSession,
  useMeshSessionContext,
  sharesKnownBrowserDevice,
  type MeshSessionActivity,
  type MeshSessionIdentity,
  type MeshSessionOptions,
  type MeshSessionProviderProps,
} from "./meshSession";
export {
  useMeshMediaFlow,
  type MeshMediaFlowState,
  type MeshMediaFlowOptions,
  type MeshMediaFlow,
} from "./useMeshMediaFlow";
export {
  MeshCountdown,
  MeshCueBanner,
  formatMeshDuration,
  meshCueMessage,
  type MeshCountdownProps,
  type MeshCueBannerProps,
} from "./MeshCountdown";
export {
  defineSharedEntity,
  type SharedEntityAction,
  type SharedEntityContext,
  type SharedEntityDefinition,
  type DefinedSharedEntityCollection,
  type DefinedSharedEntity,
} from "./defineSharedEntity";
export {
  MeshOnboarding,
  useMeshOnboarding,
  MESH_ONBOARDING_STEPS,
  type MeshOnboardingStep,
  type MeshOnboardingStepDefinition,
  type MeshOnboardingController,
  type UseMeshOnboardingOptions,
  type MeshOnboardingProps,
} from "./MeshOnboarding";
export {
  evaluateMeshUxContract,
  assertMeshUxContract,
  MeshUxContractError,
  type MeshAppLifecycleState,
  type MeshUxViolationCode,
  type MeshUxViolation,
  type MeshUxContractOptions,
  type MeshUxContractResult,
} from "./fleetUxContract";
export { InviteShareButton } from "./InviteShareButton";
export {
  useInviteChain,
  type InviteEdge,
  type InviteChainState,
} from "./useInviteChain";
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
export { useIncomingScanLink, type IncomingScan } from "./useIncomingScanLink";

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
export {
  useSharedLocation,
  type Fix,
  type SharedLocation,
} from "./useSharedLocation";
export { Leaderboard, type LeaderboardItem } from "./Leaderboard";
export { MeshToasts, pushToast, type Toast } from "./MeshToasts";

// ---- 10 more primitives (extracted 2026-05-17, batch 2) ----
export { usePerPeerValue, type PerPeerValue } from "./usePerPeerValue";
export { useDraft, type Draft } from "./useDraft";
export { useDeadline, type DeadlineState } from "./useDeadline";
export { useFlashOnChange } from "./useFlashOnChange";
export { useRoster, type RosterState } from "./useRoster";
export { useRotatingTurn, type RotatingTurn } from "./useRotatingTurn";
export {
  useExpiringClaim,
  type ExpiringClaim,
  type ClaimRecord,
} from "./useExpiringClaim";
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
export {
  PeerAvatar,
  type PeerAvatarProps,
  type AvatarVariant,
} from "./PeerAvatar";

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
export {
  useFleetPersona,
  type FleetPersonaApi,
  type UseFleetPersonaOptions,
} from "./useFleetPersona";
export { FleetAvatar, type FleetAvatarProps } from "./FleetAvatar";
export {
  FleetIdentityPanel,
  type FleetIdentityPanelProps,
} from "./FleetIdentityPanel";

// ---- consolidation primitives, batch 3 (2026-05-31) ----

// useTone: WebAudio cue engine. Replaces the hand-rolled oscillator + gain
// envelope in mesh-doorbell / mesh-metronome / mesh-firefly-walk / etc., and
// handles the autoplay-resume footgun those copies all skipped.
export {
  useTone,
  createToneEngine,
  type ToneSpec,
  type ToneApi,
  type ToneEngine,
  type ToneEngineOptions,
} from "./useTone";

// useSharedStrokes: collaborative freehand drawing over Y.Array<Stroke>, with
// a replay() helper for the duplicated canvas draw loop. Used by pictionary,
// exquisite-corpse, brain-write, light-paint, retro.
export {
  useSharedStrokes,
  type Stroke,
  type SharedStrokesApi,
} from "./useSharedStrokes";

// useHotkeys: normalized keyboard-shortcut binding (modifier-order
// independent, skips form fields). Replaces ad-hoc keydown listeners.
export {
  useHotkeys,
  type HotkeyMap,
  type HotkeyHandler,
  type HotkeysOptions,
} from "./useHotkeys";

export {
  useSharedReservation,
  type SharedReservation,
} from "./useSharedReservation";
export { useTurnLock } from "./useTurnLock";
export { useQuorum, type QuorumState } from "./useQuorum";
export {
  usePeerCapabilities,
  type PeerCapabilities,
} from "./usePeerCapabilities";
export { useConsensusAction } from "./useConsensusAction";
export { useCrdtSnapshot } from "./useCrdtSnapshot";
export { useNetworkRetry } from "./useNetworkRetry";
export {
  useSharedSet,
  type SharedSet,
  type SharedSetOptions,
} from "./useSharedSet";
export {
  useSharedCounter,
  type SharedCounter,
  type SharedCounterOptions,
} from "./useSharedCounter";
export {
  useCrdtMigrations,
  type CrdtMigration,
  type CrdtMigrations,
} from "./useCrdtMigrations";
export {
  useSharedSearchIndex,
  type SharedSearchIndex,
  type SharedSearchIndexOptions,
} from "./useSharedSearchIndex";
export {
  useSharedTagIndex,
  type SharedTagIndex,
  type SharedTagIndexOptions,
} from "./useSharedTagIndex";
export {
  useRoomLifecycle,
  type RoomLifecycle,
  type RoomLifecycleStatus,
} from "./useRoomLifecycle";
export {
  useMediaSession,
  type MediaSessionApi,
  type MediaSessionHandlers,
} from "./useMediaSession";
export {
  useHapticPattern,
  type HapticPattern,
  type HapticPatternApi,
} from "./useHapticPattern";
export {
  useOrientationLock,
  type OrientationLockApi,
  type OrientationLockTarget,
} from "./useOrientationLock";
export {
  useIdleDetector,
  type IdleDetectorOptions,
  type IdleDetectorState,
} from "./useIdleDetector";
export {
  useAvailabilityGrid,
  type AvailabilityGrid,
} from "./useAvailabilityGrid";
export {
  useRankedBallot,
  type RankedBallot,
  type RankedBallotResult,
} from "./useRankedBallot";
export { useSharedForm, type SharedForm } from "./useSharedForm";
export { useMediaRecorder, type MediaRecorderState } from "./useMediaRecorder";
export { useScreenShare, type ScreenShareState } from "./useScreenShare";

// ---- eighth primitive wave: group coordination + local capture (2026-08) ----
export {
  useSharedChecklist,
  type SharedChecklist,
  type SharedChecklistItem,
  type SharedChecklistOptions,
} from "./useSharedChecklist";
export {
  useRoomCapacity,
  type RoomCapacity,
  type RoomCapacityMember,
  type RoomCapacityOptions,
} from "./useRoomCapacity";
export {
  useImageCapture,
  type CapturedImage,
  type CapturedImageBlob,
  type ImageCaptureOptions,
  type ImageCaptureState,
} from "./useImageCapture";
export {
  useFileDrop,
  type FileDrop,
  type FileDropOptions,
  type FileDropRejectReason,
  type FileDropResult,
  type RejectedFile,
} from "./useFileDrop";
export {
  usePermission,
  type MeshPermissionState,
  type PermissionApi,
  type PermissionRequest,
} from "./usePermission";

// ---- ninth primitive wave: local browser lifecycle (2026-08) ----
export { useFullscreen, type FullscreenApi } from "./useFullscreen";
export { usePageVisibility, type PageVisibility } from "./usePageVisibility";
export { useInstallPrompt, type InstallPromptApi } from "./useInstallPrompt";
export { useNotification, type NotificationApi } from "./useNotification";
export { useBeforeUnload } from "./useBeforeUnload";
export { useFileDownload, type FileDownloadApi } from "./useFileDownload";
export { usePointerLock, type PointerLockApi } from "./usePointerLock";
export {
  useSpeechRecognition,
  type SpeechRecognitionApi,
} from "./useSpeechRecognition";
export { useGamepad, type GamepadState } from "./useGamepad";
export {
  useLocalGeolocation,
  type LocalGeolocation,
} from "./useLocalGeolocation";
export {
  useSharedRsvp,
  useSharedAgenda,
  useSharedScoreboard,
  useSharedPromptDeck,
  useSharedResponses,
  type RsvpStatus,
  type SharedRsvpEntry,
  type SharedAgendaItem,
  type SharedPrompt,
  type SharedResponse,
} from "./useSharedCollaboration";
export {
  useSharedPoll,
  useSharedRoles,
  useSharedNotes,
  useSharedRound,
  useSharedReactions,
  type SharedPollOption,
  type SharedRoleClaim,
  type SharedNote,
  type SharedRound,
  type SharedReaction,
} from "./useSharedSessions";
export {
  useSharedPairings,
  useSharedTurnOrder,
  useSharedBudget,
  useSharedCardStack,
  useSharedHost,
  type SharedPairing,
  type SharedCard,
  type SharedHost,
} from "./useSharedActivities";
export {
  useSharedRatings,
  useSharedWordCloud,
  useSharedLottery,
  useSharedMilestones,
  useSharedPlaylist,
  type LotteryEntry,
  type SharedMilestone,
  type PlaylistEntry,
} from "./useSharedFacilitation";
export { useSharedBookmarks, type SharedBookmark } from "./useSharedBookmarks";
export { useSharedMessages, type SharedMessage } from "./useSharedMessages";
export {
  useSharedCountdowns,
  type SharedCountdown,
} from "./useSharedCountdowns";
export { useSharedInvites, type SharedInvite } from "./useSharedInvites";
export { useSharedChoices, type SharedChoice } from "./useSharedChoices";

// ---- sixteenth primitive wave: shared creative play (2026-08) ----
export {
  useSharedStickyBoard,
  type SharedStickyNote,
} from "./useSharedStickyBoard";
export {
  useSharedWordRelay,
  type SharedWordRelayEntry,
} from "./useSharedWordRelay";
export { useSharedPixelGrid, type SharedPixel } from "./useSharedPixelGrid";
export {
  useSharedCaptionContest,
  type SharedCaption,
} from "./useSharedCaptionContest";
export {
  useSharedBingoBoard,
  type SharedBingoCell,
} from "./useSharedBingoBoard";

// ---- first-wave collection, coordination, and browser primitives (2026-08) ----
export {
  useSharedCollection,
  type SharedCollection,
  type SharedCollectionItem,
  type SharedCollectionOptions,
} from "./useSharedCollection";
export {
  useSharedQueue,
  type SharedQueue,
  type SharedQueueEntry,
  type SharedQueueOptions,
} from "./useSharedQueue";
export {
  useSharedTimer,
  type SharedTimer,
  type SharedTimerOptions,
  type SharedTimerStatus,
} from "./useSharedTimer";
export {
  useScheduledCue,
  type ScheduledCue,
  type ScheduledCueController,
  type ScheduledCueOptions,
  type ScheduledCueState,
} from "./useScheduledCue";
export {
  useCrdtUndo,
  type CrdtUndoApi,
  type CrdtUndoOptions,
  type CrdtUndoScope,
} from "./useCrdtUndo";
export {
  useClipboard,
  type ClipboardApi,
  type ClipboardOptions,
} from "./useClipboard";
