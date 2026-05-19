import { useEffect, useMemo, useRef, type CSSProperties, type ReactElement } from "react";
import { createElement, Fragment } from "react";
import { useAwareness } from "./useAwareness";
import type { YRoom } from "./useYRoom";

/**
 * Figma-style live cursors over a `useAwareness`-backed room. One hook
 * handles broadcast (throttled to ~30 Hz), peer fan-in, and a `<CursorLayer/>`
 * SVG layer ready to drop into any element.
 *
 *   const { CursorLayer, setLocalCursor, peers } = usePresenceCursors(room);
 *   return (
 *     <div onPointerMove={(e) => setLocalCursor({ x: e.clientX, y: e.clientY })}>
 *       ... your app ...
 *       <CursorLayer />
 *     </div>
 *   );
 *
 * Coordinates are whatever the caller chooses. For document-relative cursors,
 * pass `clientX/clientY - rect.left/top`. For viewport-relative, just pass
 * `clientX/clientY`. Up to the app.
 *
 * Cosmetic: each peer is colored deterministically by their peerId. Past 10
 * peers the layer gets noisy — caller can pass `maxRender` to cap rendered
 * cursors (oldest-seen drops first).
 */

export type CursorState = {
  x: number;
  y: number;
  /** Optional display name, surfaces in a tiny label next to the cursor. */
  name?: string;
};

export type PresenceCursorsApi = {
  /** Awareness-derived peers (others), most-recently-updated first. */
  peers: Array<{ peerId: string; cursor: CursorState; color: string }>;
  /** Update the local cursor. Pass null to clear (peer leaves the canvas). */
  setLocalCursor: (cursor: CursorState | null) => void;
  /** Inline SVG layer — drop inside the element whose coords you broadcast. */
  CursorLayer: () => ReactElement | null;
};

export type PresenceCursorsOptions = {
  /** ms between broadcast updates. Default 33 (~30 Hz). */
  throttleMs?: number;
  /** Max cursors to render. Default 20 (room peer cap is the real limit). */
  maxRender?: number;
  /** Cursor SVG size in px. Default 18. */
  size?: number;
};

const PALETTE = [
  "#ef476f", "#f78c6b", "#ffd166", "#06d6a0",
  "#118ab2", "#073b4c", "#9b5de5", "#f15bb5",
  "#00bbf9", "#00f5d4", "#fb6f92", "#ff9770",
];

function colorFor(peerId: string): string {
  let h = 0;
  for (let i = 0; i < peerId.length; i++) h = ((h << 5) - h + peerId.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length]!;
}

export function usePresenceCursors(
  room: YRoom | null,
  opts?: PresenceCursorsOptions,
): PresenceCursorsApi {
  const throttleMs = opts?.throttleMs ?? 33;
  const maxRender = opts?.maxRender ?? 20;
  const size = opts?.size ?? 18;

  const awareness = useAwareness<{ cursor: CursorState | null }>(room);
  const lastSendAt = useRef(0);
  const pending = useRef<CursorState | null | undefined>(undefined);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setLocalCursor = (cursor: CursorState | null) => {
    pending.current = cursor;
    const dt = Date.now() - lastSendAt.current;
    if (dt >= throttleMs) {
      lastSendAt.current = Date.now();
      awareness.setLocal({ cursor });
      pending.current = undefined;
    } else if (!flushTimer.current) {
      flushTimer.current = setTimeout(() => {
        flushTimer.current = null;
        if (pending.current !== undefined) {
          lastSendAt.current = Date.now();
          awareness.setLocal({ cursor: pending.current as CursorState | null });
          pending.current = undefined;
        }
      }, throttleMs - dt);
    }
  };

  useEffect(() => {
    return () => {
      if (flushTimer.current) clearTimeout(flushTimer.current);
    };
  }, []);

  const peers = useMemo(() => {
    const out: Array<{ peerId: string; cursor: CursorState; color: string }> = [];
    for (const [peerId, state] of awareness.peers.entries()) {
      const c = state.cursor;
      if (!c) continue;
      out.push({ peerId, cursor: c, color: colorFor(peerId) });
      if (out.length >= maxRender) break;
    }
    return out;
  }, [awareness.peers, maxRender]);

  const CursorLayer = (): ReactElement | null => {
    if (peers.length === 0) return null;
    const layerStyle: CSSProperties = {
      position: "absolute",
      inset: 0,
      pointerEvents: "none",
      overflow: "hidden",
      zIndex: 50,
    };
    return createElement(
      "div",
      { "aria-hidden": true, style: layerStyle },
      ...peers.map((p) =>
        createElement(
          Fragment,
          { key: p.peerId },
          createElement(
            "svg",
            {
              width: size,
              height: size,
              viewBox: "0 0 24 24",
              style: {
                position: "absolute",
                left: p.cursor.x,
                top: p.cursor.y,
                transform: "translate(-2px, -2px)",
                transition: "left 80ms linear, top 80ms linear",
              },
            },
            createElement("path", {
              d: "M3 2 L20 12 L12 13 L9 21 Z",
              fill: p.color,
              stroke: "#fff",
              strokeWidth: 1.5,
              strokeLinejoin: "round",
            }),
          ),
          p.cursor.name
            ? createElement(
                "span",
                {
                  style: {
                    position: "absolute",
                    left: p.cursor.x + size * 0.7,
                    top: p.cursor.y + size * 0.7,
                    background: p.color,
                    color: "#fff",
                    fontSize: 11,
                    lineHeight: "14px",
                    padding: "1px 5px",
                    borderRadius: 3,
                    whiteSpace: "nowrap",
                    fontFamily: "system-ui, sans-serif",
                  },
                },
                p.cursor.name,
              )
            : null,
        ),
      ),
    );
  };

  return { peers, setLocalCursor, CursorLayer };
}
