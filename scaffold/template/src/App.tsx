import { useEffect, useState } from "react";
import {
  MeshAppFrame,
  MeshAppProvider,
  MeshThemeProvider,
  useNetworkOnline,
  useRoomLifecycle,
  useYRoom,
} from "@baditaflorin/mesh-common";
import { config } from "./config";
import { Feature } from "./Feature";

const ROOM_KEY = `${config.storagePrefix}:room`;

export function App() {
  const [roomId, setRoomId] = useState(() => localStorage.getItem(ROOM_KEY) ?? "default");

  useEffect(() => {
    localStorage.setItem(ROOM_KEY, roomId);
  }, [roomId]);

  const room = useYRoom(config, roomId);
  const lifecycle = useRoomLifecycle(room);
  // The shared shell needs an honest browser online/offline signal, not an
  // unsolicited third-party reachability request on every first visit.
  // Feature code can opt into a specific probe when that signal matters.
  const network = useNetworkOnline({ probeUrl: false });

  return (
    <MeshThemeProvider tokens={{ accent: config.accentHex }}>
      <MeshAppProvider config={config} room={room} lifecycle={lifecycle} network={network}>
        <MeshAppFrame
          title={config.appName}
          connection={false}
          shell={{ roomId, onRoomChange: setRoomId }}
        >
          <Feature room={room} config={config} />
        </MeshAppFrame>
      </MeshAppProvider>
    </MeshThemeProvider>
  );
}
