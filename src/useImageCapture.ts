import { useCallback, useState } from "react";
import { useCamera, type CameraFacing } from "./useCamera";

export type CapturedImage = {
  /** Local JPEG data URL. It is never transmitted by this hook. */
  dataUrl: string;
  width: number;
  height: number;
  capturedAt: number;
};

export type CapturedImageBlob = {
  /** JPEG payload suitable for an explicit, bounded sharing flow. */
  blob: Blob;
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
  /**
   * Capture the current frame as a JPEG Blob. This stays local until a caller
   * explicitly hands it to a transport such as `useFileShare`.
   */
  captureBlob: (quality?: number) => Promise<CapturedImageBlob | null>;
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

  const frameCanvas = useCallback(() => {
    const video = camera.videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0)
      return null;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(video, 0, 0);
    return { canvas, video };
  }, [camera.videoRef]);

  const capture = useCallback(
    (quality = 0.85) => {
      const frame = frameCanvas();
      if (!frame) {
        setCaptureError("A camera frame is not ready yet.");
        return null;
      }
      const normalizedQuality = Math.max(0, Math.min(1, quality));
      const dataUrl = frame.canvas.toDataURL("image/jpeg", normalizedQuality);
      const next: CapturedImage = {
        dataUrl,
        width: frame.video.videoWidth,
        height: frame.video.videoHeight,
        capturedAt: now(),
      };
      setCaptureError(null);
      setImage(next);
      return next;
    },
    [frameCanvas, now],
  );

  const captureBlob = useCallback(
    async (quality = 0.85): Promise<CapturedImageBlob | null> => {
      const frame = frameCanvas();
      if (!frame) {
        setCaptureError("A camera frame is not ready yet.");
        return null;
      }
      const normalizedQuality = Math.max(0, Math.min(1, quality));
      const blob = await new Promise<Blob | null>((resolve) =>
        frame.canvas.toBlob(resolve, "image/jpeg", normalizedQuality),
      );
      if (!blob) {
        setCaptureError("This browser could not encode the camera frame.");
        return null;
      }
      setCaptureError(null);
      return {
        blob,
        width: frame.video.videoWidth,
        height: frame.video.videoHeight,
        capturedAt: now(),
      };
    },
    [frameCanvas, now],
  );

  return {
    stream: camera.stream,
    videoRef: camera.videoRef,
    ready: camera.ready,
    facing: camera.facing,
    setFacing: camera.setFacing,
    image,
    capture,
    captureBlob,
    clear: () => setImage(null),
    error: captureError ?? camera.error,
  };
}
