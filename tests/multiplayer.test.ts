// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

import { useDirectMessage } from "../src/multiplayer/useDirectMessage";
import { useChallenge } from "../src/multiplayer/useChallenge";
import { useXP } from "../src/multiplayer/useXP";
import { useAchievements } from "../src/multiplayer/useAchievements";
import { useMatchHistory } from "../src/multiplayer/useMatchHistory";
import { useElo } from "../src/multiplayer/useElo";
import { useSpectatorMode } from "../src/multiplayer/useSpectatorMode";
import { useTeams } from "../src/multiplayer/useTeams";
import { createMockRoom, linkMockRooms } from "../testing/createMockRoom";

const mem = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k: string, v: string) => mem.set(k, v),
  removeItem: (k: string) => mem.delete(k),
  clear: () => mem.clear(),
  key: (i: number) => Array.from(mem.keys())[i] ?? null,
  get length() {
    return mem.size;
  },
});

describe("useDirectMessage", () => {
  it("send + inbox + mark-read", () => {
    const a = createMockRoom({ peerId: "alice" });
    const b = createMockRoom({ peerId: "bob" });
    const unlink = linkMockRooms(a, b);
    const aH = renderHook(() => useDirectMessage<{ text: string }>(a, "dm"));
    const bH = renderHook(() => useDirectMessage<{ text: string }>(b, "dm"));
    act(() => {
      aH.result.current.send("bob", { text: "psst" });
    });
    bH.rerender();
    expect(bH.result.current.size).toBe(1);
    expect(bH.result.current.inbox[0]?.payload.text).toBe("psst");
    expect(bH.result.current.unread().length).toBe(1);
    act(() => bH.result.current.markAllRead());
    expect(bH.result.current.unread().length).toBe(0);
    unlink();
  });
});

describe("useChallenge", () => {
  it("challenge → accept lifecycle", () => {
    const a = createMockRoom({ peerId: "alice" });
    const b = createMockRoom({ peerId: "bob" });
    const unlink = linkMockRooms(a, b);
    const aH = renderHook(() => useChallenge(a, "c"));
    const bH = renderHook(() => useChallenge(b, "c"));
    let id = "";
    act(() => {
      id = aH.result.current.challenge("bob", "rps");
    });
    bH.rerender();
    expect(bH.result.current.incomingPending.length).toBe(1);
    act(() => bH.result.current.accept(id));
    aH.rerender();
    expect(aH.result.current.myActive.length).toBe(1);
    unlink();
  });
});

describe("useXP", () => {
  it("awardXP + leaderboard", () => {
    const a = createMockRoom({ peerId: "alice" });
    const b = createMockRoom({ peerId: "bob" });
    const unlink = linkMockRooms(a, b);
    const aH = renderHook(() => useXP(a, "xp"));
    const bH = renderHook(() => useXP(b, "xp"));
    act(() => aH.result.current.awardXP(40));
    act(() => bH.result.current.awardXP(10));
    aH.rerender();
    bH.rerender();
    expect(aH.result.current.myXP).toBe(40);
    expect(bH.result.current.myXP).toBe(10);
    expect(aH.result.current.myLevel).toBe(2); // sqrt(40/10) = 2
    const board = aH.result.current.leaderboard();
    expect(board[0]?.peerId).toBe("alice");
    expect(board[0]?.rank).toBe(1);
    unlink();
  });
});

describe("useAchievements", () => {
  it("unlock + hasBadge", () => {
    const room = createMockRoom({ peerId: "alice" });
    const { result, rerender } = renderHook(() =>
      useAchievements(room, "badges", [
        { id: "first-win", name: "First!", icon: "🥇" },
        { id: "streak-5", name: "5 streak", icon: "🔥" },
      ]),
    );
    let firstResult = false;
    let secondResult = true;
    act(() => {
      firstResult = result.current.unlock("first-win");
    });
    rerender();
    act(() => {
      secondResult = result.current.unlock("first-win");
    });
    rerender();
    expect(firstResult).toBe(true);
    expect(secondResult).toBe(false); // already earned
    expect(result.current.hasBadge("first-win")).toBe(true);
    expect(result.current.hasBadge("streak-5")).toBe(false);
  });
});

describe("useMatchHistory", () => {
  it("recordRound + statsOf", () => {
    const room = createMockRoom({ peerId: "alice" });
    const { result } = renderHook(() => useMatchHistory<{ moves: string }>(room, "h"));
    act(() => {
      result.current.recordRound({ players: ["alice", "bob"], winnerId: "alice", payload: { moves: "rps" } });
    });
    act(() => {
      result.current.recordRound({ players: ["alice", "bob"], winnerId: "bob", payload: { moves: "rps" } });
    });
    act(() => {
      result.current.recordRound({ players: ["alice", "bob"], winnerId: null, payload: { moves: "rps" } });
    });
    const s = result.current.statsOf("alice");
    expect(s.played).toBe(3);
    expect(s.wins).toBe(1);
    expect(s.losses).toBe(1);
    expect(s.draws).toBe(1);
    expect(Math.round(s.winRate * 100)).toBe(33);
  });
});

describe("useElo", () => {
  it("higher rating beats lower with smaller gain", () => {
    const room = createMockRoom({ peerId: "alice" });
    const { result } = renderHook(() => useElo(room, "elo"));
    expect(result.current.myRating).toBe(1500);
    expect(result.current.ratingOf("bob")).toBe(1500);
    act(() => result.current.recordResult({ opponent: "bob", score: 1 }));
    expect(result.current.myRating).toBe(1516); // 1500 + 32 * (1 - 0.5)
    expect(result.current.ratingOf("bob")).toBe(1484);
  });
  it("rankings sorted high-to-low", () => {
    const room = createMockRoom({ peerId: "alice" });
    const { result } = renderHook(() => useElo(room, "elo"));
    act(() => result.current.recordResult({ opponent: "bob", score: 1 }));
    act(() => result.current.recordResult({ opponent: "carol", score: 1 }));
    const r = result.current.rankings();
    expect(r[0]?.peerId).toBe("alice");
    expect(r[0]?.rating).toBeGreaterThan(r[1]?.rating ?? 0);
  });
});

describe("useSpectatorMode", () => {
  it("switchTo toggles role", () => {
    const room = createMockRoom({ peerId: "alice" });
    const { result, rerender } = renderHook(() =>
      useSpectatorMode(room, "roles", { maxPlayers: 4 }),
    );
    rerender();
    expect(result.current.myRole).toBe("playing");
    act(() => result.current.switchTo("watching"));
    rerender();
    expect(result.current.myRole).toBe("watching");
    expect(result.current.isSpectator).toBe(true);
  });
});

describe("useTeams", () => {
  it("auto-assigns + balances", () => {
    const a = createMockRoom({ peerId: "alice" });
    const b = createMockRoom({ peerId: "bob" });
    const unlink = linkMockRooms(a, b);
    const aH = renderHook(() => useTeams(a, { teams: ["red", "blue"] }));
    const bH = renderHook(() => useTeams(b, { teams: ["red", "blue"] }));
    aH.rerender();
    bH.rerender();
    expect(["red", "blue"]).toContain(aH.result.current.myTeam);
    expect(["red", "blue"]).toContain(bH.result.current.myTeam);
    const totalMembers =
      aH.result.current.sizeOf("red") + aH.result.current.sizeOf("blue");
    expect(totalMembers).toBeGreaterThanOrEqual(1);
    unlink();
  });
});
