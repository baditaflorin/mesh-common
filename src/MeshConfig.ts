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
 * Bridge between each mesh-* app's own `<storagePrefix>:myName` localStorage
 * key (the convention used by every app's `useState(myName)`) and the
 * cross-app fleet persona at `mesh-fleet:v1:fleet`. Runs synchronously
 * *before* App.tsx's `useState` callback so the app reads the bridged
 * value on first render — no reload needed in a fresh tab.
 *
 * Two-way:
 *   - If `<prefix>:myName` is empty and fleet has a nickname → hydrate
 *     the app key from the fleet (this is the "open new tab, see the
 *     same name" case the user reported).
 *   - If `<prefix>:myName` is set and fleet is empty → migrate the
 *     app's name into the fleet (so future tabs in other apps pick it
 *     up automatically). Validated against the strict-ASCII allowlist;
 *     non-conforming names stay app-local.
 *
 * Cross-tab updates *after* this initial load are not handled here —
 * apps that want live-update can wire `useFleetPersona` directly.
 */
function bridgeFleetIdentity(storagePrefix: string): void {
  if (typeof window === "undefined") return;
  try {
    const myNameKey = `${storagePrefix}:myName`;
    const fleetKey = "mesh-fleet:v1:fleet";
    const existing = window.localStorage.getItem(myNameKey);

    let fleetNickname: string | null = null;
    const fleetRaw = window.localStorage.getItem(fleetKey);
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

    if (!existing && fleetNickname) {
      // Fresh app + fleet has a name → pre-populate the app's myName key
      // before its useState reads localStorage.
      window.localStorage.setItem(myNameKey, fleetNickname);
      return;
    }

    if (existing && !fleetNickname && /^[A-Za-z0-9_\- .]{1,32}$/.test(existing)) {
      // App has a name, fleet doesn't → publish it so other apps pick
      // it up next time they load. Strict-ASCII gate matches the
      // fleetPersona / go-fleet-persona allowlist.
      window.localStorage.setItem(
        fleetKey,
        JSON.stringify({
          nickname: existing,
          name: "",
          avatarSeed: "",
          avatarVariant: "beam",
        }),
      );
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
