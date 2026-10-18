/**
 * Signaling + ICE (STUN/TURN) configuration with localStorage overrides.
 * Pattern proven across the existing baditaflorin/mesh-* apps.
 *
 * Storage keys are scoped by `storagePrefix` so two apps on the same origin
 * don't share creds. The dead-server list prunes wss://signaling.yjs.dev
 * which Heroku DNS no longer resolves.
 */

export type IceServer = {
  urls: string;
  username?: string;
  credential?: string;
};

export type TurnCredential = {
  username: string;
  password: string;
  ttl: number;
  uris: string[];
};

const STUN_SERVERS: IceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export const DEFAULT_ICE_SERVERS: IceServer[] = [...STUN_SERVERS];

const DEAD_SIGNALING_SERVERS = ["wss://signaling.yjs.dev", "ws://signaling.yjs.dev"];

function hasProtocol(value: string, protocols: readonly string[]): boolean {
  try {
    const parsed = new URL(value);
    return (
      protocols.includes(parsed.protocol) &&
      Boolean(parsed.hostname) &&
      !parsed.username &&
      !parsed.password
    );
  } catch {
    return false;
  }
}

/** A signaling endpoint must be an absolute WebSocket URL. */
export function isValidSignalingUrl(value: string): boolean {
  return hasProtocol(value.trim(), ["ws:", "wss:"]);
}

/** TURN credential issuers are fetched over HTTP(S), including local development. */
export function isValidTurnTokenUrl(value: string): boolean {
  return hasProtocol(value.trim(), ["http:", "https:"]);
}

export type IceStorage = {
  iceKey: string;
  signalingKey: string;
  tokenUrlKey: string;
  defaultSignaling: string;
  defaultTokenUrl: string;
};

export function iceStorage(storagePrefix: string, defaults: { signalingUrl: string; turnTokenUrl: string }): IceStorage {
  return {
    iceKey: `${storagePrefix}:iceServers`,
    signalingKey: `${storagePrefix}:signalingUrl`,
    tokenUrlKey: `${storagePrefix}:turnTokenUrl`,
    defaultSignaling: defaults.signalingUrl,
    defaultTokenUrl: defaults.turnTokenUrl,
  };
}

export function loadIceServers(s: IceStorage): IceServer[] {
  try {
    const raw = localStorage.getItem(s.iceKey);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as IceServer[];
    }
  } catch {
    // fall through to defaults
  }
  return DEFAULT_ICE_SERVERS;
}

export function saveIceServers(s: IceStorage, servers: IceServer[]): void {
  localStorage.setItem(s.iceKey, JSON.stringify(servers));
}

export function resetIceServers(s: IceStorage): void {
  localStorage.removeItem(s.iceKey);
}

/** localStorage read that never throws (blocked storage, sandboxed iframes). */
function readStored(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function removeStored(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // storage unavailable: nothing to clean up
  }
}

export function loadSignalingUrl(s: IceStorage): string {
  const stored = readStored(s.signalingKey);
  if (stored && (!isValidSignalingUrl(stored) || DEAD_SIGNALING_SERVERS.includes(stored))) {
    removeStored(s.signalingKey);
    return s.defaultSignaling;
  }
  return stored || s.defaultSignaling;
}

/** Saves a valid endpoint and returns false without changing storage for invalid input. */
export function saveSignalingUrl(s: IceStorage, url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) {
    localStorage.removeItem(s.signalingKey);
    return true;
  }
  if (!isValidSignalingUrl(trimmed)) return false;
  localStorage.setItem(s.signalingKey, trimmed);
  return true;
}

export function loadTurnTokenUrl(s: IceStorage): string {
  const stored = readStored(s.tokenUrlKey);
  if (stored && !isValidTurnTokenUrl(stored)) {
    removeStored(s.tokenUrlKey);
    return s.defaultTokenUrl;
  }
  return stored || s.defaultTokenUrl;
}

/** Saves a valid credential issuer and returns false without changing storage for invalid input. */
export function saveTurnTokenUrl(s: IceStorage, url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) {
    localStorage.removeItem(s.tokenUrlKey);
    return true;
  }
  if (!isValidTurnTokenUrl(trimmed)) return false;
  localStorage.setItem(s.tokenUrlKey, trimmed);
  return true;
}

/**
 * Rooms are created only after this resolves, so a token server that never
 * answers must not hold the room back: give up and fall back to STUN.
 */
const TURN_FETCH_TIMEOUT_MS = 3000;

export async function maybeFetchTurnCredentials(s: IceStorage): Promise<void> {
  const tokenUrl = loadTurnTokenUrl(s);
  if (!tokenUrl) return;

  const abort = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      abort.abort();
      reject(new Error(`timed out after ${TURN_FETCH_TIMEOUT_MS} ms`));
    }, TURN_FETCH_TIMEOUT_MS);
  });

  try {
    // Race as well as abort: a fetch implementation that ignores the signal
    // (or a body that never finishes) still cannot block the room.
    const res = await Promise.race([fetch(tokenUrl, { cache: "no-store", signal: abort.signal }), timeout]);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const cred = (await Promise.race([res.json(), timeout])) as TurnCredential;
    if (!Array.isArray(cred.uris) || cred.uris.length === 0) {
      throw new Error("Token server returned no TURN URIs");
    }
    saveIceServers(s, [
      ...STUN_SERVERS,
      ...cred.uris.map((u) => ({ urls: u, username: cred.username, credential: cred.password })),
    ]);
  } catch (err) {
    console.warn("[turn] credential fetch failed — STUN-only fallback:", err);
  } finally {
    clearTimeout(timer);
  }
}
