import { useEffect, useMemo, useState } from "react";
import * as Y from "yjs";
import type { YRoom } from "./useYRoom";

export type CrdtMigration = { version: number; migrate: (doc: Y.Doc) => void };
export type CrdtMigrations = {
  version: number;
  targetVersion: number;
  pending: boolean;
  error: Error | null;
  migrate: () => boolean;
};

/**
 * Runs numbered, idempotent document migrations and records the shared schema
 * version. Migrations must be safe to run more than once after a partition.
 */
export function useCrdtMigrations(
  room: YRoom | null,
  key: string,
  migrations: readonly CrdtMigration[],
): CrdtMigrations {
  const [, rerender] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    if (!room) return;
    const map = room.doc.getMap<number>(`${key}:schema`);
    const onChange = () => rerender((version) => version + 1);
    map.observe(onChange);
    return () => map.unobserve(onChange);
  }, [room, key]);
  const ordered = useMemo(
    () => [...migrations].filter((migration) => Number.isInteger(migration.version) && migration.version > 0).sort((a, b) => a.version - b.version),
    [migrations],
  );
  const map = room?.doc.getMap<number>(`${key}:schema`) ?? null;
  const version = map?.get("version") ?? 0;
  const targetVersion = ordered.at(-1)?.version ?? 0;

  return {
    version,
    targetVersion,
    pending: version < targetVersion,
    error,
    migrate: () => {
      if (!room || !map) return false;
      try {
        let current = map.get("version") ?? 0;
        for (const migration of ordered) {
          if (migration.version <= current) continue;
          if (migration.version !== current + 1) {
            throw new Error(`Missing CRDT migration from version ${current} to ${migration.version}`);
          }
          room.doc.transact(() => {
            migration.migrate(room.doc);
            map.set("version", migration.version);
          });
          current = migration.version;
        }
        setError(null);
        return true;
      } catch (cause) {
        setError(cause instanceof Error ? cause : new Error(String(cause)));
        return false;
      }
    },
  };
}
