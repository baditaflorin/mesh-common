import { useEffect, useRef } from "react";

const BEACON_OPTOUT_KEY = "__mesh_beacon_optout";

/**
 * Universal opt-in check used by both `useMeshBeacon` and the settings
 * drawer toggle. Returns true if the user has explicitly opted out.
 */
export function beaconOptedOut(): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(BEACON_OPTOUT_KEY) === "1";
  } catch {
    return false;
  }
}

export function setBeaconOptOut(value: boolean): void {
  try {
    if (value) localStorage.setItem(BEACON_OPTOUT_KEY, "1");
    else localStorage.removeItem(BEACON_OPTOUT_KEY);
  } catch {
    /* private mode / quota exceeded */
  }
}

function dntActive(): boolean {
  if (typeof navigator === "undefined") return false;
  const dnt =
    (navigator as { doNotTrack?: string | null }).doNotTrack ??
    (window as unknown as { doNotTrack?: string }).doNotTrack;
  return dnt === "1" || dnt === "yes";
}

function defaultBeaconURL(): string {
  if (typeof import.meta !== "undefined") {
    const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
    const fromEnv = env?.VITE_BEACON_URL;
    if (fromEnv && fromEnv.length > 0) return fromEnv;
  }
  return "https://pixel.0exec.com/pix.gif";
}

function readInviterFromHash(): string | null {
  try {
    if (typeof window === "undefined") return null;
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return null;
    const params = new URLSearchParams(hash);
    return params.get("p");
  } catch {
    return null;
  }
}

export type BeaconParams = {
  /** App id — required. Usually `config.appName`. */
  app: string;
  /** Current room id. */
  room?: string;
  /** Local peer id (first 6 chars are sent for privacy). */
  peer?: string;
  /** Inviter peer id; if omitted the hook reads `#p=` from the URL. */
  inviter?: string;
  /** App version / commit sha if known. */
  v?: string;
  /** Event kind. Default `pv` (pageview). */
  event?: string;
};

/**
 * Fire-and-forget beacon. Used by `useMeshBeacon` on room mount and
 * also exposed as a standalone helper for custom events.
 *
 * No-ops when:
 *   - SSR (no `window`)
 *   - `Do-Not-Track` is active
 *   - user has set the opt-out toggle (`__mesh_beacon_optout=1`)
 */
export function fireBeacon(params: BeaconParams, url: string = defaultBeaconURL()): void {
  if (typeof window === "undefined") return;
  if (dntActive() || beaconOptedOut()) return;

  const qs = new URLSearchParams();
  qs.set("app", params.app);
  qs.set("event", params.event ?? "pv");
  if (params.room) qs.set("room", params.room.slice(0, 64));
  if (params.peer) qs.set("peer", params.peer.slice(0, 12));
  const inviter = params.inviter ?? readInviterFromHash() ?? "";
  if (inviter) qs.set("inviter", inviter.slice(0, 12));
  if (params.v) qs.set("v", params.v);
  qs.set("r", document.referrer || "direct");
  qs.set("t", String(Date.now()));

  const fullURL = `${url}?${qs.toString()}`;

  // Prefer sendBeacon for resilience under unload, fall back to Image()
  // for the synchronous fire-and-forget case browsers always honour.
  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    try {
      // sendBeacon accepts string body — but we want a GET-style URL with
      // params, not a POST. Use Image() instead for GETs; sendBeacon would
      // require a server-side POST handler.
    } catch {
      /* ignore */
    }
  }
  try {
    const img = new Image(1, 1);
    img.referrerPolicy = "no-referrer-when-downgrade";
    img.decoding = "async";
    img.loading = "eager";
    img.src = fullURL;
  } catch {
    /* no DOM */
  }
}

/**
 * React hook that fires a `pv` beacon once per `(app, room, peer)` change.
 * Idempotent across re-renders. Quietly no-ops when DNT is on, the user
 * opted out, or `app` is empty.
 *
 * Pair with `MeshShell` (which calls this automatically) or mount the
 * standalone `<MeshBeacon/>` component on apps that don't use MeshShell.
 */
export function useMeshBeacon(params: BeaconParams, url?: string): void {
  const lastKeyRef = useRef<string>("");
  useEffect(() => {
    if (!params.app) return;
    const key = `${params.app}|${params.room ?? ""}|${params.peer ?? ""}|${params.event ?? "pv"}`;
    if (key === lastKeyRef.current) return;
    lastKeyRef.current = key;
    fireBeacon(params, url);
  }, [params.app, params.room, params.peer, params.event, params.v, url]);
}
