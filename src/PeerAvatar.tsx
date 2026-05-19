import { sha256 } from "@noble/hashes/sha2.js";
import { useMemo, type CSSProperties, type ReactElement } from "react";

/**
 * Deterministic SVG avatar generated from a peerId / pubkey. Same input →
 * same picture on every device, no network, no PII. Pairs with `tofuRegistry`:
 * a familiar shape doubles as a soft trust cue ("that's the same person").
 *
 * Two variants:
 *   variant="beam"   — soft blob with two contrasting accents (boring-avatars-ish)
 *   variant="grid"   — 5x5 symmetric pixel grid (identicon-style)
 *
 * Honest framing: avatars are *cosmetic* identity. A peer can rotate their
 * keypair and get a new avatar; two peers with related-looking avatars are
 * not necessarily related. Use `trustFingerprint()` for verification.
 */

const enc = new TextEncoder();

function digest(seed: string): Uint8Array {
  return sha256(enc.encode(seed));
}

/** Pick a color from a palette using bytes of the digest. */
function pick<T>(d: Uint8Array, idx: number, palette: readonly T[]): T {
  return palette[(d[idx] ?? 0) % palette.length]!;
}

const PALETTES: readonly (readonly string[])[] = [
  ["#3aa8a1", "#f6c177", "#eb6f92", "#9ccfd8", "#c4a7e7"],
  ["#264653", "#2a9d8f", "#e9c46a", "#f4a261", "#e76f51"],
  ["#ef476f", "#ffd166", "#06d6a0", "#118ab2", "#073b4c"],
  ["#22223b", "#4a4e69", "#9a8c98", "#c9ada7", "#f2e9e4"],
  ["#0f4c5c", "#5f0f40", "#9a031e", "#fb8b24", "#e36414"],
  ["#1d3557", "#457b9d", "#a8dadc", "#e63946", "#f1faee"],
];

export type AvatarVariant = "beam" | "grid";

export type PeerAvatarProps = {
  /** Seed string — typically peerId or pubkey hex. */
  seed: string;
  /** Pixel size of the rendered square. */
  size?: number;
  /** "beam" (default) for a soft blob, "grid" for an identicon. */
  variant?: AvatarVariant;
  /** Border-radius percentage (0 = square, 50 = circle). Defaults to circle. */
  rounded?: number;
  /** Force a specific palette index (mostly for tests / consistency across an app). */
  paletteIndex?: number;
  /** Optional aria-label. Defaults to a peerId-prefix mnemonic. */
  label?: string;
  className?: string;
  style?: CSSProperties;
};

function shortLabel(seed: string): string {
  return `peer ${seed.slice(0, 6)}`;
}

function beamSvg(d: Uint8Array, palette: readonly string[], size: number): string {
  const bg = pick(d, 0, palette);
  const fg = pick(d, 1, palette.filter((c) => c !== bg));
  const accent = pick(d, 2, palette.filter((c) => c !== bg && c !== fg));
  const cx = 20 + ((d[3] ?? 0) % 40);
  const cy = 20 + ((d[4] ?? 0) % 40);
  const r = 30 + ((d[5] ?? 0) % 25);
  const rot = (d[6] ?? 0) % 360;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}">` +
    `<rect width="100" height="100" fill="${bg}"/>` +
    `<g transform="rotate(${rot} 50 50)">` +
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fg}"/>` +
    `<circle cx="${100 - cx}" cy="${100 - cy}" r="${r * 0.6}" fill="${accent}" opacity="0.85"/>` +
    `</g>` +
    `</svg>`
  );
}

function gridSvg(d: Uint8Array, palette: readonly string[], size: number): string {
  const bg = pick(d, 0, palette);
  const fg = pick(d, 1, palette.filter((c) => c !== bg));
  const cells: string[] = [];
  // 5x5 with horizontal symmetry — bits from d[2..14] (13 bytes for 13 cells:
  // 3 columns × 5 rows + 2 extra spare). We use the top 3 columns and mirror.
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 3; x++) {
      const byte = d[2 + y * 3 + x] ?? 0;
      if (byte % 2 === 0) {
        const cellSize = 20;
        cells.push(`<rect x="${x * cellSize}" y="${y * cellSize}" width="${cellSize}" height="${cellSize}" fill="${fg}"/>`);
        if (x < 2) {
          cells.push(`<rect x="${(4 - x) * cellSize}" y="${y * cellSize}" width="${cellSize}" height="${cellSize}" fill="${fg}"/>`);
        }
      }
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}" shape-rendering="crispEdges">` +
    `<rect width="100" height="100" fill="${bg}"/>` +
    cells.join("") +
    `</svg>`
  );
}

export function PeerAvatar({
  seed,
  size = 40,
  variant = "beam",
  rounded = 50,
  paletteIndex,
  label,
  className,
  style,
}: PeerAvatarProps): ReactElement {
  const svgDataUri = useMemo(() => {
    const d = digest(`${variant}|${seed}`);
    const palette =
      typeof paletteIndex === "number"
        ? PALETTES[paletteIndex % PALETTES.length]!
        : PALETTES[(d[7] ?? 0) % PALETTES.length]!;
    const svg = variant === "grid" ? gridSvg(d, palette, size) : beamSvg(d, palette, size);
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }, [seed, size, variant, paletteIndex]);

  return (
    <img
      src={svgDataUri}
      width={size}
      height={size}
      alt={label ?? shortLabel(seed)}
      className={className}
      style={{
        display: "inline-block",
        borderRadius: `${rounded}%`,
        verticalAlign: "middle",
        ...style,
      }}
    />
  );
}
