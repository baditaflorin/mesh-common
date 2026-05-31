import { useEffect, useRef } from "react";

/**
 * One scheduled tone. Mirrors the oscillator + gain-envelope shape that
 * mesh-doorbell, mesh-metronome, mesh-firefly-walk, mesh-pair-rotation and
 * friends each hand-rolled before this primitive existed.
 */
export type ToneSpec = {
  /** Oscillator frequency in Hz. */
  freq: number;
  /** If set, the pitch glides exponentially from `freq` to this over `duration` (a chirp). */
  glideTo?: number;
  /** Wave shape. Default `"sine"`. */
  type?: OscillatorType;
  /** Note length in seconds. Default `0.15`. */
  duration?: number;
  /** Peak gain, 0..1. Default `0.3`. */
  gain?: number;
  /** Attack ramp in seconds (clamped to `duration`). Default `0.01`. */
  attack?: number;
  /** Schedule offset from "now" in seconds — sequence notes by giving each its own `at`. Default `0`. */
  at?: number;
};

export type ToneEngine = {
  /**
   * Play one tone. Lazily creates and resumes the `AudioContext`, so the first
   * call must happen inside a user gesture (browsers start audio suspended).
   */
  play: (spec: ToneSpec) => void;
  /** Play several tones at once; each note's `at` schedules a melody or chord. */
  sequence: (specs: ToneSpec[]) => void;
  /** Short neutral confirmation blip. */
  beep: () => void;
  /** Resume a suspended context. Safe to call from any user-gesture handler. */
  resume: () => Promise<void>;
  /** Tear down the `AudioContext`. */
  close: () => void;
  /** The live `AudioContext`, or `null` before first use / when unsupported. */
  readonly ctx: AudioContext | null;
};

/** Alias kept for symmetry with other `use*` primitives. */
export type ToneApi = ToneEngine;

export type ToneEngineOptions = {
  /** Master gain multiplied into every tone, 0..1. Default `1`. */
  masterGain?: number;
  /** Inject an `AudioContext` factory (tests / non-DOM hosts). Default: `window.AudioContext`. */
  factory?: () => AudioContext;
};

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function resolveFactory(opts?: ToneEngineOptions): (() => AudioContext) | null {
  if (opts?.factory) return opts.factory;
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  return Ctor ? () => new Ctor() : null;
}

/**
 * React-free WebAudio cue engine. Owns one lazily-created `AudioContext` and
 * plays short oscillator tones with an exponential gain envelope. The hook
 * {@link useTone} wraps this and closes the context on unmount.
 */
export function createToneEngine(opts?: ToneEngineOptions): ToneEngine {
  const master = clamp01(opts?.masterGain ?? 1);
  const makeCtx = resolveFactory(opts);
  let ctx: AudioContext | null = null;

  function ensure(): AudioContext | null {
    if (!makeCtx) return null;
    if (!ctx) {
      try {
        ctx = makeCtx();
      } catch {
        ctx = null;
      }
    }
    if (ctx && ctx.state === "suspended") void ctx.resume().catch(() => {});
    return ctx;
  }

  function playOne(c: AudioContext, spec: ToneSpec): void {
    const t0 = c.currentTime + Math.max(0, spec.at ?? 0);
    const dur = Math.max(0.01, spec.duration ?? 0.15);
    const peak = Math.max(0.0002, clamp01((spec.gain ?? 0.3) * master));
    const attack = Math.min(Math.max(0.0005, spec.attack ?? 0.01), dur);
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = spec.type ?? "sine";
    osc.frequency.setValueAtTime(Math.max(1, spec.freq), t0);
    if (spec.glideTo != null) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(1, spec.glideTo),
        t0 + dur,
      );
    }
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function play(spec: ToneSpec): void {
    const c = ensure();
    if (!c) return;
    try {
      playOne(c, spec);
    } catch {
      /* context closed or unsupported — non-fatal */
    }
  }

  function sequence(specs: ToneSpec[]): void {
    const c = ensure();
    if (!c) return;
    for (const spec of specs) {
      try {
        playOne(c, spec);
      } catch {
        /* skip a bad note rather than aborting the run */
      }
    }
  }

  function beep(): void {
    play({ freq: 880, type: "square", duration: 0.08, gain: 0.2 });
  }

  async function resume(): Promise<void> {
    const c = ensure();
    if (c && c.state === "suspended") {
      try {
        await c.resume();
      } catch {
        /* ignore */
      }
    }
  }

  function close(): void {
    if (ctx) {
      try {
        void ctx.close();
      } catch {
        /* ignore */
      }
      ctx = null;
    }
  }

  return {
    get ctx() {
      return ctx;
    },
    play,
    sequence,
    beep,
    resume,
    close,
  };
}

/**
 * WebAudio cue hook. Returns a stable {@link ToneEngine} for the component's
 * lifetime and closes its `AudioContext` on unmount.
 *
 *   const tone = useTone();
 *   <button onClick={() => tone.play({ freq: 880, type: "square", duration: 0.06 })}>
 *
 * Doorbell-style chime (3-note sequence):
 *
 *   tone.sequence([
 *     { freq: 880, at: 0 }, { freq: 660, at: 0.18 }, { freq: 880, at: 0.36 },
 *   ]);
 */
export function useTone(opts?: ToneEngineOptions): ToneApi {
  const ref = useRef<ToneEngine | null>(null);
  if (!ref.current) ref.current = createToneEngine(opts);
  useEffect(() => {
    const engine = ref.current;
    return () => engine?.close();
  }, []);
  return ref.current;
}
