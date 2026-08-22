// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  useSharedBudget,
  useSharedCardStack,
  useSharedHost,
  useSharedPairings,
  useSharedTurnOrder,
} from "../src";
import { createMockRoom, linkMockRooms } from "../testing/createMockRoom";

describe("thirteenth primitive wave", () => {
  it("replicates pairings, turn order, budgets, cards, and host state", async () => {
    const a = createMockRoom({ peerId: "a" });
    const b = createMockRoom({ peerId: "b" });
    const unlink = linkMockRooms(a, b);
    const first = renderHook(() => ({
      pairs: useSharedPairings(a),
      turns: useSharedTurnOrder(a),
      budget: useSharedBudget(a),
      cards: useSharedCardStack(a),
      host: useSharedHost(a),
    }));
    const second = renderHook(() => ({
      pairs: useSharedPairings(b),
      turns: useSharedTurnOrder(b),
      budget: useSharedBudget(b),
      cards: useSharedCardStack(b),
      host: useSharedHost(b),
    }));
    act(() => {
      first.result.current.pairs.set([{ id: "one", peers: ["a", "b"] }]);
      first.result.current.turns.setPeers(["a", "b"]);
      first.result.current.turns.next();
      first.result.current.budget.setMine(12.5);
      first.result.current.cards.add("Idea", "idea");
      first.result.current.host.claim();
    });
    await waitFor(() =>
      expect(second.result.current.pairs.pairings).toHaveLength(1),
    );
    await waitFor(() => expect(second.result.current.turns.current).toBe("b"));
    await waitFor(() => expect(second.result.current.budget.total).toBe(12.5));
    await waitFor(() =>
      expect(second.result.current.cards.cards[0]?.label).toBe("Idea"),
    );
    await waitFor(() =>
      expect(second.result.current.host.host?.peerId).toBe("a"),
    );
    unlink();
  });
});
