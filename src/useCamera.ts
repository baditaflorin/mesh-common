import { useCallback, useEffect, useRef, useState } from "react";

export type CameraFacing = "user" | "environment";

export type CameraState = {
  /** Live MediaStream when ready. null otherwise. */
  stream: MediaStream | null;
  /** ref to attach to a <video> element. The hook plays it for you. */
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** True once getUserMedia resolves. */
  ready: boolean;
  /** True iff facing front / back is being requested. */
  facing: CameraFacing;
  /** Switch between front + back cameras. */
  setFacing: (f: CameraFacing) => void;
  /** Snapshot the current frame as a data-URL (JPEG, 0..1 quality). */
  snapshot: (quality?: number) => string | null;
  /** Most recent error. */
  error: string | null;
};

/**
 * Camera stream + facing toggle + snapshot. Wraps `getUserMedia({video:...})`,
 * the iOS-arm gesture (use `<ArmGate>` to satisfy), the `<video>` autoplay,
 * and teardown on unmount or facing change.
 *
 *   <ArmGate label="enable camera">
 *     {(armed) => armed && <PhotoBooth />}
 *   </ArmGate>
 *   // inside:
 *   const cam = useCamera({ facing: "user" });
 *   <video ref={cam.videoRef} playsInline muted/>
 *   <button onClick={() => publish(cam.snapshot())}>capture</button>
 */
export function useCamera(opts?: {
  armed?: boolean;
  facing?: CameraFacing;
  width?: number;
  height?: number;
}): CameraState {
  const armed = opts?.armed ?? true;
  const [facing, setFacing] = useState<CameraFacing>(opts?.facing ?? "user");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const wantedWidth = opts?.width ?? 640;
  const wantedHeight = opts?.height ?? 480;

  useEffect(() => {
    if (!armed) return;
    let cancelled = false;
    let active: MediaStream | null = null;
    (async () => {
      try {
        if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
          setError("mediaDevices unavailable");
          return;
        }
        const s = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facing,
            width: { ideal: wantedWidth },
            height: { ideal: wantedHeight },
          },
          audio: false,
        });
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        active = s;
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.play().catch(() => {});
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
      active?.getTracks().forEach((t) => t.stop());
      setStream(null);
    };
  }, [armed, facing, wantedWidth, wantedHeight]);

  // Reattach the stream if videoRef arrives after stream did.
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream]);

  const snapshot = useCallback((quality = 0.85): string | null => {
    const v = videoRef.current;
    if (!v || v.videoWidth === 0) return null;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(v, 0, 0);
    return c.toDataURL("image/jpeg", quality);
  }, []);

  return {
    stream,
    videoRef,
    ready: stream != null,
    facing,
    setFacing,
    snapshot,
    error,
  };
}
