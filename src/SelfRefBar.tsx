import type { MeshConfig } from "./MeshConfig";

type Props = { config: MeshConfig };

export function SelfRefBar({ config }: Props) {
  return (
    <div className="mesh-self-ref">
      <a href={config.repositoryUrl} target="_blank" rel="noreferrer">
        source
      </a>
      <span aria-hidden="true">·</span>
      <a href={config.paypalUrl} target="_blank" rel="noreferrer">
        tip ♥
      </a>
      <span aria-hidden="true">·</span>
      <span>
        v{config.version} · {config.commit}
      </span>
    </div>
  );
}
