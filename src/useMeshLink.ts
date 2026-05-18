import { useCallback, useMemo } from "react";
import type { MeshConfig } from "./MeshConfig";

/**
 * Type-safe encoder + parser for mesh-* deep links of the canonical form:
 *
 *   https://baditaflorin.github.io/<app>/#r=<roomId>&p=<peerId>&x=<extraJSON>
 *
 * Today every app reinvents this URL-fragment dance (string concat for the
 * sharer, `URLSearchParams` parse for the receiver). Two problems:
 *
 *   1. Bugs around encoding: peer IDs with `+`, room IDs with `/`, JSON
 *      payloads with `&` all corrupt the link silently.
 *   2. Cross-app inconsistency: mesh-A puts the room in `?room=`, mesh-B
 *      puts it in `#r=`, mesh-C uses base64. They can't interop.
 *
 * `useMeshLink` is the one canonical encoder/decoder pair. Apps that want
 * to share state via QR / paste / share-sheet use `make()`; the receiver
 * uses `parse()` (or relies on `useIncomingScanLink` for the auto-join
 * sessionStorage flow that already exists).
 *
 * Wire format (fragment, not query string, so it never hits server logs):
 *   #r=<roomId>           — required
 *   &p=<peerId>           — optional (the sharer's peer ID)
 *   &x=<extra>            — optional; if it parses as JSON, parse() returns
 *                            the object; otherwise the raw string is returned.
 *   &v=<schemaVersion>    — optional; defaults to "1". Reserved for future
 *                            breaking changes to the wire format.
 *
 * All values are `encodeURIComponent`-encoded, so peerIds with slashes,
 * payloads with ampersands, and room IDs with unicode all round-trip.
 */

export type MeshLinkPayload<T = unknown> = {
  roomId: string;
  peerId?: string;
  /** App-specific extra. If you pass an object it's JSON-stringified; if you
   *  pass a string it's sent verbatim. */
  extra?: T | string | null;
  /** Wire-format version. Defaults to "1". Only set this if you've shipped
   *  a parser change first. */
  version?: string;
};

export type ParsedMeshLink<T = unknown> = {
  roomId: string;
  peerId: string | null;
  /** Decoded extra. JSON-parsed when valid JSON; raw string otherwise. */
  extra: T | string | null;
  /** Wire format version, defaults to "1" when absent. */
  version: string;
};

export type MeshLinkApi<T = unknown> = {
  /** Build a full URL using `config.baseUrl` (or `window.location.origin + pathname`). */
  make: (payload: MeshLinkPayload<T>) => string;
  /** Build just the `#…` fragment portion. */
  makeFragment: (payload: MeshLinkPayload<T>) => string;
  /** Parse any URL/string. Returns null if no roomId can be extracted. */
  parse: (urlOrFragment: string) => ParsedMeshLink<T> | null;
  /** Parse the current `window.location.hash` (no-op on SSR). */
  parseCurrent: () => ParsedMeshLink<T> | null;
};

const WIRE_VERSION = "1";

function encode(v: string): string {
  return encodeURIComponent(v);
}

function tryDecode(v: string): string {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

/** Pure: build the `#r=&p=&x=` fragment from a payload. Exported for testing
 *  and for use in non-React contexts (workers, server-side prerender). */
export function makeMeshLinkFragment<T>(payload: MeshLinkPayload<T>): string {
  const parts: string[] = [`r=${encode(payload.roomId)}`];
  if (payload.peerId) parts.push(`p=${encode(payload.peerId)}`);
  if (payload.extra !== undefined && payload.extra !== null) {
    const raw =
      typeof payload.extra === "string"
        ? payload.extra
        : JSON.stringify(payload.extra);
    parts.push(`x=${encode(raw)}`);
  }
  const version = payload.version ?? WIRE_VERSION;
  if (version !== WIRE_VERSION) parts.push(`v=${encode(version)}`);
  return `#${parts.join("&")}`;
}

/** Pure: parse any URL or bare fragment. */
export function parseMeshLink<T = unknown>(
  urlOrFragment: string,
): ParsedMeshLink<T> | null {
  if (!urlOrFragment) return null;
  // Extract the fragment portion, regardless of input shape.
  let frag = urlOrFragment;
  const hashIdx = frag.indexOf("#");
  if (hashIdx >= 0) frag = frag.slice(hashIdx + 1);
  // Tolerate either query-like `?` or empty input by treating it as the body.
  if (frag.startsWith("?")) frag = frag.slice(1);

  const params = new Map<string, string>();
  for (const pair of frag.split("&")) {
    if (!pair) continue;
    const eq = pair.indexOf("=");
    if (eq < 0) continue;
    const k = pair.slice(0, eq);
    const v = pair.slice(eq + 1);
    params.set(k, tryDecode(v));
  }
  const roomId = params.get("r");
  if (!roomId) return null;
  const peerId = params.get("p") ?? null;
  const version = params.get("v") ?? WIRE_VERSION;
  const rawExtra = params.get("x");
  let extra: T | string | null = null;
  if (rawExtra != null) {
    if (rawExtra.startsWith("{") || rawExtra.startsWith("[")) {
      try {
        extra = JSON.parse(rawExtra) as T;
      } catch {
        extra = rawExtra;
      }
    } else {
      extra = rawExtra;
    }
  }
  return { roomId, peerId, extra, version };
}

/** React hook that ties make/parse to the current `MeshConfig` (for baseUrl). */
export function useMeshLink<T = unknown>(config: MeshConfig): MeshLinkApi<T> {
  const baseUrl = useMemo(() => {
    // Prefer a configured baseUrl; otherwise compute from window at call time.
    const cfgBase = (config as { baseUrl?: string }).baseUrl;
    if (cfgBase) return cfgBase.replace(/#.*$/, "");
    if (typeof window !== "undefined") {
      return window.location.origin + window.location.pathname.replace(/#.*$/, "");
    }
    return "";
  }, [config]);

  const makeFragment = useCallback(
    (payload: MeshLinkPayload<T>) => makeMeshLinkFragment(payload),
    [],
  );
  const make = useCallback(
    (payload: MeshLinkPayload<T>) => baseUrl + makeFragment(payload),
    [baseUrl, makeFragment],
  );
  const parse = useCallback(
    (urlOrFragment: string) => parseMeshLink<T>(urlOrFragment),
    [],
  );
  const parseCurrent = useCallback(() => {
    if (typeof window === "undefined") return null;
    return parseMeshLink<T>(window.location.hash);
  }, []);

  return { make, makeFragment, parse, parseCurrent };
}
