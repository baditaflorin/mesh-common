import { useEffect, useState } from "react";
import type { YRoom } from "./useYRoom";

const MAX_INVITES = 100;
const MAX_LABEL_LENGTH = 120;
const INVITE_CODE = /^[A-Z0-9_-]{3,32}$/;

type StoredInvite = {
  code: string;
  label: string;
  createdBy: string;
  createdAt: number;
  acceptedBy: string | null;
  acceptedAt: number | null;
};

export type SharedInvite = StoredInvite;

function isPeerId(value: unknown) {
  return (
    typeof value === "string" && value.trim().length > 0 && value.length <= 120
  );
}

function isStoredInvite(value: unknown): value is StoredInvite {
  if (!value || typeof value !== "object") return false;
  const invite = value as Partial<StoredInvite>;
  return (
    typeof invite.code === "string" &&
    INVITE_CODE.test(invite.code) &&
    typeof invite.label === "string" &&
    invite.label.trim().length > 0 &&
    invite.label.length <= MAX_LABEL_LENGTH &&
    isPeerId(invite.createdBy) &&
    typeof invite.createdAt === "number" &&
    Number.isFinite(invite.createdAt) &&
    (invite.acceptedBy === null || isPeerId(invite.acceptedBy)) &&
    (invite.acceptedAt === null ||
      (typeof invite.acceptedAt === "number" &&
        Number.isFinite(invite.acceptedAt)))
  );
}

function normalizeCode(value: string) {
  return value.trim().toUpperCase();
}

function generatedCode(peerId: string) {
  const peerPart = peerId
    .replace(/[^a-z0-9]/gi, "")
    .slice(-4)
    .toUpperCase();
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${peerPart || "MESH"}-${random}`;
}

/**
 * One-time, room-scoped invitation codes. The CRDT tracks creation and a
 * single claimant; it intentionally does not create external URLs or expose
 * secrets outside the current mesh room.
 */
export function useSharedInvites(room: YRoom | null, key = "invites") {
  const [, rerender] = useState(0);

  useEffect(() => {
    if (!room) return;
    const map = room.doc.getMap<StoredInvite>(key);
    const update = () => rerender((version) => version + 1);
    map.observe(update);
    return () => map.unobserve(update);
  }, [room, key]);

  const map = room?.doc.getMap<StoredInvite>(key) ?? null;
  const invites = [...(map?.values() ?? [])]
    .filter(isStoredInvite)
    .sort((a, b) => a.createdAt - b.createdAt || a.code.localeCompare(b.code));
  const open = invites.filter((invite) => invite.acceptedBy === null);
  const accepted = invites.filter((invite) => invite.acceptedBy !== null);
  const mine = room
    ? invites.filter(
        (invite) =>
          invite.createdBy === room.peerId || invite.acceptedBy === room.peerId,
      )
    : [];

  return {
    invites,
    open,
    accepted,
    mine,
    /** Create an invite and return its canonical code, or null when rejected. */
    create: (label: string, code = generatedCode(room?.peerId ?? "mesh")) => {
      const cleanLabel = label.trim();
      const cleanCode = normalizeCode(code);
      if (
        !room ||
        !map ||
        !cleanLabel ||
        cleanLabel.length > MAX_LABEL_LENGTH ||
        !INVITE_CODE.test(cleanCode) ||
        map.has(cleanCode) ||
        invites.length >= MAX_INVITES
      ) {
        return null;
      }
      map.set(cleanCode, {
        code: cleanCode,
        label: cleanLabel,
        createdBy: room.peerId,
        createdAt: Date.now(),
        acceptedBy: null,
        acceptedAt: null,
      });
      return cleanCode;
    },
    /** Atomically claim one unclaimed invitation code for this peer. */
    accept: (code: string) => {
      const cleanCode = normalizeCode(code);
      const invite = map?.get(cleanCode);
      if (
        !room ||
        !map ||
        !isStoredInvite(invite) ||
        invite.acceptedBy !== null
      )
        return false;
      map.set(cleanCode, {
        ...invite,
        acceptedBy: room.peerId,
        acceptedAt: Date.now(),
      });
      return true;
    },
    /** Let the accepting peer make their claimed invitation available again. */
    release: (code: string) => {
      const cleanCode = normalizeCode(code);
      const invite = map?.get(cleanCode);
      if (
        !room ||
        !map ||
        !isStoredInvite(invite) ||
        invite.acceptedBy !== room.peerId
      )
        return false;
      map.set(cleanCode, { ...invite, acceptedBy: null, acceptedAt: null });
      return true;
    },
    /** Only the creating peer may revoke a code. */
    revoke: (code: string) => {
      const cleanCode = normalizeCode(code);
      const invite = map?.get(cleanCode);
      if (
        !room ||
        !map ||
        !isStoredInvite(invite) ||
        invite.createdBy !== room.peerId
      )
        return false;
      map.delete(cleanCode);
      return true;
    },
  };
}
