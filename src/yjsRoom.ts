import { WebrtcProvider } from "y-webrtc";
import * as Y from "yjs";
import type { IceStorage } from "./iceConfig";
import { loadIceServers, loadSignalingUrl } from "./iceConfig";

export type RoomSync = {
  doc: Y.Doc;
  provider: WebrtcProvider | null;
  signalingUrl: string;
  peerId: string;
};

export function createRoomSync(storagePrefix: string, roomId: string, s: IceStorage): RoomSync {
  const doc = new Y.Doc();
  let provider: WebrtcProvider | null = null;

  const signalingUrl = loadSignalingUrl(s);
  const iceServers = loadIceServers(s);
  const fullRoom = `${storagePrefix}:${roomId}`;

  try {
    provider = new WebrtcProvider(fullRoom, doc, {
      signaling: [signalingUrl],
      peerOpts: { config: { iceServers } },
    });
  } catch (err) {
    console.error("[sync] WebrtcProvider failed:", err);
  }

  const peerId =
    (
      provider as unknown as { awareness?: { clientID: number } } | null
    )?.awareness?.clientID?.toString() ?? crypto.randomUUID();

  return { doc, provider, signalingUrl, peerId };
}
