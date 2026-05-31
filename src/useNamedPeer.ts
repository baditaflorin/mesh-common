import { useEffect, useState } from "react";
import type { MeshConfig } from "./MeshConfig";
import type { YRoom } from "./useYRoom";
import {
  DEFAULT_PERSONA,
  PERSONA_FIELD_RE,
  readFleetLocalPersona,
  writeFleetLocalPersona,
} from "./fleetPersona";

const NAME_KEY = (prefix: string) => `${prefix}:displayName`;

/** The display name carried by the same-origin fleet persona (L1), if any. */
function readFleetName(): string {
  try {
    const p = readFleetLocalPersona();
    return p?.nickname || p?.name || "";
  } catch {
    return "";
  }
}

/**
 * Mirror a freshly chosen display name into the same-origin fleet persona so
 * every other mesh-* app on `baditaflorin.github.io` remembers it. Strict-ASCII
 * gated to match the persona allowlist (non-conforming names stay app-local),
 * and merge-preserving so we never clobber an existing avatar/name field.
 */
function publishFleetName(trimmed: string): void {
  if (!trimmed || !PERSONA_FIELD_RE.test(trimmed)) return;
  try {
    const existing = readFleetLocalPersona() ?? { ...DEFAULT_PERSONA };
    if (existing.nickname === trimmed) return;
    writeFleetLocalPersona({ ...existing, nickname: trimmed });
  } catch {
    /* private mode / quota — non-fatal */
  }
}

export type NamedPeer = {
  /** This peer's display name (controlled). */
  name: string;
  /** Setter — also writes to localStorage + the shared `names` Y.Map. */
  setName: (n: string) => void;
  /** Snapshot of `Y.Map<peerId, name>` for every peer who has registered. */
  names: Record<string, string>;
  /** Convenience: resolve a peerId to its display name (or undefined). */
  nameOf: (peerId: string) => string | undefined;
  /** Convenience: this peer's name, falling back to a short peerId slice. */
  myName: string;
};

/**
 * The first primitive every mesh-* app reaches for. Handles four things at once:
 *
 *   1. localStorage-persisted display name keyed on `config.storagePrefix`
 *   2. cross-app persistence: on first load (no per-app name yet) the name is
 *      adopted from the same-origin fleet persona (L1, key `mesh-fleet:v1:fleet`),
 *      and every name change is mirrored back into it — so a name chosen in one
 *      `baditaflorin.github.io/<app>` app is remembered by every sibling app
 *      without a reload. (Previously the name lived only under the per-app key,
 *      so it never crossed between apps.)
 *   3. mirrored into a shared `Y.Map<peerId, name>` under the well-known key
 *      `__mesh_names` so every peer can resolve `peerId → name` for free
 *   4. observer wiring so the hook re-renders when *any* peer's name changes
 *
 * Replaces ~20 lines of identical boilerplate that has been copy-pasted into
 * roughly 60 of the existing apps.
 */
export function useNamedPeer(
  config: MeshConfig,
  room: YRoom | null,
): NamedPeer {
  const [name, setNameRaw] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    try {
      const local = localStorage.getItem(NAME_KEY(config.storagePrefix));
      if (local) return local;
    } catch {
      /* fall through to the fleet persona */
    }
    // No per-app name yet — adopt the same-origin fleet name (set in any
    // sibling mesh-* app on this origin) so a fresh app "remembers" it.
    return readFleetName();
  });
  const [, rerender] = useState(0);

  useEffect(() => {
    const trimmed = name.trim();
    try {
      if (name) localStorage.setItem(NAME_KEY(config.storagePrefix), name);
    } catch {
      /* private mode / quota */
    }
    publishFleetName(trimmed);
  }, [name, config.storagePrefix]);

  useEffect(() => {
    if (!room) return;
    const m = room.doc.getMap<string>("__mesh_names");
    const cb = () => rerender((n) => n + 1);
    m.observe(cb);
    return () => m.unobserve(cb);
  }, [room]);

  // Push to the room whenever the trimmed name changes.
  useEffect(() => {
    if (!room) return;
    const trimmed = name.trim();
    const m = room.doc.getMap<string>("__mesh_names");
    if (trimmed && m.get(room.peerId) !== trimmed) {
      m.set(room.peerId, trimmed);
    }
  }, [name, room]);

  const setName = (n: string) => setNameRaw(n);

  const names: Record<string, string> = {};
  if (room) {
    room.doc.getMap<string>("__mesh_names").forEach((v, k) => {
      if (typeof v === "string" && v) names[k] = v;
    });
  }

  const nameOf = (peerId: string): string | undefined => names[peerId];

  const myName = name.trim() || (room ? `peer-${room.peerId.slice(0, 6)}` : "");

  return { name, setName, names, nameOf, myName };
}
