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

export function createMeshConfig(input: MeshConfigInput): MeshConfig {
  const storagePrefix = input.appName;
  applyDeepLink(storagePrefix);
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
