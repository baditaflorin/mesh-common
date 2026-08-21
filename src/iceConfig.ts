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

export function loadSignalingUrl(s: IceStorage): string {
  const stored = localStorage.getItem(s.signalingKey) ?? "";
  if (stored && (!isValidSignalingUrl(stored) || DEAD_SIGNALING_SERVERS.includes(stored))) {
    localStorage.removeItem(s.signalingKey);
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
  const stored = localStorage.getItem(s.tokenUrlKey) ?? "";
  if (stored && !isValidTurnTokenUrl(stored)) {
    localStorage.removeItem(s.tokenUrlKey);
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

export async function maybeFetchTurnCredentials(s: IceStorage): Promise<void> {
  const tokenUrl = loadTurnTokenUrl(s);
  if (!tokenUrl) return;

  try {
    const res = await fetch(tokenUrl, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const cred = (await res.json()) as TurnCredential;
    if (!Array.isArray(cred.uris) || cred.uris.length === 0) {
      throw new Error("Token server returned no TURN URIs");
    }
    saveIceServers(s, [
      ...STUN_SERVERS,
      ...cred.uris.map((u) => ({ urls: u, username: cred.username, credential: cred.password })),
    ]);
  } catch (err) {
    console.warn("[turn] credential fetch failed — STUN-only fallback:", err);
  }
}
