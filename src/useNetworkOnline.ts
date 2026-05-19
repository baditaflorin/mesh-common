import { useEffect, useRef, useState } from "react";

/**
 * `navigator.onLine` lies. It returns true the moment a network interface is
 * attached, even if that interface can't reach the public internet (captive
 * portal, school wifi that requires sign-in, LAN-only). `useNetworkOnline`
 * augments it with a small periodic probe: a HEAD against a chosen target.
 *
 *   const { online, lastChange, why } = useNetworkOnline({
 *     probeUrl: "https://www.gstatic.com/generate_204",
 *     probeIntervalMs: 30_000,
 *   });
 *
 * Default probe target is `https://www.gstatic.com/generate_204`, which is
 * Google's well-known captive-portal canary — it always returns 204, zero
 * body. Override `probeUrl` to hit your own signaling server if you prefer.
 *
 * Honest framing: this is a soft signal, not a guarantee. The probe can fail
 * for reasons unrelated to "the user is offline" (CORS, target down). Treat
 * `online === false` as "show the offline badge", not as "stop trying".
 */

export type NetworkOnlineState = {
  /** True if both `navigator.onLine` AND the probe succeeded recently. */
  online: boolean;
  /** ms since epoch of the last transition. */
  lastChange: number;
  /** Most recent reason the state is what it is. */
  why: "navigator" | "probe-ok" | "probe-failed" | "initial";
};

export type NetworkOnlineOptions = {
  /** URL to HEAD. Default: gstatic 204 canary. Must allow CORS. */
  probeUrl?: string;
  /** ms between probes when online. Default 30_000. */
  probeIntervalMs?: number;
  /** ms between probes when offline (faster — to catch recovery). Default 5_000. */
  retryIntervalMs?: number;
  /** Probe timeout. Default 4_000. */
  probeTimeoutMs?: number;
};

const DEFAULT_PROBE = "https://www.gstatic.com/generate_204";

export function useNetworkOnline(opts?: NetworkOnlineOptions): NetworkOnlineState {
  const probeUrl = opts?.probeUrl ?? DEFAULT_PROBE;
  const onlineInterval = opts?.probeIntervalMs ?? 30_000;
  const offlineInterval = opts?.retryIntervalMs ?? 5_000;
  const timeoutMs = opts?.probeTimeoutMs ?? 4_000;

  const [state, setState] = useState<NetworkOnlineState>(() => ({
    online: typeof navigator === "undefined" ? true : navigator.onLine,
    lastChange: Date.now(),
    why: "initial",
  }));
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const transition = (next: boolean, why: NetworkOnlineState["why"]) => {
      setState((prev) =>
        prev.online === next && prev.why === why
          ? prev
          : { online: next, lastChange: Date.now(), why },
      );
    };

    const probe = async () => {
      if (cancelled.current) return;
      // Cheap check first.
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        transition(false, "navigator");
        schedule(false);
        return;
      }
      try {
        const ctrl = new AbortController();
        const to = setTimeout(() => ctrl.abort(), timeoutMs);
        await fetch(probeUrl, { method: "HEAD", mode: "no-cors", cache: "no-store", signal: ctrl.signal });
        clearTimeout(to);
        if (cancelled.current) return;
        transition(true, "probe-ok");
        schedule(true);
      } catch {
        if (cancelled.current) return;
        transition(false, "probe-failed");
        schedule(false);
      }
    };

    const schedule = (currentlyOnline: boolean) => {
      if (cancelled.current) return;
      const wait = currentlyOnline ? onlineInterval : offlineInterval;
      timer = setTimeout(probe, wait);
    };

    const onOnline = () => transition(true, "navigator");
    const onOffline = () => transition(false, "navigator");

    if (typeof window !== "undefined") {
      window.addEventListener("online", onOnline);
      window.addEventListener("offline", onOffline);
    }
    void probe();

    return () => {
      cancelled.current = true;
      if (timer) clearTimeout(timer);
      if (typeof window !== "undefined") {
        window.removeEventListener("online", onOnline);
        window.removeEventListener("offline", onOffline);
      }
    };
  }, [probeUrl, onlineInterval, offlineInterval, timeoutMs]);

  return state;
}
