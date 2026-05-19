import { type CSSProperties, type ReactElement } from "react";
import { PeerAvatar, type AvatarVariant } from "./PeerAvatar";
import { useFleetPersona } from "./useFleetPersona";
import { avatarSeedFor, displayLabel } from "./fleetPersona";

/**
 * Drop-in avatar for the *current* fleet persona. Reuses PeerAvatar for
 * rendering, so:
 *
 *   - same seed → same picture across every app, every device, no network
 *   - the persona's `avatarVariant` / `paletteIndex` override the seed-derived
 *     palette when set
 *   - if the user clears their persona, this falls back to a sensible default
 *     ("anon") so nothing crashes mid-render
 *
 * For peer-avatars (other people in the room) keep using `<PeerAvatar />`
 * directly with their peerId. This component is for the *signed-in* user.
 */
export type FleetAvatarProps = {
  appName: string;
  size?: number;
  variant?: AvatarVariant;
  rounded?: number;
  className?: string;
  style?: CSSProperties;
  /** Override label; defaults to the persona's display label or "you". */
  label?: string;
  /** Optional overrides — useful when the host already has the persona. */
  seedOverride?: string;
  variantOverride?: AvatarVariant;
  paletteIndexOverride?: number;
};

export function FleetAvatar({
  appName,
  size = 40,
  variant,
  rounded = 50,
  className,
  style,
  label,
  seedOverride,
  variantOverride,
  paletteIndexOverride,
}: FleetAvatarProps): ReactElement {
  const { persona } = useFleetPersona({ appName });
  const seed = seedOverride ?? avatarSeedFor(persona);
  const effectiveVariant = variantOverride ?? variant ?? persona.avatarVariant ?? "beam";
  const paletteIndex = paletteIndexOverride ?? persona.paletteIndex;
  const altLabel = label ?? displayLabel(persona) ?? "you";
  return (
    <PeerAvatar
      seed={seed}
      size={size}
      variant={effectiveVariant}
      rounded={rounded}
      paletteIndex={paletteIndex}
      className={className}
      style={style}
      label={altLabel}
    />
  );
}
