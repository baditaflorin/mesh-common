import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type FleetPersona,
  type FleetSyncMode,
  type PersonaSource,
  type ResolvedPersona,
  DEFAULT_PERSONA,
  avatarSeedFor,
  buildHandoffUrl,
  clearFleetLocalPersona,
  clearLocalPersona,
  clearRemoteCredentials,
  consumeHandoffFromHash,
  deleteRemotePersona,
  displayLabel,
  ensureAnonId,
  ensureWriteToken,
  fetchRemotePersona,
  isPersonaEmpty,
  publishRemotePersona,
  readAnonId,
  readFleetLocalPersona,
  readLocalPersona,
  readMode,
  readWriteToken,
  resolvePersonaSync,
  sanitizePersona,
  setRemoteCredentials,
  writeFleetLocalPersona,
  writeLocalPersona,
  writeMode,
} from "./fleetPersona";

export type UseFleetPersonaOptions = {
  /** App name — namespaces the L0 persona + the mode setting. */
  appName: string;
  /** Optional cross-origin service URL; absence pins this app to L0+L1 only. */
  serviceUrl?: string;
  /** Default sync mode the first time this app loads. Default `local-fleet`. */
  defaultMode?: FleetSyncMode;
  /** Override the 2 s remote fetch timeout. */
  fetchTimeoutMs?: number;
  /** Inject a fetch impl for tests. */
  fetchImpl?: typeof fetch;
  /** Auto-consume `#fp=` on mount. Default true. */
  autoImportHandoff?: boolean;
};

export type FleetPersonaApi = {
  /** Currently displayed persona (L0 wins, then L1, then L2, then default). */
  persona: FleetPersona;
  /** Where the current persona came from. */
  source: PersonaSource;
  /** True while the L2 fetch is in-flight (only when mode === "remote-fleet"). */
  loading: boolean;
  /** Apps that want to show "Continue as X?" can read this. */
  suggestion: ResolvedPersona | null;
  /** Convenience: nickname || name. */
  label: string;
  /** Convenience: avatarSeed || nickname || name || "anon". */
  avatarSeed: string;
  /** Write the persona at L0; propagates to L1/L2 according to current mode. */
  setPersona: (next: Partial<FleetPersona>) => void;
  /** Convenience: change just the nickname. */
  setNickname: (s: string) => void;
  /** Convenience: change just the formal name. */
  setName: (s: string) => void;
  /** Convenience: change avatar look. */
  setAvatar: (changes: { seed?: string; variant?: "beam" | "grid"; paletteIndex?: number }) => void;
  /** Wipe L0 for this app. L1 and L2 are untouched. */
  forgetLocal: () => void;
  /** Wipe L0 + L1 + remote (if mode === remote-fleet). */
  forgetEverywhere: () => Promise<void>;
  /** Per-app sync mode. */
  mode: FleetSyncMode;
  setMode: (m: FleetSyncMode) => void;
  /** Cross-origin handoff helpers. */
  buildHandoffUrl: (targetOrigin: string) => string;
  /** Manual re-import (returns true if a handoff fragment was consumed). */
  importHandoff: () => boolean;
  /** True iff the app currently has L2 credentials (anonId + writeToken). */
  hasRemoteCredentials: boolean;
};

/**
 * Per-tab, per-app fleet-identity hook. Cheap, reactive across same-tab
 * writes via a small in-module event bus + the `storage` event from other
 * tabs in the same origin.
 */
export function useFleetPersona(opts: UseFleetPersonaOptions): FleetPersonaApi {
  const {
    appName,
    serviceUrl,
    defaultMode = "local-fleet",
    fetchTimeoutMs,
    fetchImpl,
    autoImportHandoff = true,
  } = opts;

  const [tick, bump] = useReducerTick();

  // Capture a handoff *before* we resolve the initial value (so the imported
  // anonId / persona are visible immediately).
  const didImportRef = useRef(false);
  if (autoImportHandoff && !didImportRef.current && typeof window !== "undefined") {
    didImportRef.current = true;
    const imported = consumeHandoffFromHash();
    if (imported) {
      setRemoteCredentials(imported.anonId, imported.writeToken);
      if (!isPersonaEmpty(imported.persona)) {
        // Carry the persona at L1 so all same-origin apps benefit too.
        writeFleetLocalPersona(imported.persona);
      }
    }
  }

  const mode = readMode(appName, defaultMode);

  const resolved = resolvePersonaSync(appName, mode);
  const [remote, setRemote] = useState<FleetPersona | null>(null);
  const [loading, setLoading] = useState(false);

  // Subscribe to cross-tab + same-tab updates.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      if (e.key.startsWith("mesh-fleet:v1:")) bump();
    };
    window.addEventListener("storage", onStorage);
    const unsub = subscribe(bump);
    return () => {
      window.removeEventListener("storage", onStorage);
      unsub();
    };
  }, [bump]);

  // L2 fetch — only when we're in remote-fleet mode AND we have nothing local
  // to display. Designed so the UI never waits on the network.
  useEffect(() => {
    if (!serviceUrl) return;
    if (mode !== "remote-fleet") return;
    // Don't auto-create remote credentials just to read — only fetch when
    // this browser has already published once (or imported via handoff).
    const anonId = readAnonId();
    if (!anonId) return;
    // Don't override a meaningful L0 with a remote value — that would be
    // surprising and the user already chose locally.
    if (resolved.source === "local") return;
    let cancelled = false;
    setLoading(true);
    fetchRemotePersona({ serviceUrl, fetchTimeoutMs, fetchImpl }, anonId)
      .then((p) => {
        if (cancelled) return;
        setRemote(p && !isPersonaEmpty(p) ? p : null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // tick is intentional — re-run after local writes propagate.
  }, [serviceUrl, mode, resolved.source, fetchTimeoutMs, fetchImpl, tick]);

  // Final resolution: prefer the synchronous L0/L1; fall back to L2.
  const persona = resolved.source === "default" && remote ? remote : resolved.persona;
  const source: PersonaSource = resolved.source === "default" && remote ? "fleet-remote" : resolved.source;

  // Suggestion = the best non-L0 candidate (for the "Continue as X?" affordance).
  const suggestion: ResolvedPersona | null = useMemo(() => {
    if (resolved.source !== "default") {
      // L0 is taking over; the suggestion is the broader fleet value, if any.
      const l1 = readFleetLocalPersona();
      if (l1 && !isPersonaEmpty(l1)) return { persona: l1, source: "fleet-local" };
      if (remote) return { persona: remote, source: "fleet-remote" };
      return null;
    }
    if (remote) return { persona: remote, source: "fleet-remote" };
    const l1 = readFleetLocalPersona();
    if (l1 && !isPersonaEmpty(l1)) return { persona: l1, source: "fleet-local" };
    return null;
  }, [resolved.source, resolved.persona, remote]);

  // ----- writes -----------------------------------------------------------

  const writeAll = useCallback(
    (next: FleetPersona) => {
      const clean = sanitizePersona(next);
      writeLocalPersona(appName, clean);
      const m = readMode(appName, defaultMode);
      if (m === "local-fleet" || m === "remote-fleet") {
        writeFleetLocalPersona(clean);
      }
      if (m === "remote-fleet" && serviceUrl) {
        // Fire-and-forget. No await, no toast on failure.
        const anonId = ensureAnonId();
        const token = ensureWriteToken();
        void publishRemotePersona({ serviceUrl, fetchTimeoutMs, fetchImpl }, anonId, token, clean);
      }
      announce();
    },
    [appName, defaultMode, serviceUrl, fetchTimeoutMs, fetchImpl],
  );

  const setPersona = useCallback(
    (next: Partial<FleetPersona>) => {
      const base = readLocalPersona(appName) ?? readFleetLocalPersona() ?? { ...DEFAULT_PERSONA };
      writeAll({ ...base, ...next });
    },
    [appName, writeAll],
  );

  const setNickname = useCallback((s: string) => setPersona({ nickname: s }), [setPersona]);
  const setName = useCallback((s: string) => setPersona({ name: s }), [setPersona]);
  const setAvatar = useCallback(
    (changes: { seed?: string; variant?: "beam" | "grid"; paletteIndex?: number }) => {
      const patch: Partial<FleetPersona> = {};
      if (changes.seed !== undefined) patch.avatarSeed = changes.seed;
      if (changes.variant !== undefined) patch.avatarVariant = changes.variant;
      if (changes.paletteIndex !== undefined) patch.paletteIndex = changes.paletteIndex;
      setPersona(patch);
    },
    [setPersona],
  );

  const forgetLocal = useCallback(() => {
    clearLocalPersona(appName);
    announce();
  }, [appName]);

  const forgetEverywhere = useCallback(async () => {
    clearLocalPersona(appName);
    if (serviceUrl) {
      const anonId = readAnonId();
      const token = readWriteToken();
      if (anonId && token) {
        await deleteRemotePersona({ serviceUrl, fetchTimeoutMs, fetchImpl }, anonId, token);
      }
    }
    clearRemoteCredentials();
    // Wipe L1 last so the user is not left with a stale fleet suggestion.
    clearFleetLocalPersona();
    announce();
  }, [appName, serviceUrl, fetchTimeoutMs, fetchImpl]);

  const setModeMemo = useCallback(
    (m: FleetSyncMode) => {
      writeMode(appName, m);
      announce();
    },
    [appName],
  );

  const buildHandoffUrlMemo = useCallback(
    (targetOrigin: string) => {
      const anonId = ensureAnonId();
      const token = ensureWriteToken();
      return buildHandoffUrl(targetOrigin, anonId, token, persona);
    },
    [persona],
  );

  const importHandoff = useCallback(() => {
    const imported = consumeHandoffFromHash();
    if (!imported) return false;
    setRemoteCredentials(imported.anonId, imported.writeToken);
    if (!isPersonaEmpty(imported.persona)) writeFleetLocalPersona(imported.persona);
    announce();
    return true;
  }, []);

  const hasRemoteCredentials = !!(readAnonId() && readWriteToken());

  return {
    persona,
    source,
    loading,
    suggestion,
    label: displayLabel(persona),
    avatarSeed: avatarSeedFor(persona),
    setPersona,
    setNickname,
    setName,
    setAvatar,
    forgetLocal,
    forgetEverywhere,
    mode,
    setMode: setModeMemo,
    buildHandoffUrl: buildHandoffUrlMemo,
    importHandoff,
    hasRemoteCredentials,
  };
}

// ---------------------------------------------------------------------------
// Tiny in-module pub/sub so writes from one component update other consumers
// in the same tab. Cross-tab updates come from the `storage` event handler.
// ---------------------------------------------------------------------------

const subscribers = new Set<() => void>();

function subscribe(fn: () => void): () => void {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

function announce(): void {
  for (const fn of subscribers) {
    try {
      fn();
    } catch {
      /* ignore */
    }
  }
}

function useReducerTick(): [number, () => void] {
  const [n, setN] = useState(0);
  const bump = useCallback(() => setN((v) => v + 1), []);
  return [n, bump];
}
