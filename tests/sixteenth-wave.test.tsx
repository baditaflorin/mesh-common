// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  useSharedBingoBoard,
  useSharedCaptionContest,
  useSharedPixelGrid,
  useSharedStickyBoard,
  useSharedWordRelay,
} from "../src";
import { createMockRoom, linkMockRooms } from "../testing/createMockRoom";

describe("sixteenth primitive wave", () => {
  it("replicates bounded creative state and keeps peer claims independent", async () => {
    const a = createMockRoom({ peerId: "a" });
    const b = createMockRoom({ peerId: "b" });
    const unlink = linkMockRooms(a, b);
    const first = renderHook(() => ({
      board: useSharedStickyBoard(a),
      relay: useSharedWordRelay(a),
      pixels: useSharedPixelGrid(a, "pixels", { width: 2, height: 2 }),
      captions: useSharedCaptionContest(a),
      bingo: useSharedBingoBoard(a),
    }));
    const second = renderHook(() => ({
      board: useSharedStickyBoard(b),
      relay: useSharedWordRelay(b),
      pixels: useSharedPixelGrid(b, "pixels", { width: 2, height: 2 }),
      captions: useSharedCaptionContest(b),
      bingo: useSharedBingoBoard(b),
    }));

    act(() => {
      expect(
        first.result.current.board.add("A thought", { id: "note-a", x: 1 }),
      ).toBe(true);
      expect(first.result.current.relay.add("Once", "word-a")).toBe(true);
      expect(first.result.current.pixels.set(1, 1, "#AABBCC")).toBe(true);
      expect(
        first.result.current.captions.setPrompt("When the mesh reconnects…"),
      ).toBe(true);
      expect(first.result.current.captions.submit("Everyone claps.")).toBe(
        true,
      );
      expect(
        first.result.current.bingo.configure([
          { id: "hello", label: "Say hello" },
        ]),
      ).toBe(true);
    });

    await waitFor(() =>
      expect(second.result.current.board.notes).toHaveLength(1),
    );
    await waitFor(() =>
      expect(second.result.current.relay.latest?.word).toBe("Once"),
    );
    await waitFor(() =>
      expect(second.result.current.pixels.get(1, 1)?.color).toBe("#aabbcc"),
    );
    await waitFor(() =>
      expect(second.result.current.captions.prompt).toContain("mesh"),
    );
    await waitFor(() =>
      expect(second.result.current.bingo.cells).toHaveLength(1),
    );

    act(() => {
      expect(second.result.current.captions.toggleVote("a")).toBe(true);
      expect(second.result.current.bingo.toggleMine("hello")).toBe(true);
    });
    await waitFor(() =>
      expect(first.result.current.captions.captions[0]?.votes).toBe(1),
    );
    await waitFor(() =>
      expect(first.result.current.bingo.cells[0]?.claimCount).toBe(1),
    );
    expect(first.result.current.pixels.set(2, 1, "#000000")).toBe(false);
    expect(first.result.current.captions.toggleVote("a")).toBe(false);
    unlink();
  });
});
