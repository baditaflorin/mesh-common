import { useEffect, useState } from "react";
import type { MeshConfig } from "./MeshConfig";
import type { YRoom } from "./useYRoom";

const NAME_KEY = (prefix: string) => `${prefix}:displayName`;

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
 * The first primitive every mesh-* app reaches for. Handles three things at once:
 *
 *   1. localStorage-persisted display name keyed on `config.storagePrefix`
 *   2. mirrored into a shared `Y.Map<peerId, name>` under the well-known key
 *      `__mesh_names` so every peer can resolve `peerId → name` for free
 *   3. observer wiring so the hook re-renders when *any* peer's name changes
 *
 * Replaces ~20 lines of identical boilerplate that has been copy-pasted into
 * roughly 60 of the existing apps.
 */
export function useNamedPeer(config: MeshConfig, room: YRoom | null): NamedPeer {
  const [name, setNameRaw] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    try {
      return localStorage.getItem(NAME_KEY(config.storagePrefix)) ?? "";
    } catch {
      return "";
    }
  });
  const [, rerender] = useState(0);

  useEffect(() => {
    try {
      if (name) localStorage.setItem(NAME_KEY(config.storagePrefix), name);
    } catch {
      /* private mode / quota */
    }
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

  const myName =
    name.trim() || (room ? `peer-${room.peerId.slice(0, 6)}` : "");

  return { name, setName, names, nameOf, myName };
}
