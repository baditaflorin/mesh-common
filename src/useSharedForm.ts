import { useEffect, useState } from "react";
import type { YRoom } from "./useYRoom";
export type SharedForm<T extends Record<string, unknown>> = {
  values: T;
  setField: <K extends keyof T>(key: K, value: T[K]) => void;
  errors: Partial<Record<keyof T, string>>;
  dirtyFields: (keyof T)[];
  conflicts: (keyof T)[];
  submit: () => boolean;
  reset: () => void;
};
/** A compact replicated field map with optional synchronous validation. */
export function useSharedForm<T extends Record<string, unknown>>(
  room: YRoom | null,
  key: string,
  initial: T,
  validate?: (values: T) => Partial<Record<keyof T, string>>,
): SharedForm<T> {
  const [, rerender] = useState(0);
  const [dirty, setDirty] = useState<(keyof T)[]>([]);
  useEffect(() => {
    if (!room) return;
    const map = room.doc.getMap<unknown>(key);
    const cb = () => rerender((n) => n + 1);
    map.observe(cb);
    return () => map.unobserve(cb);
  }, [room, key]);
  const map = room?.doc.getMap<unknown>(key);
  const values = { ...initial } as T;
  map?.forEach((value, field) => {
    if (field in values) values[field as keyof T] = value as T[keyof T];
  });
  const errors = validate?.(values) ?? {};
  return {
    values,
    errors,
    dirtyFields: dirty,
    conflicts: [],
    setField: (field, value) => {
      if (!map) return;
      map.set(String(field), value);
      setDirty((fields) =>
        fields.includes(field) ? fields : [...fields, field],
      );
    },
    submit: () => Object.keys(errors).length === 0,
    reset: () => {
      if (map) map.clear();
      setDirty([]);
    },
  };
}
