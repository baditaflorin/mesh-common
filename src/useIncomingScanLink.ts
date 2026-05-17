import { useState } from "react";
import type { MeshConfig } from "./MeshConfig";

export type IncomingScan = {
  /** The room ID extracted from the deep link (already applied to localStorage). */
  roomId: string | null;
  /** The peer ID embedded in the QR (typically the QR-shower's peer ID). */
  peerId: string;
  /** App-specific extra payload (often a name, vCard, or commit hash). */
  extra: string | null;
};

/**
 * One-shot hook that returns the incoming-scan deep-link payload, if any,
 * captured when the app loaded with a `#r=…&p=…&x=…` hash. After consumption
 * the sessionStorage entry is cleared so the value is delivered exactly once
 * per page load.
 *
 * Use this on the receiver side: when alice scans bob's printed QR with her
 * phone camera, alice's browser navigates to bob's app URL, the deep-link
 * already auto-joined alice into bob's room (via `createMeshConfig` side
 * effect), and this hook surfaces `{ peerId: bob, ... }` so the receiving
 * app can immediately act on it — record the recruitment edge, mark bob as
 * scanned, send a thank-you token, etc.
 *
 * Returns `null` when there is no pending deep-link, or after the first
 * mount has already consumed it on this page load.
 */
export function useIncomingScanLink(config: MeshConfig): IncomingScan | null {
  const [state] = useState<IncomingScan | null>(() => {
    if (typeof window === "undefined") return null;
    const key = `${config.storagePrefix}:incoming-scan`;
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return null;
      sessionStorage.removeItem(key);
      const parsed = JSON.parse(raw) as {
        peerId?: string;
        extra?: string | null;
        roomId?: string | null;
      };
      if (!parsed.peerId) return null;
      return {
        peerId: parsed.peerId,
        extra: parsed.extra ?? null,
        roomId: parsed.roomId ?? null,
      };
    } catch {
      return null;
    }
  });
  return state;
}
