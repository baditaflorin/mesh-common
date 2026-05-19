import { useEffect, useRef, useState } from "react";

/**
 * Voice activity detection by RMS energy + zero-crossing rate. No ML, no
 * onnx, no wasm — just Web Audio's `AnalyserNode`. Distinguishes "someone is
 * speaking" from "ambient noise" well enough for the social signal
 * ("alice is talking", "auto-mute when silent"); not accurate enough for
 * speech-to-text gating.
 *
 *   const vad = useVoiceActivity({ stream });
 *   {vad.active && <Speaking />}
 *
 * Energy alone trips on traffic and HVAC; ZCR alone trips on bright tonal
 * noise. The product of `rms > rmsThreshold` AND `zcr in [zcrMin, zcrMax]`
 * is roughly speech-shaped — a couple of hundred lines of speech-processing
 * work compressed into one pragmatic gate.
 */

export type VoiceActivityOptions = {
  /** The mic stream (from `navigator.mediaDevices.getUserMedia({audio:true})`). Pass null to disable. */
  stream: MediaStream | null;
  /** RMS energy threshold (0..1). Lower = more sensitive. Default 0.04. */
  rmsThreshold?: number;
  /** Lower bound of ZCR fraction (0..1) for "speech-shaped". Default 0.02. */
  zcrMin?: number;
  /** Upper bound of ZCR fraction. Default 0.20. */
  zcrMax?: number;
  /** Audio context (optional — created if missing). */
  audioContext?: AudioContext | null;
  /** ms of below-threshold required before active flips false. Default 250 (avoid blinking). */
  hangoverMs?: number;
};

export type VoiceActivityState = {
  active: boolean;
  rms: number;
  zcr: number;
};

export function useVoiceActivity(opts: VoiceActivityOptions): VoiceActivityState {
  const {
    stream,
    rmsThreshold = 0.04,
    zcrMin = 0.02,
    zcrMax = 0.2,
    audioContext = null,
    hangoverMs = 250,
  } = opts;

  const [state, setState] = useState<VoiceActivityState>({ active: false, rms: 0, zcr: 0 });
  const lastActiveAt = useRef<number>(0);
  const rafHandle = useRef<number | null>(null);

  useEffect(() => {
    if (!stream || typeof window === "undefined") return;
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = audioContext ?? new Ctx();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.0;
    source.connect(analyser);

    const buf = new Float32Array(analyser.fftSize);

    const tick = () => {
      analyser.getFloatTimeDomainData(buf);

      // RMS
      let sumSq = 0;
      for (let i = 0; i < buf.length; i++) sumSq += buf[i]! * buf[i]!;
      const rms = Math.sqrt(sumSq / buf.length);

      // ZCR
      let crossings = 0;
      for (let i = 1; i < buf.length; i++) {
        const a = buf[i - 1]!;
        const b = buf[i]!;
        if ((a >= 0 && b < 0) || (a < 0 && b >= 0)) crossings++;
      }
      const zcr = crossings / buf.length;

      const speechShaped = rms > rmsThreshold && zcr >= zcrMin && zcr <= zcrMax;
      const now = Date.now();
      if (speechShaped) lastActiveAt.current = now;
      const active = now - lastActiveAt.current < hangoverMs;

      setState((prev) =>
        prev.active === active && Math.abs(prev.rms - rms) < 0.005 && Math.abs(prev.zcr - zcr) < 0.005
          ? prev
          : { active, rms, zcr },
      );

      rafHandle.current = requestAnimationFrame(tick);
    };
    rafHandle.current = requestAnimationFrame(tick);

    return () => {
      if (rafHandle.current !== null) cancelAnimationFrame(rafHandle.current);
      source.disconnect();
      analyser.disconnect();
      if (!audioContext) void ctx.close();
    };
  }, [stream, rmsThreshold, zcrMin, zcrMax, hangoverMs, audioContext]);

  return state;
}
