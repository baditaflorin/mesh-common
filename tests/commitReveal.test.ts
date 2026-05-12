import { describe, expect, it } from "vitest";
import { commit, combineSalts, randomSalt, sha256Hex, verifyReveal } from "../src/commitReveal";

describe("commitReveal", () => {
  it("randomSalt produces 32 hex chars for 16 bytes", () => {
    const s = randomSalt();
    expect(s).toMatch(/^[0-9a-f]{32}$/);
  });

  it("randomSalt is non-deterministic", () => {
    expect(randomSalt()).not.toBe(randomSalt());
  });

  it("sha256Hex matches a known fixture", async () => {
    expect(await sha256Hex("hello")).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
  });

  it("commit then verifyReveal roundtrips", async () => {
    const c = await commit("werewolf");
    const ok = await verifyReveal(c.hash, { salt: c.salt, payload: "werewolf" });
    expect(ok).toBe(true);
  });

  it("verifyReveal rejects tampered payload", async () => {
    const c = await commit("werewolf");
    const bad = await verifyReveal(c.hash, { salt: c.salt, payload: "villager" });
    expect(bad).toBe(false);
  });

  it("verifyReveal rejects tampered salt", async () => {
    const c = await commit("werewolf");
    const bad = await verifyReveal(c.hash, { salt: randomSalt(), payload: "werewolf" });
    expect(bad).toBe(false);
  });

  it("combineSalts is order-invariant (XOR is commutative)", () => {
    const a = randomSalt();
    const b = randomSalt();
    const c = randomSalt();
    expect(combineSalts([a, b, c])).toBe(combineSalts([c, b, a]));
  });

  it("combineSalts returns a value in [0, 1)", () => {
    for (let i = 0; i < 20; i++) {
      const v = combineSalts([randomSalt(), randomSalt(), randomSalt()]);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("combineSalts changes when any input changes", () => {
    const a = randomSalt();
    const b = randomSalt();
    const v1 = combineSalts([a, b]);
    const v2 = combineSalts([a, randomSalt()]);
    expect(v1).not.toBe(v2);
  });
});
