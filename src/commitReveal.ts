/**
 * Commit-reveal helpers built on Web Crypto SHA-256.
 *
 * Use case: anonymous votes, fair RNG, role assignment. Each peer first
 * publishes the SHA-256 hash of (salt || payload), then later publishes
 * (salt || payload) itself. Other peers verify that the revealed payload
 * matches the earlier commitment.
 */

const enc = new TextEncoder();

export type Commitment = { hash: string; salt: string };
export type Reveal = { salt: string; payload: string };

export function randomSalt(bytes = 16): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(input));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function commit(payload: string, salt: string = randomSalt()): Promise<Commitment> {
  const hash = await sha256Hex(`${salt}|${payload}`);
  return { hash, salt };
}

export async function verifyReveal(commitment: string, reveal: Reveal): Promise<boolean> {
  const expected = await sha256Hex(`${reveal.salt}|${reveal.payload}`);
  return expected === commitment;
}

/**
 * Fair group RNG: XOR every peer's revealed salt into a 32-byte seed.
 * Returns a number in [0, 1) that every peer computes identically.
 */
export function combineSalts(salts: string[]): number {
  const out = new Uint8Array(32);
  for (const s of salts) {
    const len = Math.min(s.length, 64);
    for (let i = 0; i < len; i += 2) {
      const byte = parseInt(s.slice(i, i + 2), 16);
      if (!Number.isNaN(byte)) {
        const idx = (i / 2) % 32;
        out[idx] = (out[idx] ?? 0) ^ byte;
      }
    }
  }
  const u =
    ((out[0] ?? 0) << 24) | ((out[1] ?? 0) << 16) | ((out[2] ?? 0) << 8) | (out[3] ?? 0);
  return ((u >>> 0) / 0x100000000);
}
