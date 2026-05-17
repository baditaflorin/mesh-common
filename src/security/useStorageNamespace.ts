import { useMemo } from "react";

/**
 * Namespaced + size-capped localStorage gateway. Replaces direct
 * `localStorage.setItem(...)` calls with a gateway that:
 *
 *   - prefixes every key with the app's storagePrefix (no cross-app collisions
 *     on the same GitHub Pages origin)
 *   - enforces a per-key + total size cap (quota-safe — never throws on
 *     overflow, returns false instead)
 *   - optionally XOR-obfuscates values against an origin-derived pepper
 *     (not real crypto — only defeats casual extension snooping)
 *
 *   const ns = useStorageNamespace(config.storagePrefix);
 *   ns.set("draft", text);
 *   const t = ns.get<string>("draft");
 *
 * Honest scope: localStorage is plaintext to anything with same-origin DOM
 * access. The obfuscation here makes a casual "I dumped localStorage" not
 * yield instantly-readable secrets, but is not a substitute for real
 * encryption. Use `useEphemeralKey` for that.
 */

export type StorageNamespace = {
  /** Read a value (JSON-decoded). Returns null if absent or unparseable. */
  get: <T = unknown>(key: string) => T | null;
  /**
   * Write a value (JSON-encoded). Returns true on success, false if the
   * write would exceed `maxBytesTotal` or `maxBytesPerKey` (in which case
   * the previous value is preserved).
   */
  set: (key: string, value: unknown) => boolean;
  /** Delete a key. */
  remove: (key: string) => void;
  /** List all keys in this namespace (without the prefix). */
  keys: () => string[];
  /** Total bytes used by this namespace. */
  size: () => number;
  /** Clear every key in this namespace. */
  clear: () => void;
};

export type StorageNamespaceOptions = {
  /** Per-key max bytes. Default 64 KB. */
  maxBytesPerKey?: number;
  /** Total namespace max bytes. Default 1 MB. */
  maxBytesTotal?: number;
  /** Apply XOR obfuscation against origin-derived pepper. Default false. */
  obfuscate?: boolean;
};

function xor(s: string, pepper: string): string {
  const out = new Array<number>(s.length);
  for (let i = 0; i < s.length; i++) {
    out[i] = s.charCodeAt(i) ^ pepper.charCodeAt(i % pepper.length);
  }
  return String.fromCharCode(...out);
}

function pepperFor(prefix: string): string {
  const origin = typeof window === "undefined" ? "node" : window.location.origin;
  // Cheap deterministic per-app per-origin pepper. Not for secrecy — for
  // making the bytes non-obviously the same across apps + origins.
  let h = 5381;
  for (const c of `${origin}|${prefix}`) h = ((h << 5) + h + c.charCodeAt(0)) & 0xffffffff;
  return String.fromCharCode((h & 0xff) || 1, ((h >> 8) & 0xff) || 1, ((h >> 16) & 0xff) || 1, ((h >> 24) & 0xff) || 1);
}

export function useStorageNamespace(
  prefix: string,
  opts: StorageNamespaceOptions = {},
): StorageNamespace {
  return useMemo<StorageNamespace>(() => {
    const maxPerKey = opts.maxBytesPerKey ?? 65_536;
    const maxTotal = opts.maxBytesTotal ?? 1_048_576;
    const obf = !!opts.obfuscate;
    const pepper = obf ? pepperFor(prefix) : "";
    const ns = `${prefix}:`;

    const safe = (): Storage | null => {
      try {
        return typeof localStorage !== "undefined" ? localStorage : null;
      } catch {
        return null;
      }
    };

    const keys: StorageNamespace["keys"] = () => {
      const ls = safe();
      if (!ls) return [];
      const out: string[] = [];
      for (let i = 0; i < ls.length; i++) {
        const k = ls.key(i);
        if (k && k.startsWith(ns)) out.push(k.slice(ns.length));
      }
      return out;
    };

    const size: StorageNamespace["size"] = () => {
      const ls = safe();
      if (!ls) return 0;
      let total = 0;
      for (const k of keys()) {
        const v = ls.getItem(ns + k);
        if (v) total += v.length + ns.length + k.length;
      }
      return total;
    };

    return {
      get<T>(key: string): T | null {
        const ls = safe();
        if (!ls) return null;
        const raw = ls.getItem(ns + key);
        if (raw == null) return null;
        const dec = obf ? xor(raw, pepper) : raw;
        try {
          return JSON.parse(dec) as T;
        } catch {
          return null;
        }
      },
      set(key, value) {
        const ls = safe();
        if (!ls) return false;
        let payload: string;
        try {
          payload = JSON.stringify(value);
        } catch {
          return false;
        }
        const encoded = obf ? xor(payload, pepper) : payload;
        if (encoded.length > maxPerKey) return false;
        const projected = size() - (ls.getItem(ns + key)?.length ?? 0) + encoded.length;
        if (projected > maxTotal) return false;
        try {
          ls.setItem(ns + key, encoded);
          return true;
        } catch {
          return false;
        }
      },
      remove(key) {
        const ls = safe();
        if (!ls) return;
        try {
          ls.removeItem(ns + key);
        } catch {
          /* ignore */
        }
      },
      keys,
      size,
      clear() {
        const ls = safe();
        if (!ls) return;
        for (const k of keys()) ls.removeItem(ns + k);
      },
    };
  }, [prefix, opts.maxBytesPerKey, opts.maxBytesTotal, opts.obfuscate]);
}
