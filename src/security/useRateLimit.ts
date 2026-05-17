import { useCallback, useRef } from "react";

export type RateLimitState = {
  /** Try to take a token. Returns true if allowed, false if rate-limited. */
  take: (key?: string) => boolean;
  /** Check without consuming. */
  peek: (key?: string) => boolean;
  /** Reset all buckets (or one by key). */
  reset: (key?: string) => void;
  /** ms remaining until the next allowed call for a key. 0 if free. */
  msUntilNext: (key?: string) => number;
};

/**
 * Client-side rate limiter via a token-bucket per key. Use for any user
 * action that can spam-loop the mesh (vote, send, react, claim).
 *
 *   const limit = useRateLimit({ max: 5, perMs: 60_000 });
 *   onSubmit = () => {
 *     if (!limit.take()) return pushUiToast.warning("slow down");
 *     doSubmit();
 *   };
 *
 * Pass `key` to take/peek/reset to manage multiple independent buckets in
 * one hook instance (e.g. `take("react:" + itemId)` per-item reactions).
 */
export function useRateLimit(opts: {
  /** Maximum tokens in the bucket. Default 1. */
  max?: number;
  /** Refill the bucket fully every `perMs` ms. */
  perMs: number;
}): RateLimitState {
  const max = opts.max ?? 1;
  const perMs = opts.perMs;
  type Bucket = { tokens: number; lastRefillAt: number };
  const bucketsRef = useRef<Map<string, Bucket>>(new Map());

  const refill = (b: Bucket, now: number) => {
    const elapsed = now - b.lastRefillAt;
    if (elapsed >= perMs) {
      b.tokens = max;
      b.lastRefillAt = now;
    } else {
      // Continuous refill: gain (elapsed/perMs)*max tokens since last update.
      const gained = (elapsed / perMs) * max;
      b.tokens = Math.min(max, b.tokens + gained);
      b.lastRefillAt = now;
    }
  };

  const get = (key: string): Bucket => {
    let b = bucketsRef.current.get(key);
    if (!b) {
      b = { tokens: max, lastRefillAt: Date.now() };
      bucketsRef.current.set(key, b);
    }
    return b;
  };

  const take = useCallback(
    (key = "__default") => {
      const b = get(key);
      refill(b, Date.now());
      if (b.tokens >= 1) {
        b.tokens -= 1;
        return true;
      }
      return false;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [perMs, max],
  );

  const peek = useCallback(
    (key = "__default") => {
      const b = get(key);
      refill(b, Date.now());
      return b.tokens >= 1;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [perMs, max],
  );

  const reset = useCallback((key?: string) => {
    if (key) bucketsRef.current.delete(key);
    else bucketsRef.current.clear();
  }, []);

  const msUntilNext = useCallback(
    (key = "__default") => {
      const b = get(key);
      refill(b, Date.now());
      if (b.tokens >= 1) return 0;
      const need = 1 - b.tokens;
      return Math.ceil((need / max) * perMs);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [perMs, max],
  );

  return { take, peek, reset, msUntilNext };
}
