import { useEffect, useState } from "react";
import { MeshShell, useYRoom } from "@baditaflorin/mesh-common";
import { config } from "./config";
import { Feature } from "./Feature";

const ROOM_KEY = `${config.storagePrefix}:room`;

export function App() {
  const [roomId, setRoomId] = useState(() => localStorage.getItem(ROOM_KEY) ?? "default");

  useEffect(() => {
    localStorage.setItem(ROOM_KEY, roomId);
  }, [roomId]);

  const room = useYRoom(config, roomId);

  return (
    <MeshShell config={config} roomId={roomId} onRoomChange={setRoomId}>
      <Feature room={room} config={config} />
    </MeshShell>
  );
}
