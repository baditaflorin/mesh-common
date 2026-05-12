import { describe, expect, it } from "vitest";
import {
  combineSalts,
  commit,
  randomSalt,
  sha256Hex,
  verifyReveal,
} from "../src/commitReveal";

/**
 * Matrix tests for the commit-reveal API contract. These cover the shapes
 * downstream apps (mesh-mafia, mesh-spyfall, mesh-2-truths-1-lie,
 * mesh-dare-wheel) will throw at the API.
 */

const payloadFixtures: Array<[label: string, payload: string]> = [
  ["empty string", ""],
  ["single char", "a"],
  ["ascii word", "werewolf"],
  ["sentence with spaces", "I have never been on TV"],
  ["unicode latin-extended", "naïve coördinate"],
  ["unicode cjk", "夜空"],
  ["unicode emoji", "🦄🌈"],
  ["null bytes", "a\0b\0c"],
  ["pipe char (commit delimiter)", "left|right"],
  ["multi-pipe", "a|b|c|d"],
  ["newlines + tabs", "line one\nline two\ttab"],
  ["double-byte digits", "０１２３"],
  ["json string", '{"role":"spy","seat":3}'],
  ["1k chars", "x".repeat(1024)],
  ["10k chars", "y".repeat(10240)],
  ["surrogate pair sandwich", "a🦄b"],
];

describe.each(payloadFixtures)("commit/reveal roundtrip — %s", (label, payload) => {
  it(`commits then verifies (${label})`, async () => {
    const c = await commit(payload);
    expect(c.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(c.salt).toMatch(/^[0-9a-f]{32}$/);
    const ok = await verifyReveal(c.hash, { salt: c.salt, payload });
    expect(ok).toBe(true);
  });

  it(`detects tampered payload (${label})`, async () => {
    const c = await commit(payload);
    const tampered = payload + "X";
    const ok = await verifyReveal(c.hash, { salt: c.salt, payload: tampered });
    expect(ok).toBe(false);
  });

  it(`detects tampered salt (${label})`, async () => {
    const c = await commit(payload);
    const ok = await verifyReveal(c.hash, { salt: randomSalt(), payload });
    expect(ok).toBe(false);
  });
});

describe("salt collision and entropy", () => {
  it("100 random salts are all distinct", () => {
    const set = new Set<string>();
    for (let i = 0; i < 100; i++) set.add(randomSalt());
    expect(set.size).toBe(100);
  });

  it("commit(same payload) twice yields different hashes (salt randomized)", async () => {
    const a = await commit("hi");
    const b = await commit("hi");
    expect(a.hash).not.toBe(b.hash);
    expect(a.salt).not.toBe(b.salt);
  });

  it("commit accepts explicit salt and is deterministic", async () => {
    const salt = randomSalt();
    const a = await commit("hi", salt);
    const b = await commit("hi", salt);
    expect(a.hash).toBe(b.hash);
  });
});

describe("sha256Hex known vectors", () => {
  it.each([
    ["", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
    ["abc", "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"],
    ["hello", "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"],
    ["The quick brown fox jumps over the lazy dog", "d7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592"],
  ])("sha256Hex(%s)", async (input, expected) => {
    expect(await sha256Hex(input)).toBe(expected);
  });
});

describe("combineSalts fair-RNG properties", () => {
  it("is in [0, 1) across 200 random combinations", () => {
    for (let i = 0; i < 200; i++) {
      const n = 1 + Math.floor(Math.random() * 10);
      const salts = Array.from({ length: n }, () => randomSalt());
      const v = combineSalts(salts);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it.each([
    ["single peer", 1],
    ["two peers", 2],
    ["three peers", 3],
    ["five peers", 5],
    ["ten peers", 10],
  ])("is reproducible for fixed salts (%s)", (_label, n) => {
    const salts = Array.from({ length: n }, () => randomSalt());
    const v1 = combineSalts(salts);
    const v2 = combineSalts(salts);
    expect(v1).toBe(v2);
  });

  it("flipping the first byte of any salt changes the output", () => {
    // combineSalts derives its float from the first 4 bytes of the XOR'd
    // seed, so we modify byte 0 to guarantee the assertion is meaningful.
    const a = randomSalt();
    const b = randomSalt();
    const firstByte = b.slice(0, 2);
    const otherByte = firstByte === "ff" ? "00" : "ff";
    const flippedB = otherByte + b.slice(2);
    expect(combineSalts([a, b])).not.toBe(combineSalts([a, flippedB]));
  });

  it("empty salt list returns 0 (zero-byte seed)", () => {
    expect(combineSalts([])).toBe(0);
  });

  it("handles odd-length hex strings without throwing", () => {
    expect(() => combineSalts(["abc"])).not.toThrow();
  });

  it("ignores non-hex bytes safely", () => {
    expect(() => combineSalts(["zz", "abcd"])).not.toThrow();
  });
});
