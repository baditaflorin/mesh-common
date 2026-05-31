import { useEffect, useState } from "react";
import type { YRoom } from "./useYRoom";

/**
 * One committed pen stroke. `points` is a flat `[x0, y0, x1, y1, …]` list in
 * canvas coordinates — the shape mesh-pictionary defined locally before this
 * hook lifted it into mesh-common. (The other freehand-survey candidates —
 * exquisite-corpse, brain-write, light-paint, retro — turned out to use Y.Map
 * strips / text models / procedural canvases, not a shared stroke list.)
 */
export type Stroke = {
  /** Peer who drew this stroke. */
  peerId: string;
  /** CSS color string. */
  color: string;
  /** Line width in px. */
  width: number;
  /** Flat point list: `[x0, y0, x1, y1, …]`. */
  points: number[];
};

export type SharedStrokesApi = {
  /** Every committed stroke from all peers, in draw order. */
  strokes: Stroke[];
  /**
   * Commit a finished stroke (call on pointer-up). Draw locally for snappy
   * feedback while the pointer is down, then hand the full point list here.
   * Ignores empty or odd-length point lists.
   */
  add: (points: number[], style?: { color?: string; width?: number }) => void;
  /** Remove every stroke (all peers'). */
  clear: () => void;
  /** Remove the most recent stroke; pass a `peerId` to undo only that peer's last. */
  undoLast: (peerId?: string) => void;
  /**
   * Replay every committed stroke onto a 2D context — the duplicated
   * `strokes.forEach(… ctx.stroke())` loop, lifted. Pass `{ clear: true }` to
   * wipe the canvas first (`width`/`height` default to the canvas size).
   */
  replay: (
    ctx: CanvasRenderingContext2D,
    opts?: { clear?: boolean; width?: number; height?: number },
  ) => void;
};

const DEFAULT_KEY = "strokes";

/**
 * Collaborative freehand drawing backed by `Y.Array<Stroke>`. The app owns the
 * canvas and pointer handling (draw the in-progress stroke locally for low
 * latency); this hook owns replication, the replay loop, clear and undo.
 *
 *   const draw = useSharedStrokes(room, { color, width: 3 });
 *   // onPointerUp: draw.add(localPoints, { color, width });
 *   // in a layout effect: draw.replay(ctx, { clear: true });
 */
export function useSharedStrokes(
  room: YRoom | null,
  opts?: { key?: string; color?: string; width?: number; peerId?: string },
): SharedStrokesApi {
  const key = opts?.key ?? DEFAULT_KEY;
  const [, rerender] = useState(0);

  useEffect(() => {
    if (!room) return;
    const arr = room.doc.getArray<Stroke>(key);
    const cb = () => rerender((n) => n + 1);
    arr.observe(cb);
    return () => arr.unobserve(cb);
  }, [room, key]);

  const arr = room ? room.doc.getArray<Stroke>(key) : null;
  const strokes = arr ? arr.toArray() : [];
  const peerId = opts?.peerId ?? room?.peerId ?? "";
  const defColor = opts?.color ?? "#222";
  const defWidth = opts?.width ?? 3;

  return {
    strokes,
    add: (points, style) => {
      if (!arr) return;
      if (!points || points.length < 4 || points.length % 2 !== 0) return;
      arr.push([
        {
          peerId,
          color: style?.color ?? defColor,
          width: style?.width ?? defWidth,
          points: points.slice(),
        },
      ]);
    },
    clear: () => {
      if (!arr) return;
      arr.delete(0, arr.length);
    },
    undoLast: (pid) => {
      if (!arr || arr.length === 0) return;
      if (pid === undefined) {
        arr.delete(arr.length - 1, 1);
        return;
      }
      const list = arr.toArray();
      for (let i = list.length - 1; i >= 0; i--) {
        if (list[i]?.peerId === pid) {
          arr.delete(i, 1);
          return;
        }
      }
    },
    replay: (ctx, o) => {
      if (o?.clear) {
        const w = o.width ?? ctx.canvas.width;
        const h = o.height ?? ctx.canvas.height;
        ctx.clearRect(0, 0, w, h);
      }
      for (const s of strokes) {
        const pts = s.points;
        if (pts.length < 4) continue;
        ctx.beginPath();
        ctx.strokeStyle = s.color;
        ctx.lineWidth = s.width;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.moveTo(pts[0]!, pts[1]!);
        for (let i = 2; i + 1 < pts.length; i += 2) {
          ctx.lineTo(pts[i]!, pts[i + 1]!);
        }
        ctx.stroke();
      }
    },
  };
}
