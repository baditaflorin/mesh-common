import { useAwareness } from "./useAwareness";
import type { YRoom } from "./useYRoom";

export type PeerCapabilities = Record<string, boolean>;

/** Ephemeral capability negotiation so rooms can select features everyone can use. */
export function usePeerCapabilities(room: YRoom | null, initial: PeerCapabilities = {}) {
  const awareness = useAwareness<{ capabilities?: PeerCapabilities }>(room);
  const mine = awareness.local?.capabilities ?? initial;
  const peers = new Map<string, PeerCapabilities>();
  awareness.peers.forEach((state, peerId) => peers.set(peerId, state.capabilities ?? {}));
  const supports = (capability: string) =>
    Boolean(mine[capability]) && [...peers.values()].every((peer) => Boolean(peer[capability]));
  return {
    mine,
    peers,
    supports,
    setMine: (capabilities: PeerCapabilities) => awareness.setLocal({ capabilities }),
  };
}
