import { useCallback, useRef, useState } from "react";

export type GestureKind = "tap" | "pan" | "pinch" | "rotate" | "swipe" | "none";

export type GestureState = {
  /** Currently active gesture (or "none"). */
  kind: GestureKind;
  /** Current pan delta from the gesture origin (px). */
  dx: number;
  dy: number;
  /** Scale factor relative to gesture start (1 = no change). */
  scale: number;
  /** Rotation in degrees relative to gesture start. */
  rotation: number;
  /** Most recent swipe direction, set on swipe end. */
  swipeDir: "up" | "down" | "left" | "right" | null;
  /** Spread these onto the gesturable element: `{...gesture.handlers}`. */
  handlers: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: (e: React.PointerEvent) => void;
    onPointerCancel: (e: React.PointerEvent) => void;
  };
};

type ActivePointer = { id: number; x: number; y: number; sx: number; sy: number };

function dist(a: ActivePointer, b: ActivePointer): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function angle(a: ActivePointer, b: ActivePointer): number {
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
}

/**
 * Pointer-events gesture recognizer: tap / pan / pinch / two-finger-rotate
 * / swipe. iOS-friendly — uses Pointer Events which work in Safari.
 *
 *   const gesture = useGesture();
 *   <div {...gesture.handlers}>
 *     content (dx: {gesture.dx}, scale: {gesture.scale})
 *   </div>
 *
 * Single-finger drag → pan (dx/dy). Two-finger pinch → scale + rotation.
 * Short fast single-finger movement that ends → swipe (swipeDir).
 */
export function useGesture(opts?: {
  swipeThresholdPx?: number;
  swipeMaxMs?: number;
}): GestureState {
  const swipePx = opts?.swipeThresholdPx ?? 50;
  const swipeMs = opts?.swipeMaxMs ?? 400;
  const pointers = useRef<Map<number, ActivePointer>>(new Map());
  const startAt = useRef(0);
  const startDist = useRef(0);
  const startAngle = useRef(0);
  const [state, setState] = useState<Omit<GestureState, "handlers">>({
    kind: "none",
    dx: 0,
    dy: 0,
    scale: 1,
    rotation: 0,
    swipeDir: null,
  });

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      sx: e.clientX,
      sy: e.clientY,
    });
    if (pointers.current.size === 1) {
      startAt.current = Date.now();
      setState({ kind: "tap", dx: 0, dy: 0, scale: 1, rotation: 0, swipeDir: null });
    } else if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      if (a && b) {
        startDist.current = dist(a, b);
        startAngle.current = angle(a, b);
      }
    }
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const p = pointers.current.get(e.pointerId);
    if (!p) return;
    p.x = e.clientX;
    p.y = e.clientY;
    if (pointers.current.size === 1) {
      const dx = p.x - p.sx;
      const dy = p.y - p.sy;
      if (Math.hypot(dx, dy) > 5) {
        setState((s) => ({ ...s, kind: "pan", dx, dy }));
      }
    } else if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      if (a && b && startDist.current > 0) {
        const curDist = dist(a, b);
        const curAng = angle(a, b);
        setState({
          kind: "pinch",
          dx: 0,
          dy: 0,
          scale: curDist / startDist.current,
          rotation: curAng - startAngle.current,
          swipeDir: null,
        });
      }
    }
  }, []);

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const p = pointers.current.get(e.pointerId);
      pointers.current.delete(e.pointerId);
      if (p && pointers.current.size === 0) {
        const dt = Date.now() - startAt.current;
        const dx = p.x - p.sx;
        const dy = p.y - p.sy;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        let swipeDir: GestureState["swipeDir"] = null;
        if (dt < swipeMs && Math.max(absDx, absDy) > swipePx) {
          swipeDir = absDx > absDy ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
        }
        setState({
          kind: swipeDir ? "swipe" : "none",
          dx: 0,
          dy: 0,
          scale: 1,
          rotation: 0,
          swipeDir,
        });
      }
    },
    [swipeMs, swipePx],
  );

  const onPointerCancel = useCallback((e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    setState({ kind: "none", dx: 0, dy: 0, scale: 1, rotation: 0, swipeDir: null });
  }, []);

  return {
    ...state,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
  };
}
