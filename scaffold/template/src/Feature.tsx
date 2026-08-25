import {
  MeshPresence,
  MeshStatusPill,
  MeshSurface,
  type MeshConfig,
  type YRoom,
} from "@baditaflorin/mesh-common";

type Props = { room: YRoom | null; config: MeshConfig };

export function Feature({ room, config }: Props) {
  const peopleHere = room ? room.peerCount + 1 : 1;
  return (
    <MeshSurface as="section" tone="raised" padding="lg" className="feature-starter">
      <p className="feature-starter-eyebrow">Shared space</p>
      <h2>Make the moment visible.</h2>
      <p>{config.description}</p>
      <div className="feature-starter-status">
        <MeshPresence
          count={peopleHere}
          label="ready in this room"
          state={room ? "connected" : "connecting"}
        />
        <MeshStatusPill tone={room ? "live" : "warning"} dot>
          {room ? "Live session" : "Preparing session"}
        </MeshStatusPill>
      </div>
      <p className="feature-starter-note">
        Replace this starter surface with the real object people will share.
      </p>
    </MeshSurface>
  );
}
