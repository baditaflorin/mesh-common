import { useEffect, useState } from "react";
import type { YRoom } from "./useYRoom";

export type SharedSetOptions<T> = {
  /** Turns a value into its stable membership key. Defaults to JSON.stringify. */
  keyOf?: (value: T) => string;
  /** Reject malformed values before they enter the shared document. */
  validate?: (value: T) => boolean;
};

export type SharedSet<T> = {
  values: T[];
  size: number;
  has: (value: T) => boolean;
  add: (value: T) => boolean;
  delete: (value: T) => boolean;
  clear: () => void;
};

/**
 * A validated, de-duplicated CRDT set backed by a Y.Map. Prefer `keyOf` for
 * objects whose JSON representation is not a stable identity.
 */
export function useSharedSet<T>(
  room: YRoom | null,
  key: string,
  options: SharedSetOptions<T> = {},
): SharedSet<T> {
  const [, rerender] = useState(0);
  useEffect(() => {
    if (!room) return;
    const map = room.doc.getMap<T>(key);
    const onChange = () => rerender((version) => version + 1);
    map.observe(onChange);
    return () => map.unobserve(onChange);
  }, [room, key]);

  const map = room?.doc.getMap<T>(key) ?? null;
  const keyOf = (value: T) => {
    try {
      return options.keyOf?.(value) ?? JSON.stringify(value);
    } catch {
      return "";
    }
  };
  const values = map ? Array.from(map.values()) : [];

  return {
    values,
    size: values.length,
    has: (value) => Boolean(map?.has(keyOf(value))),
    add: (value) => {
      const id = keyOf(value);
      if (!map || !id || map.has(id) || options.validate?.(value) === false) return false;
      map.set(id, value);
      return true;
    },
    delete: (value) => {
      const id = keyOf(value);
      if (!map || !id || !map.has(id)) return false;
      map.delete(id);
      return true;
    },
    clear: () => map?.clear(),
  };
}
