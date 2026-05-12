/**
 * App-level config consumed by MeshShell / SettingsDrawer / SelfRefBar.
 * Apps construct this once in src/config.ts and pass it down.
 *
 * The injected globals __APP_VERSION__ and __GIT_COMMIT__ are populated by the
 * Vite `define` block in the per-app vite.config.ts (boilerplate from the
 * scaffold template).
 */

export type MeshConfig = {
  appName: string;
  storagePrefix: string;
  description: string;
  accentHex: string;
  version: string;
  commit: string;
  repositoryUrl: string;
  pagesUrl: string;
  signalingUrl: string;
  turnTokenUrl: string;
  paypalUrl: string;
};

export type MeshConfigInput = {
  appName: string;
  description: string;
  accentHex: string;
  version: string;
  commit: string;
  signalingUrl?: string;
  turnTokenUrl?: string;
  paypalUrl?: string;
};

const DEFAULT_SIGNALING = "wss://turn.0docker.com/ws";
const DEFAULT_TURN_TOKEN = "https://turn.0docker.com/credentials";
const DEFAULT_PAYPAL = "https://www.paypal.com/paypalme/florinbadita";

export function createMeshConfig(input: MeshConfigInput): MeshConfig {
  const storagePrefix = input.appName;
  return {
    appName: input.appName,
    storagePrefix,
    description: input.description,
    accentHex: input.accentHex,
    version: input.version,
    commit: input.commit,
    repositoryUrl: `https://github.com/baditaflorin/${input.appName}`,
    pagesUrl: `https://baditaflorin.github.io/${input.appName}/`,
    signalingUrl: input.signalingUrl ?? DEFAULT_SIGNALING,
    turnTokenUrl: input.turnTokenUrl ?? DEFAULT_TURN_TOKEN,
    paypalUrl: input.paypalUrl ?? DEFAULT_PAYPAL,
  };
}
