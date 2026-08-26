/**
 * App-level config consumed by MeshShell / SettingsDrawer / SelfRefBar.
 * Apps construct this once in src/config.ts and pass it down.
 *
 * The injected globals __APP_VERSION__ and __GIT_COMMIT__ are populated by the
 * Vite `define` block in the per-app vite.config.ts (boilerplate from the
 * scaffold template).
 */

/**
 * A restrained visual direction chosen by an app, rather than another
 * hard-coded palette. Profiles share the same accessible component system but
 * give games, creative tools, groups, utilities, and device experiences their
 * own visual rhythm.
 */
export type MeshVisualProfileName =
  "utility" | "play" | "studio" | "gather" | "field";

/** How shared shell chrome coexists with an app's own first viewport. */
export type MeshShellLayout = "overlay" | "inset";

export type MeshBreadcrumbConfigItem = {
  /** Human-facing location label. The final item is the current location. */
  label: string;
  /** Optional native destination for a non-current location. */
  href?: string;
};

export type MeshBreadcrumbsConfig = {
  /** Ordered from the broadest location to the current location. */
  items: readonly MeshBreadcrumbConfigItem[];
  /** Accessible landmark label. Defaults to the product's location trail. */
  ariaLabel?: string;
};

/** `false` keeps the trail out of an app until it has real navigation state. */
export type MeshBreadcrumbsOption = false | MeshBreadcrumbsConfig;

export type MeshConfig = {
  /** Stable repository/storage identifier, e.g. `mesh-queue`. */
  appName: string;
  /**
   * Human-facing product name. Optional for compatibility with hand-authored
   * config literals; `createMeshConfig` always resolves a clean fallback.
   */
  displayName?: string;
  /**
   * Visual direction used by shared chrome and composable experience UI.
   * Optional for compatibility; shared chrome falls back to `utility`.
   */
  visualProfile?: MeshVisualProfileName;
  /**
   * `overlay` preserves existing full-screen canvases; `inset` reserves a
   * real first row for the shared product bar. Optional for legacy literals.
   */
  shellLayout?: MeshShellLayout;
  /**
   * Optional location trail for modern shared chrome. Existing literal config
   * objects remain valid, while new configs resolve to `false` by default.
   */
  breadcrumbs?: MeshBreadcrumbsOption;
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
  /** Stable repository/storage identifier, e.g. `mesh-queue`. */
  appName: string;
  /** Optional product title; a polished name is derived from `appName` by default. */
  displayName?: string;
  /** Defaults to the calm, information-dense utility profile. */
  visualProfile?: MeshVisualProfileName;
  /**
   * Opt into shared product chrome. `inset` reserves a real first row;
   * `overlay` is for an app that has made its own safe space for controls.
   * Omit this while migrating an existing app to preserve its current shell.
   */
  shellLayout?: MeshShellLayout;
  /**
   * Starts disabled so a single-view app never gains pretend navigation.
   * Enable only with a real ordered trail, for example `Lobby › Round`.
   */
  breadcrumbs?: MeshBreadcrumbsOption;
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

const DISPLAY_NAME_ACRONYMS: Record<string, string> = {
  ai: "AI",
  api: "API",
  gps: "GPS",
  nfc: "NFC",
  p2p: "P2P",
  qr: "QR",
  rsvp: "RSVP",
  ui: "UI",
  ux: "UX",
  webrtc: "WebRTC",
  yjs: "Yjs",
  "2fa": "2FA",
};

/**
 * Converts a fleet identifier into a presentable fallback without changing
 * the stable app id used by rooms, storage, URLs, or repositories.
 */
export function humanizeMeshAppName(appName: string): string {
  const meaningful = appName
    .trim()
    .replace(/^mesh[-_\s]*/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!meaningful) return "Mesh";

  return meaningful
    .split(" ")
    .map((word) => {
      const normalized = word.toLowerCase();
      if (DISPLAY_NAME_ACRONYMS[normalized]) {
        return DISPLAY_NAME_ACRONYMS[normalized];
      }
      return normalized.charAt(0).toUpperCase() + normalized.slice(1);
    })
    .join(" ");
}

/**
 * Returns black or white text with at least 4.5:1 contrast against any valid
 * three- or six-digit hex accent. Keep a caller's fallback for non-hex colors
 * so custom CSS tokens remain possible.
 */
export function meshAccentText(accent: string, fallback = "#000000"): string {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(accent.trim());
  if (!match) return fallback;
  const source =
    match[1]!.length === 3
      ? match[1]!
          .split("")
          .map((part) => `${part}${part}`)
          .join("")
      : match[1]!;
  const channels = [0, 2, 4].map(
    (offset) => Number.parseInt(source.slice(offset, offset + 2), 16) / 255,
  );
  const luminance = channels.reduce(
    (total, channel, index) =>
      total +
      (channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4) *
        [0.2126, 0.7152, 0.0722][index]!,
    0,
  );
  // Black meets 4.5:1 above this threshold; white meets it below. Choosing
  // between the two gives every valid hex accent a readable primary action.
  return luminance > 0.179 ? "#000000" : "#ffffff";
}

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
      window.location.origin +
      window.location.pathname +
      window.location.search;
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
        const parsed = JSON.parse(fleetRaw) as {
          nickname?: unknown;
          name?: unknown;
        };
        if (typeof parsed?.nickname === "string" && parsed.nickname) {
          fleetNickname = parsed.nickname;
        } else if (typeof parsed?.name === "string" && parsed.name) {
          fleetNickname = parsed.name;
        }
      } catch {
        /* corrupt fleet entry; ignore */
      }
    }

    const firstExisting = existing.find(
      (v): v is string => !!v && v.length > 0,
    );

    // Hydrate: app has no name in any of its possible conventions; fleet does.
    // Write to ALL three keys so whichever the app reads, it gets the value.
    if (!firstExisting && fleetNickname) {
      for (const k of keys) ls.setItem(k, fleetNickname);
      return;
    }

    // Publish: app has a name, fleet is empty. Push the first existing value.
    // Only if it matches the strict-ASCII allowlist (matches the
    // fleetPersona client + go-fleet-persona server validation).
    if (
      firstExisting &&
      !fleetNickname &&
      STRICT_ASCII_NAME.test(firstExisting)
    ) {
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
    displayName:
      input.displayName?.trim() || humanizeMeshAppName(input.appName),
    visualProfile: input.visualProfile ?? "utility",
    // Do not silently place new chrome over a mature app's own topbar. New
    // scaffolded apps set `inset` explicitly; existing apps opt in as they
    // receive a deliberate visual pass.
    shellLayout: input.shellLayout,
    breadcrumbs: input.breadcrumbs ?? false,
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
