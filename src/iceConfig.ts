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
  if (stored && DEAD_SIGNALING_SERVERS.includes(stored)) {
    localStorage.removeItem(s.signalingKey);
    return s.defaultSignaling;
  }
  return stored || s.defaultSignaling;
}

export function saveSignalingUrl(s: IceStorage, url: string): void {
  const trimmed = url.trim();
  if (trimmed) localStorage.setItem(s.signalingKey, trimmed);
  else localStorage.removeItem(s.signalingKey);
}

export function loadTurnTokenUrl(s: IceStorage): string {
  return localStorage.getItem(s.tokenUrlKey) ?? s.defaultTokenUrl;
}

export function saveTurnTokenUrl(s: IceStorage, url: string): void {
  const trimmed = url.trim();
  if (trimmed) localStorage.setItem(s.tokenUrlKey, trimmed);
  else localStorage.removeItem(s.tokenUrlKey);
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
