import { useEffect, useMemo, useRef, useState } from "react";
import type { ZodType, ZodTypeAny, output as ZOut } from "zod";
import type { YRoom } from "./useYRoom";

/**
 * Schema-validated wrappers around Y.Map and Y.Array. Catches "peer on old
 * client wrote junk" at the edge instead of letting it explode downstream.
 *
 * The mesh is open-ended: a peer running an older or hostile build can write
 * any shape into the shared CRDT. This module gates every read through a Zod
 * schema, dropping invalid entries with an optional `onInvalid` callback.
 *
 * Use case: a `Feature` declares its room schema once; reads are typed and
 * trusted, writes are validated before publish.
 *
 *   const ballotSchema = z.object({ vote: z.enum(["yes","no"]), round: z.number() });
 *   const ballots = useTypedMap(room, "ballots", ballotSchema);
 *   ballots.set(myPeer, { vote: "yes", round: 3 }); // validated
 *   ballots.values().forEach(b => …);               // typed Ballot
 *
 * The bundle cost is one `zod` import per app (~14 KB gzip, zero deps).
 */

export type TypedMap<S extends ZodTypeAny> = {
  /** All currently-valid entries. Invalid entries are filtered out. */
  entries: () => [string, ZOut<S>][];
  values: () => ZOut<S>[];
  keys: () => string[];
  size: number;
  get: (key: string) => ZOut<S> | undefined;
  has: (key: string) => boolean;
  /** Validate + write. Throws on invalid input. */
  set: (key: string, value: ZOut<S>) => void;
  /** Validate + write; returns the parse result instead of throwing. */
  safeSet: (key: string, value: unknown) => { ok: true } | { ok: false; error: string };
  delete: (key: string) => void;
  /** Validation errors observed on the *last* read (peer keyed → message). */
  lastInvalid: Record<string, string>;
};

export type TypedArray<S extends ZodTypeAny> = {
  /** All currently-valid items. Invalid items are filtered out. */
  items: ZOut<S>[];
  push: (value: ZOut<S>) => void;
  safePush: (value: unknown) => { ok: true } | { ok: false; error: string };
  delete: (index: number, count?: number) => void;
  size: number;
  lastInvalid: { index: number; error: string }[];
};

export type ContractOptions = {
  /** Called once per invalid entry observed. Useful for diagnostics. */
  onInvalid?: (key: string, error: string, raw: unknown) => void;
};

function describeIssue(err: unknown): string {
  if (err && typeof err === "object" && "issues" in err) {
    const issues = (err as { issues: { path: (string | number)[]; message: string }[] }).issues;
    return issues.map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`).join("; ");
  }
  return err instanceof Error ? err.message : String(err);
}

export function useTypedMap<S extends ZodTypeAny>(
  room: YRoom | null,
  key: string,
  schema: S,
  opts: ContractOptions = {},
): TypedMap<S> {
  const [tick, setTick] = useState(0);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    if (!room) return;
    const m = room.doc.getMap<unknown>(key);
    const cb = () => setTick((n) => n + 1);
    m.observe(cb);
    return () => m.unobserve(cb);
  }, [room, key]);

  const map = room ? room.doc.getMap<unknown>(key) : null;

  return useMemo<TypedMap<S>>(() => {
    const entries: [string, ZOut<S>][] = [];
    const lastInvalid: Record<string, string> = {};
    if (map) {
      map.forEach((raw, k) => {
        const parsed = (schema as ZodType<ZOut<S>>).safeParse(raw);
        if (parsed.success) {
          entries.push([k, parsed.data]);
        } else {
          const msg = describeIssue(parsed.error);
          lastInvalid[k] = msg;
          optsRef.current.onInvalid?.(k, msg, raw);
        }
      });
    }
    return {
      entries: () => entries,
      values: () => entries.map(([, v]) => v),
      keys: () => entries.map(([k]) => k),
      size: entries.length,
      get: (k) => entries.find(([kk]) => kk === k)?.[1],
      has: (k) => entries.some(([kk]) => kk === k),
      set: (k, v) => {
        const parsed = (schema as ZodType<ZOut<S>>).safeParse(v);
        if (!parsed.success) {
          throw new Error(`Invalid value for "${k}": ${describeIssue(parsed.error)}`);
        }
        map?.set(k, parsed.data);
      },
      safeSet: (k, v) => {
        const parsed = (schema as ZodType<ZOut<S>>).safeParse(v);
        if (!parsed.success) {
          return { ok: false, error: describeIssue(parsed.error) };
        }
        map?.set(k, parsed.data);
        return { ok: true };
      },
      delete: (k) => map?.delete(k),
      lastInvalid,
    };
  }, [map, schema, tick]);
}

export function useTypedArray<S extends ZodTypeAny>(
  room: YRoom | null,
  key: string,
  schema: S,
  opts: ContractOptions = {},
): TypedArray<S> {
  const [tick, setTick] = useState(0);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    if (!room) return;
    const arr = room.doc.getArray<unknown>(key);
    const cb = () => setTick((n) => n + 1);
    arr.observe(cb);
    return () => arr.unobserve(cb);
  }, [room, key]);

  const arr = room ? room.doc.getArray<unknown>(key) : null;

  return useMemo<TypedArray<S>>(() => {
    const items: ZOut<S>[] = [];
    const lastInvalid: { index: number; error: string }[] = [];
    if (arr) {
      arr.toArray().forEach((raw, i) => {
        const parsed = (schema as ZodType<ZOut<S>>).safeParse(raw);
        if (parsed.success) items.push(parsed.data);
        else {
          const msg = describeIssue(parsed.error);
          lastInvalid.push({ index: i, error: msg });
          optsRef.current.onInvalid?.(String(i), msg, raw);
        }
      });
    }
    return {
      items,
      size: items.length,
      push: (v) => {
        const parsed = (schema as ZodType<ZOut<S>>).safeParse(v);
        if (!parsed.success) {
          throw new Error(`Invalid push: ${describeIssue(parsed.error)}`);
        }
        arr?.push([parsed.data]);
      },
      safePush: (v) => {
        const parsed = (schema as ZodType<ZOut<S>>).safeParse(v);
        if (!parsed.success) {
          return { ok: false, error: describeIssue(parsed.error) };
        }
        arr?.push([parsed.data]);
        return { ok: true };
      },
      delete: (i, c = 1) => arr?.delete(i, c),
      lastInvalid,
    };
  }, [arr, schema, tick]);
}

/**
 * Declare a Feature's full room schema in one place. Call once per app:
 *
 *   export const contract = defineFeatureContract({
 *     ballots: z.object({ vote: z.enum(["yes","no"]) }),
 *     names: z.string().min(1).max(40),
 *   });
 *
 * Then in Feature.tsx:
 *
 *   const ballots = useTypedMap(room, "ballots", contract.ballots);
 *   const names   = useTypedMap(room, "names",   contract.names);
 *
 * It's just a typed identity wrapper — its job is to give one canonical place
 * for the per-app schema, which is what the docs-drift check looks at.
 */
export function defineFeatureContract<T extends Record<string, ZodTypeAny>>(shape: T): T {
  return shape;
}
