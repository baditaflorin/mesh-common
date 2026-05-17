import { useCallback, useEffect, useRef, useState } from "react";

export type MicLevel = {
  /** Smoothed RMS amplitude 0..1. */
  level: number;
  /** Peak smoothed level seen since last reset. */
  peakLevel: number;
  /** Convenience: `level > loudThreshold`. */
  isLoud: boolean;
  /** Reset `peakLevel` to 0. */
  resetPeak: () => void;
  /** True once the mic stream is open. */
  armed: boolean;
  /** Most recent error message from getUserMedia, if any. */
  error: string | null;
};

/**
 * Mic-input amplitude with smoothing. iOS Safari requires a prior user
 * gesture; pair with `<ArmGate>` (or wire `arm` to a button).
 *
 * Tears down the AudioContext + MediaStreamTrack on unmount. Pass `armed: false`
 * to skip mic acquisition (the hook returns zero level until armed).
 */
export function useMicLevel(opts?: {
  armed?: boolean;
  smoothMs?: number;
  loudThreshold?: number;
}): MicLevel {
  const armed = opts?.armed ?? true;
  const smoothMs = opts?.smoothMs ?? 80;
  const loudThreshold = opts?.loudThreshold ?? 0.4;

  const [level, setLevel] = useState(0);
  const [peakLevel, setPeakLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isArmed, setIsArmed] = useState(false);
  const peakRef = useRef(0);
  const smoothRef = useRef(0);
  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const teardown = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    setIsArmed(false);
  }, []);

  useEffect(() => {
    if (!armed) {
      teardown();
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
          setError("mediaDevices unavailable");
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AC();
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        src.connect(analyser);
        streamRef.current = stream;
        ctxRef.current = ctx;
        setIsArmed(true);

        const buf = new Uint8Array(analyser.fftSize);
        const alpha = Math.min(1, Math.max(0, 16 / Math.max(16, smoothMs)));

        const loop = () => {
          analyser.getByteTimeDomainData(buf);
          let sumSq = 0;
          for (let i = 0; i < buf.length; i++) {
            const v = (buf[i]! - 128) / 128;
            sumSq += v * v;
          }
          const rms = Math.sqrt(sumSq / buf.length);
          smoothRef.current = smoothRef.current * (1 - alpha) + rms * alpha;
          const lv = Math.min(1, smoothRef.current * 1.6);
          setLevel(lv);
          if (lv > peakRef.current) {
            peakRef.current = lv;
            setPeakLevel(lv);
          }
          rafRef.current = requestAnimationFrame(loop);
        };
        loop();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
      teardown();
    };
  }, [armed, smoothMs, teardown]);

  return {
    level,
    peakLevel,
    isLoud: level > loudThreshold,
    resetPeak: () => {
      peakRef.current = 0;
      setPeakLevel(0);
    },
    armed: isArmed,
    error,
  };
}

type ArmGateProps = {
  /** Renders the gated UI once the user has tapped to arm. */
  children: (armed: boolean) => React.ReactNode;
  /** Button label before the user has tapped. */
  label?: string;
  /** Optional helper text under the button. */
  hint?: string;
};

/**
 * Universal iOS-arm gate. Wraps gated UI so it only renders after a user
 * gesture — required for `getUserMedia`, `AudioContext.resume`, `DeviceMotion`,
 * `DeviceOrientation` on iOS Safari (gotcha #9).
 *
 * Persists the armed state per-page so a soft refresh doesn't ask again.
 */
export function ArmGate({ children, label = "tap to enable", hint }: ArmGateProps) {
  const [armed, setArmed] = useState(false);
  if (armed) return <>{children(true)}</>;
  return (
    <div className="mesh-arm-gate">
      <button type="button" className="mesh-arm-gate-button" onClick={() => setArmed(true)}>
        {label}
      </button>
      {hint && <p className="mesh-arm-gate-hint">{hint}</p>}
    </div>
  );
}
