import type { MeshConfig, YRoom } from "@baditaflorin/mesh-common";

type Props = { room: YRoom | null; config: MeshConfig };

export function Feature({ room, config }: Props) {
  return (
    <div className="feature-placeholder">
      <h1>{config.appName}</h1>
      <p>{config.description}</p>
      <p className="feature-status">
        {room ? `Connected · ${room.peerCount} peer(s)` : "Connecting…"}
      </p>
    </div>
  );
}
