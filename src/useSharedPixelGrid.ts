import { useEffect, useState } from "react";
import type { YRoom } from "./useYRoom";

const MAX_PIXELS = 1_024;
const COLOR = /^#[0-9a-f]{6}$/i;

export type SharedPixel = {
  x: number;
  y: number;
  color: string;
  updatedBy: string;
};

function isCoordinate(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value < 64
  );
}

function isColor(value: unknown): value is string {
  return typeof value === "string" && COLOR.test(value);
}

function cellKey(x: number, y: number) {
  return `${x}:${y}`;
}

function isPixel(value: unknown): value is SharedPixel {
  if (!value || typeof value !== "object") return false;
  const pixel = value as Partial<SharedPixel>;
  return (
    isCoordinate(pixel.x) &&
    isCoordinate(pixel.y) &&
    isColor(pixel.color) &&
    typeof pixel.updatedBy === "string" &&
    pixel.updatedBy.trim().length > 0 &&
    pixel.updatedBy.length <= 120
  );
}

/**
 * A deliberately small shared pixel canvas (up to 32×32 cells).
 *
 * It stores only occupied cells in a Y.Map, so collaborative mosaics and
 * emoji-like pixel art remain compact. The bounds and CSS colour validation
 * prevent a room from receiving an unbounded grid or arbitrary style values.
 */
export function useSharedPixelGrid(
  room: YRoom | null,
  key = "pixel-grid",
  options: { width?: number; height?: number } = {},
) {
  const [, rerender] = useState(0);
  const width = Math.max(1, Math.min(32, Math.floor(options.width ?? 16)));
  const height = Math.max(1, Math.min(32, Math.floor(options.height ?? 16)));

  useEffect(() => {
    if (!room) return;
    const map = room.doc.getMap<SharedPixel>(key);
    const update = () => rerender((version) => version + 1);
    map.observe(update);
    return () => map.unobserve(update);
  }, [room, key]);

  const map = room?.doc.getMap<SharedPixel>(key) ?? null;
  const pixels = [...(map?.values() ?? [])]
    .filter(isPixel)
    .filter((pixel) => pixel.x < width && pixel.y < height)
    .sort((a, b) => a.y - b.y || a.x - b.x);

  return {
    width,
    height,
    pixels,
    get: (x: number, y: number) => {
      const pixel = map?.get(cellKey(x, y));
      return isPixel(pixel) ? pixel : null;
    },
    set: (x: number, y: number, color: string) => {
      if (
        !room ||
        !map ||
        !Number.isInteger(x) ||
        !Number.isInteger(y) ||
        x < 0 ||
        y < 0 ||
        x >= width ||
        y >= height ||
        !isColor(color) ||
        (!map.has(cellKey(x, y)) && map.size >= MAX_PIXELS)
      ) {
        return false;
      }
      map.set(cellKey(x, y), {
        x,
        y,
        color: color.toLowerCase(),
        updatedBy: room.peerId,
      });
      return true;
    },
    erase: (x: number, y: number) => {
      if (!map || !Number.isInteger(x) || !Number.isInteger(y)) return false;
      const keyForCell = cellKey(x, y);
      if (!map.has(keyForCell)) return false;
      map.delete(keyForCell);
      return true;
    },
    clear: () => {
      if (!map || map.size === 0) return false;
      map.clear();
      return true;
    },
  };
}
