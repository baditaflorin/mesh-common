// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useImageCapture } from "../src/useImageCapture";

describe("useImageCapture captureBlob", () => {
  it("reports an unavailable frame without creating a payload", async () => {
    const { result } = renderHook(() => useImageCapture({ armed: false }));
    await act(async () =>
      expect(await result.current.captureBlob()).toBeNull(),
    );
    expect(result.current.error).toMatch(/frame is not ready/i);
  });

  it("returns an encoded JPEG blob from a ready frame", async () => {
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue({
        drawImage: vi.fn(),
      } as unknown as CanvasRenderingContext2D);
    const toBlob = vi
      .spyOn(HTMLCanvasElement.prototype, "toBlob")
      .mockImplementation((callback) =>
        callback(new Blob(["frame"], { type: "image/jpeg" })),
      );
    const { result } = renderHook(() =>
      useImageCapture({ armed: false, now: () => 42 }),
    );
    const video = document.createElement("video");
    Object.defineProperties(video, {
      videoWidth: { value: 640 },
      videoHeight: { value: 480 },
    });
    Object.defineProperty(result.current.videoRef, "current", { value: video });

    let image: Awaited<ReturnType<typeof result.current.captureBlob>> = null;
    await act(async () => {
      image = await result.current.captureBlob(0.5);
    });
    expect(image).toMatchObject({ width: 640, height: 480, capturedAt: 42 });
    expect(image?.blob.type).toBe("image/jpeg");
    getContext.mockRestore();
    toBlob.mockRestore();
  });
});
