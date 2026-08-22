import { useCallback, useState } from "react";
import { useCamera, type CameraFacing } from "./useCamera";

export type CapturedImage = {
  /** Local JPEG data URL. It is never transmitted by this hook. */
  dataUrl: string;
  width: number;
  height: number;
  capturedAt: number;
};

export type ImageCaptureOptions = {
  /** Do not request the camera until an intentional user gesture arms it. */
  armed?: boolean;
  facing?: CameraFacing;
  width?: number;
  height?: number;
  now?: () => number;
};

export type ImageCaptureState = {
  stream: MediaStream | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  ready: boolean;
  facing: CameraFacing;
  setFacing: (facing: CameraFacing) => void;
  image: CapturedImage | null;
  /** Capture the current video frame as a local JPEG, or null if no frame is ready. */
  capture: (quality?: number) => CapturedImage | null;
  clear: () => void;
  error: string | null;
};

/**
 * Camera-backed still-image capture with explicit local state.
 *
 * This composes `useCamera`, retaining its stream teardown and facing toggle.
 * Calling `capture` only reads the current local video frame; applications
 * choose whether and how a resulting `dataUrl` is shared or persisted.
 */
export function useImageCapture(
  options: ImageCaptureOptions = {},
): ImageCaptureState {
  const camera = useCamera(options);
  const [image, setImage] = useState<CapturedImage | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const now = options.now ?? Date.now;

  const capture = useCallback(
    (quality = 0.85) => {
      const dataUrl = camera.snapshot(Math.max(0, Math.min(1, quality)));
      const video = camera.videoRef.current;
      if (!dataUrl || !video) {
        setCaptureError("A camera frame is not ready yet.");
        return null;
      }
      const next: CapturedImage = {
        dataUrl,
        width: video.videoWidth,
        height: video.videoHeight,
        capturedAt: now(),
      };
      setCaptureError(null);
      setImage(next);
      return next;
    },
    [camera, now],
  );

  return {
    stream: camera.stream,
    videoRef: camera.videoRef,
    ready: camera.ready,
    facing: camera.facing,
    setFacing: camera.setFacing,
    image,
    capture,
    clear: () => setImage(null),
    error: captureError ?? camera.error,
  };
}
