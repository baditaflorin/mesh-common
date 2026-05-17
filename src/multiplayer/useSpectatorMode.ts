import { useCallback, useEffect, useState } from "react";
import type { YRoom } from "../useYRoom";

export type SpectatorRole = "playing" | "watching";

export type SpectatorState = {
  /** This peer's role (defaults to "playing"). */
  myRole: SpectatorRole;
  /** True iff `myRole === "watching"`. */
  isSpectator: boolean;
  /** peerIds with role === "playing". */
  players: string[];
  /** peerIds with role === "watching". */
  spectators: string[];
  /** Active player count (saturates at `maxPlayers` if set). */
  playerCount: number;
  /** Switch this peer to `role`. */
  switchTo: (role: SpectatorRole) => void;
  /** True iff `maxPlayers` is set AND adding this peer would exceed it. */
  isFull: boolean;
};

/**
 * Explicit playing vs watching role split. Useful when only a subset of
 * present peers should be in the active round (tournament where 2 play +
 * N watch + cheer).
 *
 *   const sp = useSpectatorMode(room, "rps-roles", { maxPlayers: 2 });
 *   {sp.isSpectator
 *     ? <SpectateView/>
 *     : sp.isFull ? <p>seats full</p> : <PlayView/>}
 *
 * Defaults to "playing"; apps can flip new peers to "watching" by default
 * when `maxPlayers` is set + already full.
 */
export function useSpectatorMode(
  room: YRoom | null,
  key: string,
  opts?: { maxPlayers?: number; defaultRole?: SpectatorRole },
): SpectatorState {
  const defaultRole = opts?.defaultRole ?? "playing";
  const [, rerender] = useState(0);

  useEffect(() => {
    if (!room) return;
    const m = room.doc.getMap<SpectatorRole>(key);
    const cb = () => rerender((n) => n + 1);
    m.observe(cb);
    return () => m.unobserve(cb);
  }, [room, key]);

  // Register self with default role on first sight.
  useEffect(() => {
    if (!room) return;
    const m = room.doc.getMap<SpectatorRole>(key);
    if (!m.has(room.peerId)) {
      let role: SpectatorRole = defaultRole;
      if (opts?.maxPlayers != null) {
        let players = 0;
        m.forEach((v) => v === "playing" && (players += 1));
        if (players >= opts.maxPlayers) role = "watching";
      }
      m.set(room.peerId, role);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room]);

  const map = room ? room.doc.getMap<SpectatorRole>(key) : null;
  const myPeer = room?.peerId ?? "";
  const myRole = (map?.get(myPeer) ?? defaultRole) as SpectatorRole;

  const players: string[] = [];
  const spectators: string[] = [];
  if (map) {
    map.forEach((role, pid) => {
      if (role === "playing") players.push(pid);
      else spectators.push(pid);
    });
  }
  players.sort();
  spectators.sort();

  const switchTo = useCallback(
    (role: SpectatorRole) => {
      if (!room || !map) return;
      if (role === "playing" && opts?.maxPlayers != null) {
        let count = 0;
        map.forEach((v, pid) => {
          if (v === "playing" && pid !== room.peerId) count += 1;
        });
        if (count >= opts.maxPlayers) return;
      }
      map.set(room.peerId, role);
    },
    [room, map, opts?.maxPlayers],
  );

  return {
    myRole,
    isSpectator: myRole === "watching",
    players,
    spectators,
    playerCount: players.length,
    switchTo,
    isFull:
      opts?.maxPlayers != null && players.length >= opts.maxPlayers && myRole !== "playing",
  };
}
