// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockRoom, linkMockRooms } from "../testing/createMockRoom";
import { useFileDrop } from "../src/useFileDrop";
import { useImageCapture } from "../src/useImageCapture";
import { usePermission } from "../src/usePermission";
import { useRoomCapacity } from "../src/useRoomCapacity";
import { useSharedChecklist } from "../src/useSharedChecklist";

describe("eighth primitive wave", () => {
  it("replicates an attributed checklist and validates its bounded labels", async () => {
    const alice = createMockRoom({ peerId: "alice" });
    const bob = createMockRoom({ peerId: "bob" });
    const unlink = linkMockRooms(alice, bob);
    const a = renderHook(() =>
      useSharedChecklist(alice, "tasks", { now: () => 10 }),
    );
    const b = renderHook(() =>
      useSharedChecklist(bob, "tasks", { now: () => 20 }),
    );

    let itemId = "";
    act(() => {
      const item = a.result.current.add("  Bring cards  ", { id: "cards" });
      itemId = item?.id ?? "";
    });
    await waitFor(() => expect(b.result.current.items).toHaveLength(1));
    expect(b.result.current.items[0]).toMatchObject({
      text: "Bring cards",
      createdBy: "alice",
    });
    act(() => expect(b.result.current.toggle(itemId)).toBe(true));
    await waitFor(() => expect(a.result.current.completedCount).toBe(1));
    expect(a.result.current.items[0]).toMatchObject({
      completedBy: "bob",
      completedAt: 20,
    });
    expect(a.result.current.add(" ")).toBeNull();
    unlink();
  });

  it("uses deterministic expiring reservation ordering for room capacity", async () => {
    const alice = createMockRoom({ peerId: "alice" });
    const bob = createMockRoom({ peerId: "bob" });
    const unlink = linkMockRooms(alice, bob);
    const a = renderHook(() =>
      useRoomCapacity(alice, "round", { capacity: 1, ttlMs: 60_000 }),
    );
    const b = renderHook(() =>
      useRoomCapacity(bob, "round", { capacity: 1, ttlMs: 60_000 }),
    );
    act(() => {
      a.result.current.join();
      b.result.current.join();
    });
    await waitFor(() => expect(a.result.current.members).toHaveLength(2));
    expect(a.result.current.admitted).toBe(true);
    expect(b.result.current.waitlisted).toBe(true);
    expect(b.result.current.position).toBe(2);
    act(() => a.result.current.leave());
    await waitFor(() => expect(b.result.current.admitted).toBe(true));
    unlink();
  });

  it("validates local file drops without uploading bytes", () => {
    const { result } = renderHook(() =>
      useFileDrop({ accept: ["image/*"], maxBytes: 4, maxFiles: 1 }),
    );
    const image = new File([new Uint8Array([1, 2])], "ok.png", {
      type: "image/png",
    });
    const text = new File(["x"], "no.txt", { type: "text/plain" });
    const tooLarge = new File([new Uint8Array(5)], "large.png", {
      type: "image/png",
    });
    let added;
    act(() => {
      added = result.current.add([image, text, tooLarge]);
    });
    expect(added).toEqual({
      accepted: [image],
      rejected: [
        { file: text, reason: "type" },
        { file: tooLarge, reason: "size" },
      ],
    });
    expect(result.current.files).toEqual([image]);
  });

  it("keeps image capture local and reports an unavailable frame", () => {
    const { result } = renderHook(() => useImageCapture({ armed: false }));
    act(() => expect(result.current.capture()).toBeNull());
    expect(result.current.image).toBeNull();
    expect(result.current.error).toMatch(/frame is not ready/i);
  });

  it("observes permission state and only requests through an explicit callback", async () => {
    const original = Object.getOwnPropertyDescriptor(navigator, "permissions");
    const onchange: { value: (() => void) | null } = { value: null };
    const query = vi.fn(async () => ({
      state: "prompt" as PermissionState,
      get onchange() {
        return onchange.value;
      },
      set onchange(value: (() => void) | null) {
        onchange.value = value;
      },
    }));
    Object.defineProperty(navigator, "permissions", {
      configurable: true,
      value: { query },
    });
    try {
      const request = vi.fn(async () => "granted" as PermissionState);
      const { result } = renderHook(() =>
        usePermission("geolocation", request),
      );
      await waitFor(() => expect(result.current.state).toBe("prompt"));
      await act(async () => expect(await result.current.request()).toBe(true));
      expect(request).toHaveBeenCalledOnce();
      expect(query).toHaveBeenCalled();
    } finally {
      if (original) Object.defineProperty(navigator, "permissions", original);
      else delete (navigator as { permissions?: unknown }).permissions;
    }
  });
});

afterEach(() => vi.restoreAllMocks());
