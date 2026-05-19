import { afterEach, describe, expect, it } from "vitest";
import {
  advanceFakeTime,
  isFakeTimeActive,
  now,
  resetFakeTime,
  setFakeTime,
} from "../src/useFakeTime";

afterEach(() => resetFakeTime());

describe("useFakeTime", () => {
  it("now() returns Date.now() when fake time isn't active", () => {
    expect(isFakeTimeActive()).toBe(false);
    const real = Date.now();
    const v = now();
    // Allow a tiny clock drift; what matters is "approximately Date.now()".
    expect(Math.abs(v - real)).toBeLessThan(50);
  });

  it("setFakeTime freezes now() at the given value", () => {
    setFakeTime(1_700_000_000_000);
    expect(now()).toBe(1_700_000_000_000);
    expect(now()).toBe(1_700_000_000_000); // not auto-advancing
    expect(isFakeTimeActive()).toBe(true);
  });

  it("advanceFakeTime moves the clock forward", () => {
    setFakeTime(1_000);
    advanceFakeTime(500);
    expect(now()).toBe(1_500);
    advanceFakeTime(250);
    expect(now()).toBe(1_750);
  });

  it("advanceFakeTime without setFakeTime throws", () => {
    expect(() => advanceFakeTime(10)).toThrow(/before setFakeTime/);
  });

  it("resetFakeTime returns now() to Date.now()", () => {
    setFakeTime(0);
    expect(now()).toBe(0);
    resetFakeTime();
    expect(isFakeTimeActive()).toBe(false);
    expect(now()).toBeGreaterThan(1_700_000_000_000);
  });
});
