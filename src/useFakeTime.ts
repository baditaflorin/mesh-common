/**
 * Test-time injection point. In production, `now()` returns `Date.now()`.
 * In tests, you call `setFakeTime(ms)` / `advanceFakeTime(deltaMs)` to make
 * the module return a frozen or hand-advanced clock. `clockSync` honors this
 * via the optional `now` callback (or call this module directly).
 *
 *   import { setFakeTime, advanceFakeTime, now, resetFakeTime } from "@baditaflorin/mesh-common";
 *
 *   beforeEach(() => setFakeTime(0));
 *   afterEach(() => resetFakeTime());
 *
 *   it("expires after 30 min", () => {
 *     useExpiringClaim({ ttlMs: 1_800_000, now });
 *     advanceFakeTime(1_800_001);
 *     expect(...);
 *   });
 *
 * No global Date monkey-patching — explicit injection only. Modules that
 * want fake-time support take a `now` callback; this module supplies the
 * canonical implementation. The module-level singleton is intentional: it's
 * a test fixture, not production state.
 */

let fake: number | null = null;

export function now(): number {
  return fake ?? Date.now();
}

/** Freeze time at a specific ms-since-epoch. */
export function setFakeTime(ms: number): void {
  fake = ms;
}

/** Advance fake time by `deltaMs`. No-op if fake time isn't set. */
export function advanceFakeTime(deltaMs: number): void {
  if (fake === null) {
    throw new Error("advanceFakeTime called before setFakeTime — set a starting point first");
  }
  fake += deltaMs;
}

/** Stop faking — `now()` returns `Date.now()` again. */
export function resetFakeTime(): void {
  fake = null;
}

/** Is fake time currently active? */
export function isFakeTimeActive(): boolean {
  return fake !== null;
}
