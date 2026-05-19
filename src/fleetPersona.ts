/**
 * fleetPersona — cross-app display identity for the mesh-* family.
 *
 * Two tiers, both opt-in, both surviving the other:
 *
 *   L0 — per-app local persona (always available)
 *   L1 — same-origin fleet persona (free on GH Pages — every
 *        baditaflorin.github.io/<app> app sees the same key)
 *   L2 — optional cross-origin service (Hetzner-backed). Async,
 *        2 s timeout, never blocks the UI, fails silently.
 *
 * Resolution order on read: L0 > L1 > L2. Writes propagate down the stack
 * (L0 always, L1 when mode >= "local-fleet", L2 when mode === "remote-fleet").
 *
 * This module is React-free. The hook is in useFleetPersona.ts.
 *
 * SECURITY MODEL
 * --------------
 * The service stores `(anonId → persona)`. `anonId` is a 128-bit random
 * hex generated client-side and worth nothing on its own (display names
 * are not secrets). Writes require a separate 128-bit `writeToken` that
 * lives ONLY in this browser's localStorage and is hashed at rest on the
 * server. The token is never exposed to app code — `publishToFleet` is
 * the only code path that reads it, and it only sends it to `serviceUrl`.
 *
 * No emails, IPs, fingerprints, app names, or referrers are stored or
 * sent. Operator can correlate browsers across apps (that IS the feature)
 * but cannot tell which apps a browser opens.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export type AvatarVariant = "beam" | "grid";

/** What we store for a browser's fleet identity. */
export type FleetPersona = {
  /** Short handle / nickname. Displayed first by most apps. */
  nickname: string;
  /** Optional longer / formal name. */
  name: string;
  /** Seed for the deterministic avatar SVG. Stable across renames. */
  avatarSeed: string;
  /** Avatar variant. */
  avatarVariant: AvatarVariant;
  /** Force a palette (0..5); if undefined the seed picks one. */
  paletteIndex?: number;
};

/** Where a resolved persona came from. */
export type PersonaSource = "local" | "fleet-local" | "fleet-remote" | "default";

/** Per-app sync mode. */
export type FleetSyncMode = "off" | "local-fleet" | "remote-fleet";

export const DEFAULT_PERSONA: FleetPersona = Object.freeze({
  nickname: "",
  name: "",
  avatarSeed: "",
  avatarVariant: "beam",
});

/**
 * Canonical public URL of the fleet's L2 (cross-origin) persona service.
 * Apps that want cross-origin sync can pass this — or just rely on
 * `FleetIdentityPanel`'s default. Override per-app by passing your own
 * `serviceUrl` (e.g. for staging) or pass `null` to disable L2 entirely.
 */
export const DEFAULT_FLEET_PERSONA_SERVICE_URL = "https://fleet-persona.0exec.com";

const STORE_VERSION = 1;
const SHARED_PREFIX = `mesh-fleet:v${STORE_VERSION}:`;
const KEY_FLEET_PERSONA = `${SHARED_PREFIX}fleet`;
const KEY_ANON_ID = `${SHARED_PREFIX}anonId`;
const KEY_WRITE_TOKEN = `${SHARED_PREFIX}writeToken`;
const localKey = (appName: string) => `${SHARED_PREFIX}local:${appName}`;
const modeKey = (appName: string) => `${SHARED_PREFIX}mode:${appName}`;

/**
 * Strict allowlist: ASCII letters/digits/space/`_`/`-`/`.` up to 32 chars.
 * The server enforces the same regex — keep them identical. Strict ASCII
 * is deliberate: it eliminates a huge class of stored-XSS / homoglyph
 * concerns at the cost of forcing international users to transliterate
 * (acceptable for a display-name-only field).
 */
export const PERSONA_FIELD_RE = /^[A-Za-z0-9_\- .]{1,32}$/;

const AVATAR_SEED_RE = /^[A-Za-z0-9_\-]{1,64}$/;

/** True if the field validates against the strict allowlist. Empty is OK. */
export function isValidPersonaField(s: string): boolean {
  return s === "" || PERSONA_FIELD_RE.test(s);
}

export function isValidAvatarSeed(s: string): boolean {
  return s === "" || AVATAR_SEED_RE.test(s);
}

export function isValidVariant(v: unknown): v is AvatarVariant {
  return v === "beam" || v === "grid";
}

export function sanitizePersona(p: Partial<FleetPersona>): FleetPersona {
  return {
    nickname: isValidPersonaField(p.nickname ?? "") ? p.nickname ?? "" : "",
    name: isValidPersonaField(p.name ?? "") ? p.name ?? "" : "",
    avatarSeed: isValidAvatarSeed(p.avatarSeed ?? "") ? p.avatarSeed ?? "" : "",
    avatarVariant: isValidVariant(p.avatarVariant) ? p.avatarVariant : "beam",
    paletteIndex:
      typeof p.paletteIndex === "number" && Number.isInteger(p.paletteIndex) && p.paletteIndex >= 0 && p.paletteIndex < 256
        ? p.paletteIndex
        : undefined,
  };
}

/** True if a persona has any field worth syncing. */
export function isPersonaEmpty(p: FleetPersona): boolean {
  return !p.nickname && !p.name && !p.avatarSeed && p.paletteIndex === undefined;
}

// ---------------------------------------------------------------------------
// Storage helpers (defensive — every call is wrapped because Safari ITP and
// private-mode Firefox both throw on localStorage access in some configs).
// ---------------------------------------------------------------------------

function safeLocalStorage(): Storage | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

function readJson<T>(key: string): T | null {
  const ls = safeLocalStorage();
  if (!ls) return null;
  try {
    const raw = ls.getItem(key);
    if (raw == null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): boolean {
  const ls = safeLocalStorage();
  if (!ls) return false;
  try {
    ls.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function removeKey(key: string): void {
  const ls = safeLocalStorage();
  if (!ls) return;
  try {
    ls.removeItem(key);
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// L0 — per-app local persona
// ---------------------------------------------------------------------------

export function readLocalPersona(appName: string): FleetPersona | null {
  const raw = readJson<Partial<FleetPersona>>(localKey(appName));
  if (!raw) return null;
  return sanitizePersona(raw);
}

export function writeLocalPersona(appName: string, p: FleetPersona): boolean {
  return writeJson(localKey(appName), sanitizePersona(p));
}

export function clearLocalPersona(appName: string): void {
  removeKey(localKey(appName));
}

// ---------------------------------------------------------------------------
// L1 — same-origin shared persona (lives outside any per-app prefix; that's
// the whole point — every fleet app on this origin reads/writes the same key)
// ---------------------------------------------------------------------------

export function readFleetLocalPersona(): FleetPersona | null {
  const raw = readJson<Partial<FleetPersona>>(KEY_FLEET_PERSONA);
  if (!raw) return null;
  return sanitizePersona(raw);
}

export function writeFleetLocalPersona(p: FleetPersona): boolean {
  return writeJson(KEY_FLEET_PERSONA, sanitizePersona(p));
}

export function clearFleetLocalPersona(): void {
  removeKey(KEY_FLEET_PERSONA);
}

// ---------------------------------------------------------------------------
// Mode (per-app setting)
// ---------------------------------------------------------------------------

export function readMode(appName: string, fallback: FleetSyncMode = "local-fleet"): FleetSyncMode {
  const v = readJson<FleetSyncMode>(modeKey(appName));
  return v === "off" || v === "local-fleet" || v === "remote-fleet" ? v : fallback;
}

export function writeMode(appName: string, mode: FleetSyncMode): boolean {
  return writeJson(modeKey(appName), mode);
}

// ---------------------------------------------------------------------------
// L2 — cross-origin service identity (anonId + writeToken)
// ---------------------------------------------------------------------------

function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(buf);
  } else {
    // Fallback (jsdom, very old environments). Math.random is fine for
    // anon_id collision-avoidance at this scale — birthday at 2^64.
    for (let i = 0; i < buf.length; i++) buf[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Get the anonId for this browser, creating one on first call. */
export function ensureAnonId(): string {
  const existing = safeLocalStorage()?.getItem(KEY_ANON_ID);
  if (existing && /^[a-f0-9]{32}$/.test(existing)) return existing;
  const fresh = randomHex(16);
  writeJson(KEY_ANON_ID, fresh);
  // Store as a raw string for human-readability; rewrite if JSON-wrapped.
  safeLocalStorage()?.setItem(KEY_ANON_ID, fresh);
  return fresh;
}

/** Get or create the writeToken paired with this browser's anonId. */
export function ensureWriteToken(): string {
  const existing = safeLocalStorage()?.getItem(KEY_WRITE_TOKEN);
  if (existing && /^[a-f0-9]{32}$/.test(existing)) return existing;
  const fresh = randomHex(16);
  safeLocalStorage()?.setItem(KEY_WRITE_TOKEN, fresh);
  return fresh;
}

export function readAnonId(): string | null {
  return safeLocalStorage()?.getItem(KEY_ANON_ID) ?? null;
}

export function readWriteToken(): string | null {
  return safeLocalStorage()?.getItem(KEY_WRITE_TOKEN) ?? null;
}

export function clearRemoteCredentials(): void {
  removeKey(KEY_ANON_ID);
  removeKey(KEY_WRITE_TOKEN);
}

/** Inject specific credentials (used by handoff import). */
export function setRemoteCredentials(anonId: string, writeToken: string): void {
  if (!/^[a-f0-9]{32}$/.test(anonId) || !/^[a-f0-9]{32}$/.test(writeToken)) return;
  safeLocalStorage()?.setItem(KEY_ANON_ID, anonId);
  safeLocalStorage()?.setItem(KEY_WRITE_TOKEN, writeToken);
}

// ---------------------------------------------------------------------------
// Service client (fetch wrappers — 2s timeout, swallow errors)
// ---------------------------------------------------------------------------

export type ServiceClientOptions = {
  serviceUrl: string;
  fetchTimeoutMs?: number;
  /** Inject a fetch impl for tests. */
  fetchImpl?: typeof fetch;
};

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      () => {
        clearTimeout(t);
        resolve(null);
      },
    );
  });
}

export async function fetchRemotePersona(
  opts: ServiceClientOptions,
  anonId: string,
): Promise<FleetPersona | null> {
  if (!anonId) return null;
  const f = opts.fetchImpl ?? fetch;
  const url = `${opts.serviceUrl.replace(/\/+$/, "")}/v1/persona/${anonId}`;
  const result = await withTimeout(
    f(url, { method: "GET", credentials: "omit", mode: "cors" }),
    opts.fetchTimeoutMs ?? 2000,
  );
  if (!result || !result.ok) return null;
  try {
    const json = (await result.json()) as Partial<FleetPersona>;
    return sanitizePersona(json);
  } catch {
    return null;
  }
}

export async function publishRemotePersona(
  opts: ServiceClientOptions,
  anonId: string,
  writeToken: string,
  persona: FleetPersona,
): Promise<boolean> {
  if (!anonId || !writeToken) return false;
  const f = opts.fetchImpl ?? fetch;
  const url = `${opts.serviceUrl.replace(/\/+$/, "")}/v1/persona/${anonId}`;
  const body = JSON.stringify({ ...sanitizePersona(persona), writeToken });
  const result = await withTimeout(
    f(url, {
      method: "PUT",
      credentials: "omit",
      mode: "cors",
      headers: { "content-type": "application/json" },
      body,
    }),
    opts.fetchTimeoutMs ?? 2000,
  );
  return !!result && result.ok;
}

export async function deleteRemotePersona(
  opts: ServiceClientOptions,
  anonId: string,
  writeToken: string,
): Promise<boolean> {
  if (!anonId || !writeToken) return false;
  const f = opts.fetchImpl ?? fetch;
  const url = `${opts.serviceUrl.replace(/\/+$/, "")}/v1/persona/${anonId}`;
  const result = await withTimeout(
    f(url, {
      method: "DELETE",
      credentials: "omit",
      mode: "cors",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ writeToken }),
    }),
    opts.fetchTimeoutMs ?? 2000,
  );
  return !!result && result.ok;
}

// ---------------------------------------------------------------------------
// Resolution + composition
// ---------------------------------------------------------------------------

export type ResolvedPersona = {
  persona: FleetPersona;
  source: PersonaSource;
};

/** Synchronous resolution — L0 > L1 > default. L2 is async, handled by the hook. */
export function resolvePersonaSync(appName: string, mode: FleetSyncMode): ResolvedPersona {
  const l0 = readLocalPersona(appName);
  if (l0 && !isPersonaEmpty(l0)) return { persona: l0, source: "local" };
  if (mode !== "off") {
    const l1 = readFleetLocalPersona();
    if (l1 && !isPersonaEmpty(l1)) return { persona: l1, source: "fleet-local" };
  }
  return { persona: { ...DEFAULT_PERSONA }, source: "default" };
}

/** "What name should this app actually render?" — nickname-preferring by default. */
export function displayLabel(p: FleetPersona, prefer: "nickname" | "name" = "nickname"): string {
  if (prefer === "name") return p.name || p.nickname || "";
  return p.nickname || p.name || "";
}

/** Avatar seed to pass to PeerAvatar — falls back to nickname or name. */
export function avatarSeedFor(p: FleetPersona): string {
  return p.avatarSeed || p.nickname || p.name || "anon";
}

// ---------------------------------------------------------------------------
// Handoff (cross-origin URL fragment / QR payload)
// ---------------------------------------------------------------------------

export const HANDOFF_HASH_KEY = "fp";

/**
 * Build a handoff URL the user can open on another origin to carry this
 * browser's fleet identity there. Includes `anonId` + `writeToken` + the
 * current persona snapshot. The fragment never hits any server because
 * browsers don't send hashes in HTTP requests.
 */
export function buildHandoffUrl(targetOrigin: string, anonId: string, writeToken: string, persona: FleetPersona): string {
  const payload = {
    v: 1,
    anonId,
    writeToken,
    p: sanitizePersona(persona),
  };
  // Persona fields + hex ids are strict ASCII, so plain btoa is safe.
  const b64 = btoa(JSON.stringify(payload));
  const sep = targetOrigin.includes("#") ? "&" : "#";
  return `${targetOrigin.replace(/\/+$/, "")}/${sep}${HANDOFF_HASH_KEY}=${encodeURIComponent(b64)}`;
}

/** One-shot read of `#fp=…` from `window.location.hash`. Wipes the hash on success. */
export function consumeHandoffFromHash(): { anonId: string; writeToken: string; persona: FleetPersona } | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash || "";
  const m = hash.match(new RegExp(`[#&]${HANDOFF_HASH_KEY}=([^&]+)`));
  if (!m) return null;
  try {
    const raw = decodeURIComponent(m[1]!);
    const json = JSON.parse(atob(raw));
    if (json?.v !== 1) return null;
    const anonId = typeof json.anonId === "string" && /^[a-f0-9]{32}$/.test(json.anonId) ? json.anonId : null;
    const writeToken = typeof json.writeToken === "string" && /^[a-f0-9]{32}$/.test(json.writeToken) ? json.writeToken : null;
    if (!anonId || !writeToken) return null;
    const persona = sanitizePersona(json.p ?? {});
    // Wipe just this key from the hash; leave other deep-link fragments intact.
    try {
      const cleaned = hash.replace(new RegExp(`(^[#&])${HANDOFF_HASH_KEY}=[^&]+&?`), "$1").replace(/#$/, "").replace(/^[#&]/, "#");
      const newHash = cleaned === "#" ? "" : cleaned;
      const newUrl = `${window.location.pathname}${window.location.search}${newHash}`;
      window.history.replaceState(null, "", newUrl);
    } catch {
      /* ignore */
    }
    return { anonId, writeToken, persona };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Storage keys exported for tests + debugging
// ---------------------------------------------------------------------------

export const FleetPersonaStorageKeys = Object.freeze({
  SHARED_PREFIX,
  KEY_FLEET_PERSONA,
  KEY_ANON_ID,
  KEY_WRITE_TOKEN,
  localKey,
  modeKey,
});
