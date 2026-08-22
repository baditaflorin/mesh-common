// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  useSharedAgenda,
  useSharedPromptDeck,
  useSharedResponses,
  useSharedRsvp,
  useSharedScoreboard,
} from "../src";
import { createMockRoom, linkMockRooms } from "../testing/createMockRoom";

describe("eleventh primitive wave", () => {
  it("replicates peer-attributed RSVPs and rejects no invalid status at the type boundary", async () => {
    const alice = createMockRoom({ peerId: "alice" });
    const bob = createMockRoom({ peerId: "bob" });
    const unlink = linkMockRooms(alice, bob);
    const a = renderHook(() => useSharedRsvp(alice, "event"));
    const b = renderHook(() => useSharedRsvp(bob, "event"));

    act(() => expect(a.result.current.set("yes")).toBe(true));
    await waitFor(() => expect(b.result.current.counts.yes).toBe(1));
    act(() => expect(b.result.current.set("maybe")).toBe(true));
    await waitFor(() => expect(a.result.current.entries).toHaveLength(2));
    expect(a.result.current.entries.map((entry) => entry.peerId)).toEqual([
      "alice",
      "bob",
    ]);
    unlink();
  });

  it("shares agenda items and the current marker without a second array write", async () => {
    const alice = createMockRoom({ peerId: "alice" });
    const bob = createMockRoom({ peerId: "bob" });
    const unlink = linkMockRooms(alice, bob);
    const a = renderHook(() => useSharedAgenda(alice, "agenda"));
    const b = renderHook(() => useSharedAgenda(bob, "agenda"));

    act(() =>
      expect(
        a.result.current.add({
          id: "intro",
          title: " Intro ",
          durationMinutes: 5,
        }),
      ).toBe(true),
    );
    await waitFor(() => expect(b.result.current.items[0]?.title).toBe("Intro"));
    act(() => expect(b.result.current.setCurrent("intro")).toBe(true));
    await waitFor(() => expect(a.result.current.currentId).toBe("intro"));
    expect(
      a.result.current.add({
        id: "intro",
        title: "Duplicate",
        durationMinutes: 1,
      }),
    ).toBe(false);
    unlink();
  });

  it("keeps a deterministic shared scoreboard with bounded deltas", async () => {
    const alice = createMockRoom({ peerId: "alice" });
    const bob = createMockRoom({ peerId: "bob" });
    const unlink = linkMockRooms(alice, bob);
    const a = renderHook(() => useSharedScoreboard(alice, "scores"));
    const b = renderHook(() => useSharedScoreboard(bob, "scores"));

    act(() => {
      a.result.current.add(2);
      b.result.current.add(4);
    });
    await waitFor(() => expect(a.result.current.scores).toHaveLength(2));
    expect(a.result.current.scores[0]).toMatchObject({
      peerId: "bob",
      score: 4,
    });
    act(() => expect(a.result.current.reset()).toBe(true));
    await waitFor(() => expect(b.result.current.scores).toEqual([]));
    unlink();
  });

  it("replicates prompt selection separately from the ordered prompt deck", async () => {
    const alice = createMockRoom({ peerId: "alice" });
    const bob = createMockRoom({ peerId: "bob" });
    const unlink = linkMockRooms(alice, bob);
    const a = renderHook(() => useSharedPromptDeck(alice, "deck"));
    const b = renderHook(() => useSharedPromptDeck(bob, "deck"));

    act(() =>
      expect(a.result.current.add({ id: "p1", text: "Tell a story" })).toBe(
        true,
      ),
    );
    await waitFor(() => expect(b.result.current.prompts).toHaveLength(1));
    act(() => expect(b.result.current.select("p1")).toBe(true));
    await waitFor(() =>
      expect(a.result.current.current?.text).toBe("Tell a story"),
    );
    unlink();
  });

  it("keeps one bounded response per peer and lets a peer replace its own response", async () => {
    const alice = createMockRoom({ peerId: "alice" });
    const bob = createMockRoom({ peerId: "bob" });
    const unlink = linkMockRooms(alice, bob);
    const a = renderHook(() => useSharedResponses(alice, "wall"));
    const b = renderHook(() => useSharedResponses(bob, "wall"));

    act(() => expect(a.result.current.submit("  hello  ")).toBe(true));
    await waitFor(() =>
      expect(b.result.current.responses[0]?.text).toBe("hello"),
    );
    act(() => expect(a.result.current.submit("updated")).toBe(true));
    await waitFor(() =>
      expect(b.result.current.responses[0]?.text).toBe("updated"),
    );
    expect(a.result.current.submit(" ")).toBe(false);
    unlink();
  });
});
