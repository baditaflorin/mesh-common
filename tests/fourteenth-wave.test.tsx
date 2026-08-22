// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it } from "vitest";
import {
  useSharedLottery,
  useSharedMilestones,
  useSharedPlaylist,
  useSharedRatings,
  useSharedWordCloud,
} from "../src";
import { createMockRoom, linkMockRooms } from "../testing/createMockRoom";

it("replicates facilitation primitives", async () => {
  const a = createMockRoom({ peerId: "a" });
  const b = createMockRoom({ peerId: "b" });
  const unlink = linkMockRooms(a, b);
  const first = renderHook(() => ({
    ratings: useSharedRatings(a),
    words: useSharedWordCloud(a),
    lottery: useSharedLottery(a),
    milestones: useSharedMilestones(a),
    playlist: useSharedPlaylist(a),
  }));
  const second = renderHook(() => ({
    ratings: useSharedRatings(b),
    words: useSharedWordCloud(b),
    lottery: useSharedLottery(b),
    milestones: useSharedMilestones(b),
    playlist: useSharedPlaylist(b),
  }));
  act(() => {
    first.result.current.ratings.setMine(5);
    first.result.current.words.submit("Hope");
    first.result.current.lottery.enter("Alice");
    first.result.current.milestones.add("Start", "start");
    first.result.current.playlist.add("Song", "song");
  });
  await waitFor(() => expect(second.result.current.ratings.average).toBe(5));
  await waitFor(() =>
    expect(second.result.current.words.words[0]?.word).toBe("hope"),
  );
  await waitFor(() =>
    expect(second.result.current.lottery.entries).toHaveLength(1),
  );
  await waitFor(() =>
    expect(second.result.current.milestones.milestones).toHaveLength(1),
  );
  await waitFor(() =>
    expect(second.result.current.playlist.entries).toHaveLength(1),
  );
  unlink();
});
