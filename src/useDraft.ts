import { useCallback, useEffect, useState } from "react";

export type Draft<T> = {
  /** Current draft value. */
  value: T;
  /** Update the draft (persists to localStorage if it differs). */
  setValue: (v: T) => void;
  /**
   * Run `publish(value)` then clear the draft. If `publish` throws or returns
   * `false`, the draft is left intact so the user doesn't lose their typing.
   */
  commit: (publish: (v: T) => boolean | void | Promise<boolean | void>) => Promise<void>;
  /** Reset to the initial value without committing. */
  discard: () => void;
  /** True when `value` differs from the initial value. */
  dirty: boolean;
};

/**
 * Local-only draft that survives reloads. Typed input pattern reused by
 * meme-quote, storyworm, compliment-roulette, shower-thoughts, etc. — anywhere
 * "type privately, then publish to the mesh" is the shape.
 *
 * Storage is intentionally local — drafts are not synced. `commit` is the
 * boundary where draft -> mesh-write happens.
 */
export function useDraft<T extends string | number | boolean | object>(
  storageKey: string,
  initial: T,
): Draft<T> {
  const [value, setValueRaw] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw == null) return initial;
      if (typeof initial === "string") return raw as T;
      return JSON.parse(raw) as T;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      if (typeof value === "string") {
        if (value === "" && typeof initial === "string" && initial === "") {
          localStorage.removeItem(storageKey);
        } else {
          localStorage.setItem(storageKey, value);
        }
      } else {
        localStorage.setItem(storageKey, JSON.stringify(value));
      }
    } catch {
      /* private mode / quota */
    }
  }, [value, storageKey, initial]);

  const setValue = useCallback((v: T) => setValueRaw(v), []);

  const discard = useCallback(() => {
    setValueRaw(initial);
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
  }, [initial, storageKey]);

  const commit: Draft<T>["commit"] = useCallback(
    async (publish) => {
      try {
        const r = await publish(value);
        if (r === false) return;
        setValueRaw(initial);
        try {
          localStorage.removeItem(storageKey);
        } catch {
          /* ignore */
        }
      } catch {
        // leave draft intact
      }
    },
    [value, initial, storageKey],
  );

  const dirty =
    typeof value === "object"
      ? JSON.stringify(value) !== JSON.stringify(initial)
      : value !== initial;

  return { value, setValue, commit, discard, dirty };
}
