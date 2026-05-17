import { useCallback, useEffect, useState } from "react";

export type FlashlightState = {
  /** True iff a torch-capable video track is currently bound. */
  supported: boolean;
  /** True iff the torch is currently on. */
  on: boolean;
  /** Toggle the torch. No-op if unsupported. */
  toggle: () => Promise<void>;
  /** Explicit setter. */
  setOn: (v: boolean) => Promise<void>;
  /** Most recent error. */
  error: string | null;
};

/**
 * Camera torch / flashlight via the `torch` constraint on a video track.
 *
 * Pass a MediaStream from `useCamera` — the hook applies the torch constraint
 * to its first video track. iOS Safari did not support torch until iOS 17;
 * the hook degrades gracefully (`supported: false`) on older devices.
 *
 *   const cam = useCamera({ facing: "environment" });
 *   const torch = useFlashlight(cam.stream);
 *   {torch.supported && <button onClick={torch.toggle}>{torch.on ? "off" : "on"}</button>}
 */
export function useFlashlight(stream: MediaStream | null): FlashlightState {
  const [on, setOnState] = useState(false);
  const [supported, setSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!stream) {
      setSupported(false);
      setOnState(false);
      return;
    }
    const track = stream.getVideoTracks()[0];
    if (!track) {
      setSupported(false);
      return;
    }
    const caps = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities & {
      torch?: boolean;
    };
    setSupported(!!caps.torch);
  }, [stream]);

  const setOn = useCallback(
    async (v: boolean) => {
      if (!stream) return;
      const track = stream.getVideoTracks()[0];
      if (!track) return;
      try {
        await track.applyConstraints({
          advanced: [{ torch: v } as MediaTrackConstraintSet & { torch?: boolean }],
        });
        setOnState(v);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [stream],
  );

  const toggle = useCallback(() => setOn(!on), [on, setOn]);

  return { supported, on, toggle, setOn, error };
}
