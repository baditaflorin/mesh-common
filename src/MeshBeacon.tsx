import { useMeshBeacon, type BeaconParams } from "./useMeshBeacon";

type Props = BeaconParams & { url?: string };

/**
 * Standalone version of `useMeshBeacon`. Lets apps that don't use
 * MeshShell (the 37 legacy holdouts with hand-rolled chrome) mount one
 * tag and inherit pageview beaconing.
 *
 *   <MeshBeacon app={appConfig.appName} room={benchId} />
 *
 * Renders nothing. Pure side-effect host.
 */
export function MeshBeacon(props: Props) {
  const { url, ...rest } = props;
  useMeshBeacon(rest, url);
  return null;
}
