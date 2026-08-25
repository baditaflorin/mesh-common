import {
  useSharedCollection,
  type SharedCollectionItem,
  type SharedCollection,
} from "./useSharedCollection";
import type { YRoom } from "./useYRoom";

export type SharedEntityAction =
  "read" | "create" | "update" | "remove" | "move" | "clear";

export type SharedEntityContext = {
  action: SharedEntityAction;
  room: YRoom | null;
  peerId?: string;
  deviceId?: string;
  roomId?: string;
  now: number;
};

export type SharedEntityDefinition<
  T extends SharedCollectionItem,
  CreateInput,
> = {
  /** Stable Y.Array key for this entity type. */
  key: string;
  /** Runtime boundary for every local write and every value exposed to UI. */
  validate: (value: unknown) => value is T;
  /** Construct a new entity from app input and a framework-generated stable id. */
  create: (
    input: CreateInput,
    context: SharedEntityContext & { id: string },
  ) => T;
  /** Optional deterministic/test-friendly id generator. */
  createId?: () => string;
  /**
   * Read-only decoder for older serialized shapes. It is never written back
   * automatically, so a migration cannot silently mutate remote history.
   */
  migrate?: (value: unknown, context: SharedEntityContext) => T | null;
  /** Add audit stamps such as `updatedAt`/`updatedBy` before local writes. */
  stamp?: (entity: T, context: SharedEntityContext) => T;
  /** Optional local policy gate for mutations. It is not an authorization system. */
  canMutate?: (
    action: Exclude<SharedEntityAction, "read">,
    entity: T | undefined,
    context: SharedEntityContext,
  ) => boolean;
  /** Inject a clock for audit fields and tests. Defaults to `Date.now`. */
  now?: () => number;
};

export type DefinedSharedEntityCollection<
  T extends SharedCollectionItem,
  CreateInput,
> = {
  /** Valid, decoded entities in shared display order. Invalid remote values remain untouched in the CRDT. */
  items: T[];
  /** Count of malformed/unsupported remote entries hidden from the UI. */
  invalidItems: number;
  byId: (id: string) => T | undefined;
  create: (input: CreateInput) => T | null;
  add: (entity: T) => boolean;
  update: (id: string, patch: Partial<Omit<T, "id">>) => boolean;
  /** Update from the latest shared value, avoiding stale closure writes. */
  mutate: (
    id: string,
    recipe: (current: Readonly<T>) => Partial<Omit<T, "id">> | null | undefined,
  ) => boolean;
  upsert: (entity: T) => boolean;
  remove: (id: string) => boolean;
  move: (id: string, toIndex: number) => boolean;
  clear: () => boolean;
};

export type DefinedSharedEntity<T extends SharedCollectionItem, CreateInput> = {
  key: string;
  /**
   * React hook over the entity's typed shared collection. Keep this at the
   * top level of a component, just like `useSharedCollection`.
   */
  useCollection: (
    room: YRoom | null,
  ) => DefinedSharedEntityCollection<T, CreateInput>;
};

let entityIdSequence = 0;

function generatedEntityId(): string {
  const randomUuid = globalThis.crypto?.randomUUID;
  if (typeof randomUuid === "function")
    return randomUuid.call(globalThis.crypto);
  entityIdSequence += 1;
  return `entity-${Date.now().toString(36)}-${entityIdSequence.toString(36)}`;
}

/**
 * Define a schema-checked collaborative entity once, then reuse its hook in
 * apps. It centralizes the otherwise repeated id generation, validation,
 * migration decoding, audit stamping, policy checks and safe update recipe.
 *
 * It deliberately does not turn a local `canMutate` predicate into security:
 * untrusted peers can still write a Yjs document, so use signed writes or room
 * seals when an app needs cryptographic authorization.
 */
export function defineSharedEntity<T extends SharedCollectionItem, CreateInput>(
  definition: SharedEntityDefinition<T, CreateInput>,
): DefinedSharedEntity<T, CreateInput> {
  const key = definition.key.trim();
  if (!key) throw new Error("defineSharedEntity: key is required");

  const now = definition.now ?? Date.now;
  const contextFor = (
    room: YRoom | null,
    action: SharedEntityAction,
  ): SharedEntityContext => ({
    action,
    room,
    peerId: room?.peerId,
    deviceId: room?.deviceId,
    roomId: room?.roomId,
    now: now(),
  });
  const decode = (value: unknown, context: SharedEntityContext): T | null => {
    const candidate = definition.migrate
      ? definition.migrate(value, context)
      : value;
    return definition.validate(candidate) ? candidate : null;
  };
  const allowed = (
    action: Exclude<SharedEntityAction, "read">,
    entity: T | undefined,
    context: SharedEntityContext,
  ) => definition.canMutate?.(action, entity, context) !== false;
  const stamped = (entity: T, context: SharedEntityContext): T =>
    definition.stamp ? definition.stamp(entity, context) : entity;

  return {
    key,
    useCollection(room) {
      // `useSharedCollection` remains the single CRDT implementation. This
      // factory only wraps its typed contract with reusable app policy.
      const collection: SharedCollection<T> = useSharedCollection<T>(
        room,
        key,
        {
          validate: definition.validate,
        },
      );
      const readContext = contextFor(room, "read");
      const decoded = collection.items.map((item) => decode(item, readContext));
      const items = decoded.filter((item): item is T => item !== null);
      const invalidItems = decoded.length - items.length;
      const byId = (id: string) =>
        id ? items.find((item) => item.id === id) : undefined;

      const add = (entity: T): boolean => {
        const context = contextFor(room, "create");
        if (
          !allowed("create", undefined, context) ||
          !definition.validate(entity)
        )
          return false;
        const next = stamped({ ...entity }, context);
        return (
          next.id === entity.id &&
          definition.validate(next) &&
          collection.add(next)
        );
      };

      const update = (id: string, patch: Partial<Omit<T, "id">>): boolean => {
        const current = byId(id);
        const context = contextFor(room, "update");
        if (!current || !allowed("update", current, context)) return false;
        const next = stamped({ ...current, ...patch, id }, context);
        if (next.id !== id || !definition.validate(next)) return false;
        return collection.update(id, next as Partial<Omit<T, "id">>);
      };

      return {
        items,
        invalidItems,
        byId,
        create: (input) => {
          const context = contextFor(room, "create");
          if (!allowed("create", undefined, context)) return null;
          const id = definition.createId?.() ?? generatedEntityId();
          const made = definition.create(input, { ...context, id });
          const next = stamped({ ...made }, context);
          if (
            next.id !== id ||
            !definition.validate(next) ||
            !collection.add(next)
          )
            return null;
          return next;
        },
        add,
        update,
        mutate: (id, recipe) => {
          const current = byId(id);
          if (!current) return false;
          const patch = recipe(Object.freeze({ ...current }));
          return patch ? update(id, patch) : false;
        },
        upsert: (entity) => {
          const current = byId(entity.id);
          return current ? update(entity.id, entity) : add(entity);
        },
        remove: (id) => {
          const current = byId(id);
          const context = contextFor(room, "remove");
          return Boolean(
            current &&
            allowed("remove", current, context) &&
            collection.remove(id),
          );
        },
        move: (id, toIndex) => {
          const current = byId(id);
          const context = contextFor(room, "move");
          return Boolean(
            current &&
            allowed("move", current, context) &&
            collection.move(id, toIndex),
          );
        },
        clear: () => {
          const context = contextFor(room, "clear");
          if (!allowed("clear", undefined, context)) return false;
          // Treat an already-empty collection as a successful no-op; callers
          // can use the boolean as policy/room availability feedback.
          if (!room) return false;
          collection.clear();
          return true;
        },
      };
    },
  };
}
