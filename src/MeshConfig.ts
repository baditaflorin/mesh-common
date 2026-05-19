/**
 * App-level config consumed by MeshShell / SettingsDrawer / SelfRefBar.
 * Apps construct this once in src/config.ts and pass it down.
 *
 * The injected globals __APP_VERSION__ and __GIT_COMMIT__ are populated by the
 * Vite `define` block in the per-app vite.config.ts (boilerplate from the
 * scaffold template).
 */

export type MeshConfig = {
  appName: string;
  storagePrefix: string;
  description: string;
  accentHex: string;
  version: string;
  commit: string;
  repositoryUrl: string;
  pagesUrl: string;
  signalingUrl: string;
  turnTokenUrl: string;
  paypalUrl: string;
};

export type MeshConfigInput = {
  appName: string;
  description: string;
  accentHex: string;
  version: string;
  commit: string;
  signalingUrl?: string;
  turnTokenUrl?: string;
  paypalUrl?: string;
};

const DEFAULT_SIGNALING = "wss://turn.0docker.com/ws";
const DEFAULT_TURN_TOKEN = "https://turn.0docker.com/credentials";
const DEFAULT_PAYPAL = "https://www.paypal.com/paypalme/florinbadita";

/**
 * Side effect at module load: if the URL hash contains `r=<roomId>&p=<peerId>&x=<extra>`
 * (the format emitted by `makeScanPayload`), persist the room ID to localStorage and
 * stash the peer+extra in sessionStorage for `useIncomingScanLink` to consume. Then
 * clear the hash so a reload doesn't re-fire the deep link.
 *
 * Runs synchronously before App.tsx's `useState(() => localStorage.getItem(...))`,
 * so the room override is in place when useYRoom mounts.
 */
function applyDeepLink(storagePrefix: string): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.location.hash;
    const hash = raw.startsWith("#") ? raw.slice(1) : raw;
    if (!hash.includes("=")) return;
    const params = new URLSearchParams(hash);
    const r = params.get("r");
    const p = params.get("p");
    const x = params.get("x");
    if (!r && !p && !x) return;
    if (r) {
      localStorage.setItem(`${storagePrefix}:room`, r);
    }
    if (p) {
      sessionStorage.setItem(
        `${storagePrefix}:incoming-scan`,
        JSON.stringify({ peerId: p, extra: x, roomId: r, ts: Date.now() }),
      );
    }
    // Clean the URL so reloads don't re-process and the user sees a tidy bar.
    const cleanUrl =
      window.location.origin + window.location.pathname + window.location.search;
    window.history.replaceState(null, "", cleanUrl);
  } catch {
    /* localStorage / URL parsing failures are non-fatal */
  }
}

/**
 * Bridge between each mesh-* app's own per-app name localStorage key and
 * the cross-app fleet persona at `mesh-fleet:v1:fleet`. Runs synchronously
 * at module load (in `createMeshConfig`), *before* App.tsx's
 * `useState(() => localStorage.getItem(...))` runs, so the app reads the
 * bridged value on first render — no reload needed in a fresh tab.
 *
 * Three name-key conventions exist in the fleet (~134 apps inspected on
 * 2026-05-20). We bridge all of them:
 *   - `<prefix>:displayName` — used by ~54 apps via `useNamedPeer` (canonical)
 *   - `<prefix>:name`        — used by ~7 apps directly (e.g. mesh-mafia)
 *   - `<prefix>:myName`      — used by ~2 apps (e.g. mesh-applause)
 *
 * Two-way:
 *   - If every per-app key is empty and fleet has a nickname → hydrate
 *     ALL three keys from the fleet (harmless: each app reads only its
 *     own convention; the unused keys sit dormant). This is the
 *     "open new tab, see the same name" case.
 *   - If any per-app key is set and fleet is empty → publish the first
 *     non-empty value to the fleet so future tabs pick it up. Strict-
 *     ASCII allowlist gated; non-conforming names stay app-local.
 *
 * Cross-tab updates *after* this initial load are not handled here —
 * apps that want live cross-tab sync can wire `useFleetPersona` directly.
 */
const NAME_KEYS = ["displayName", "name", "myName"] as const;
const FLEET_KEY = "mesh-fleet:v1:fleet";
const STRICT_ASCII_NAME = /^[A-Za-z0-9_\- .]{1,32}$/;

function bridgeFleetIdentity(storagePrefix: string): void {
  if (typeof window === "undefined") return;
  try {
    const ls = window.localStorage;
    const keys = NAME_KEYS.map((k) => `${storagePrefix}:${k}`);
    const existing = keys.map((k) => ls.getItem(k));

    let fleetNickname: string | null = null;
    const fleetRaw = ls.getItem(FLEET_KEY);
    if (fleetRaw) {
      try {
        const parsed = JSON.parse(fleetRaw) as { nickname?: unknown; name?: unknown };
        if (typeof parsed?.nickname === "string" && parsed.nickname) {
          fleetNickname = parsed.nickname;
        } else if (typeof parsed?.name === "string" && parsed.name) {
          fleetNickname = parsed.name;
        }
      } catch {
        /* corrupt fleet entry; ignore */
      }
    }

    const firstExisting = existing.find((v): v is string => !!v && v.length > 0);

    // Hydrate: app has no name in any of its possible conventions; fleet does.
    // Write to ALL three keys so whichever the app reads, it gets the value.
    if (!firstExisting && fleetNickname) {
      for (const k of keys) ls.setItem(k, fleetNickname);
      return;
    }

    // Publish: app has a name, fleet is empty. Push the first existing value.
    // Only if it matches the strict-ASCII allowlist (matches the
    // fleetPersona client + go-fleet-persona server validation).
    if (firstExisting && !fleetNickname && STRICT_ASCII_NAME.test(firstExisting)) {
      ls.setItem(
        FLEET_KEY,
        JSON.stringify({
          nickname: firstExisting,
          name: "",
          avatarSeed: "",
          avatarVariant: "beam",
        }),
      );
      // Also mirror to the OTHER conventions so apps using a different key
      // pick it up in the same tab without waiting for a future cross-app
      // bounce-back.
      for (let i = 0; i < keys.length; i++) {
        if (!existing[i]) ls.setItem(keys[i]!, firstExisting);
      }
    }
  } catch {
    /* localStorage unavailable (private mode); silently noop */
  }
}

export function createMeshConfig(input: MeshConfigInput): MeshConfig {
  const storagePrefix = input.appName;
  applyDeepLink(storagePrefix);
  bridgeFleetIdentity(storagePrefix);
  return {
    appName: input.appName,
    storagePrefix,
    description: input.description,
    accentHex: input.accentHex,
    version: input.version,
    commit: input.commit,
    repositoryUrl: `https://github.com/baditaflorin/${input.appName}`,
    pagesUrl: `https://baditaflorin.github.io/${input.appName}/`,
    signalingUrl: input.signalingUrl ?? DEFAULT_SIGNALING,
    turnTokenUrl: input.turnTokenUrl ?? DEFAULT_TURN_TOKEN,
    paypalUrl: input.paypalUrl ?? DEFAULT_PAYPAL,
  };
}
