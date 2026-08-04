/**
 * Stable per-browser, per-app device identifier.
 *
 * Distinct from the ephemeral Yjs `peerId` (a fresh `awareness.clientID` — or
 * `crypto.randomUUID()` fallback — on every page load) and from
 * `identity.ts`'s Ed25519 keypair (expensive to generate, meant for signed
 * claims). This is a cheap, unauthenticated random id, persisted in
 * localStorage under `storagePrefix`, whose only job is letting presence
 * primitives like `useRoster` recognize "this is the same browser as before"
 * across a reload — so a refresh supersedes a peer's old roster slot instead
 * of appearing alongside it.
 *
 * Deliberately per-app scoped (unlike `fleetPersona`'s same-origin `anonId`):
 * it never gives room peers a way to correlate a browser across different
 * mesh-* apps, only within the single room/app that already sees its peerId.
 */

const KEY = (storagePrefix: string) => `${storagePrefix}:deviceId:v1`;

function safeLocalStorage(): Storage | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

/** Get this browser's device id for `storagePrefix`, creating one on first call. */
export function ensureDeviceId(storagePrefix: string): string {
  const ls = safeLocalStorage();
  if (ls) {
    try {
      const existing = ls.getItem(KEY(storagePrefix));
      if (existing) return existing;
    } catch {
      /* SecurityError in some browsers / contexts */
    }
  }
  const fresh = crypto.randomUUID();
  if (ls) {
    try {
      ls.setItem(KEY(storagePrefix), fresh);
    } catch {
      /* private mode / quota — the id just won't survive a reload */
    }
  }
  return fresh;
}
