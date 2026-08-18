import { useCallback, useEffect, useState } from "react";
import { useRoster } from "../useRoster";
import type { YRoom } from "../useYRoom";

export type TeamsState = {
  /** This peer's team id, or null if not assigned. */
  myTeam: string | null;
  /** All known team ids in order. */
  teams: string[];
  /** Members of a team (peerIds). */
  membersOf: (team: string) => string[];
  /** Count of peers per team. */
  sizeOf: (team: string) => number;
  /** Switch this peer to a different team (only when `allowManual`). */
  switchTo: (team: string) => void;
  /**
   * Re-shuffle every peer onto a balanced team (only "auto" mode).
   *
   * No-ops unless `opts.canBalance` was passed and returns true at call
   * time — see the `canBalance` option below.
   */
  balance: () => void;
};

const ROOT_KEY = "__mesh_teams";

function hashTo(peerId: string, salt: string, mod: number): number {
  let h = 0;
  const s = `${peerId}|${salt}`;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % mod;
}

/**
 * Partition peers into N teams. Two modes:
 *   - "auto" (default): each peer hash-assigned at first sight; rebalance
 *     re-seeds the assignment for every peer.
 *   - "manual": peers pick their own team via `switchTo`.
 *
 *   const teams = useTeams(room, { teams: ["red", "blue"] });
 *   teams.myTeam === "red" ? <RedView/> : <BlueView/>
 *
 * `balance()` rewrites every present peer's team assignment in one
 * transaction, so it's disabled by default — without a check, any single
 * connected peer could call it mid-match to grief everyone's assignment.
 * Pass `canBalance` to authorize it (e.g. gate on `useModerator(...).isMe`,
 * or on "everyone clicked ready"):
 *
 *   const teams = useTeams(room, { teams: [...], canBalance: () => moderator.isMe });
 */
export function useTeams(
  room: YRoom | null,
  opts: {
    teams: string[] | number;
    mode?: "auto" | "manual";
    allowManual?: boolean;
    /** Called before every `balance()`; the re-shuffle is dropped unless
     *  this returns true. Defaults to always-false. */
    canBalance?: () => boolean;
  },
): TeamsState {
  const teams =
    typeof opts.teams === "number"
      ? Array.from({ length: opts.teams }, (_, i) => `team-${i + 1}`)
      : opts.teams;
  const mode = opts.mode ?? "auto";
  const roster = useRoster(room);
  const [, rerender] = useState(0);

  useEffect(() => {
    if (!room) return;
    const m = room.doc.getMap<string>(ROOT_KEY);
    const salt = room.doc.getMap<string>(`${ROOT_KEY}_meta`);
    const cb = () => rerender((n) => n + 1);
    m.observe(cb);
    salt.observe(cb);
    return () => {
      m.unobserve(cb);
      salt.unobserve(cb);
    };
  }, [room]);

  // Auto-assign on first sight.
  useEffect(() => {
    if (!room || mode !== "auto") return;
    const m = room.doc.getMap<string>(ROOT_KEY);
    const meta = room.doc.getMap<string>(`${ROOT_KEY}_meta`);
    const salt = meta.get("salt") ?? "v1";
    for (const pid of roster.present) {
      if (!m.get(pid)) {
        const idx = hashTo(pid, salt, teams.length);
        m.set(pid, teams[idx]!);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, roster.present.join("|"), teams.join("|")]);

  const map = room ? room.doc.getMap<string>(ROOT_KEY) : null;
  const myTeam = room ? (map?.get(room.peerId) ?? null) : null;

  const membersOf = useCallback(
    (team: string): string[] => {
      if (!map) return [];
      const out: string[] = [];
      map.forEach((t, pid) => {
        if (t === team) out.push(pid);
      });
      return out.sort();
    },
    [map],
  );

  const sizeOf = useCallback(
    (team: string) => (map ? membersOf(team).length : 0),
    [map, membersOf],
  );

  const switchTo = useCallback(
    (team: string) => {
      if (!room || !map) return;
      if (mode === "auto" && !opts.allowManual) return;
      if (!teams.includes(team)) return;
      map.set(room.peerId, team);
    },
    [room, map, mode, opts.allowManual, teams],
  );

  const canBalance = opts.canBalance ?? (() => false);
  const balance = useCallback(() => {
    if (!room) return;
    if (!canBalance()) return;
    const meta = room.doc.getMap<string>(`${ROOT_KEY}_meta`);
    const m = room.doc.getMap<string>(ROOT_KEY);
    const newSalt = `v-${Date.now()}`;
    meta.set("salt", newSalt);
    room.doc.transact(() => {
      for (const pid of roster.present) {
        const idx = hashTo(pid, newSalt, teams.length);
        m.set(pid, teams[idx]!);
      }
    });
  }, [room, roster.present, teams, canBalance]);

  return {
    myTeam,
    teams,
    membersOf,
    sizeOf,
    switchTo,
    balance,
  };
}
