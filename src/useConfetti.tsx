import { useCallback, useEffect, useState } from "react";

export type ConfettiBurst = {
  id: string;
  origin: "top" | "center" | "bottom" | { x: number; y: number };
  count: number;
  hueRange: [number, number];
  ts: number;
  ttlMs: number;
};

type Listener = (b: ConfettiBurst) => void;

const listeners: Set<Listener> = new Set();

function newId(): string {
  return Math.random().toString(36).slice(2, 12);
}

/**
 * Imperatively trigger a confetti burst from any handler. CSS-only — zero
 * canvas, zero animation libraries. Per gotcha #3 the rendered elements are
 * decorative; tests must not target them for assertions.
 *
 * Uses a module-level event bus so any caller can `burst()` regardless of
 * whether `<ConfettiLayer/>` is a parent, sibling, or absent (no-op when
 * absent — never throws).
 *
 *   const { burst } = useConfetti();
 *   onWin = () => burst({ origin: "top", count: 80, hueRange: [40, 60] });
 */
export function useConfetti() {
  const burst = useCallback((b?: Partial<Omit<ConfettiBurst, "id" | "ts">>) => {
    const full: ConfettiBurst = {
      id: newId(),
      ts: Date.now(),
      origin: b?.origin ?? "top",
      count: b?.count ?? 60,
      hueRange: b?.hueRange ?? [0, 360],
      ttlMs: b?.ttlMs ?? 1800,
    };
    listeners.forEach((l) => l(full));
  }, []);
  return { burst };
}

type Particle = {
  id: string;
  left: number;
  top: number;
  hue: number;
  rot: number;
  ttl: number;
};

function hashSeed(s: string, n: number): number {
  let h = 0;
  for (let k = 0; k < s.length; k++) h = (h * 31 + s.charCodeAt(k)) | 0;
  return (Math.abs(h + n * 2654435761) % 10000) / 10000;
}

/**
 * Drop-in confetti renderer. Mount once near the root (alongside
 * `<MeshShell/>`). Decorative only — no pointer events, no aria role, never
 * asserted by tests.
 */
export function ConfettiLayer() {
  const [bursts, setBursts] = useState<ConfettiBurst[]>([]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const listener: Listener = (b) => setBursts((cur) => [...cur, b]);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      setBursts((cur) => cur.filter((b) => b.ts + b.ttlMs > t));
    }, 200);
    return () => clearInterval(id);
  }, []);

  const particles: Particle[] = [];
  for (const b of bursts) {
    const age = now - b.ts;
    if (age > b.ttlMs) continue;
    const progress = age / b.ttlMs;
    for (let i = 0; i < b.count; i++) {
      const seed = `${b.id}:${i}`;
      const originX = typeof b.origin === "object" ? b.origin.x : 50;
      const originY =
        typeof b.origin === "object"
          ? b.origin.y
          : b.origin === "top"
            ? 0
            : b.origin === "bottom"
              ? 100
              : 50;
      const angle = hashSeed(seed, 1) * Math.PI * 2;
      const speed = 30 + hashSeed(seed, 2) * 50;
      const hue = b.hueRange[0] + hashSeed(seed, 3) * (b.hueRange[1] - b.hueRange[0]);
      const dx = Math.cos(angle) * speed * progress;
      const dy = Math.sin(angle) * speed * progress + 60 * progress * progress;
      particles.push({
        id: `${b.id}:${i}`,
        left: originX + dx,
        top: originY + dy,
        hue,
        rot: hashSeed(seed, 4) * 360 + age / 4,
        ttl: 1 - progress,
      });
    }
  }

  return (
    <div className="mesh-confetti-layer" aria-hidden="true">
      {particles.map((p) => (
        <span
          key={p.id}
          className="mesh-confetti-piece"
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            opacity: p.ttl,
            backgroundColor: `hsl(${p.hue} 90% 60%)`,
            transform: `rotate(${p.rot}deg)`,
          }}
        />
      ))}
    </div>
  );
}
