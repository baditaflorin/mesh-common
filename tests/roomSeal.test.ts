import { describe, expect, it } from "vitest";
import { deriveRoomKey, sealerFromKey } from "../src/security/roomSeal";

describe("roomSeal", () => {
  it("derives a 32-byte key", () => {
    const k = deriveRoomKey("room", "pass", 1000);
    expect(k.length).toBe(32);
  });

  it("same (roomId, passphrase) → same key", () => {
    const a = deriveRoomKey("room", "pass", 1000);
    const b = deriveRoomKey("room", "pass", 1000);
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it("different room ID → different key", () => {
    const a = deriveRoomKey("alpha", "pass", 1000);
    const b = deriveRoomKey("beta", "pass", 1000);
    expect(Array.from(a)).not.toEqual(Array.from(b));
  });

  it("different passphrase → different key", () => {
    const a = deriveRoomKey("room", "one", 1000);
    const b = deriveRoomKey("room", "two", 1000);
    expect(Array.from(a)).not.toEqual(Array.from(b));
  });

  it("encrypt + decrypt round-trips strings", () => {
    const k = deriveRoomKey("room", "pass", 1000);
    const s = sealerFromKey(k);
    const ct = s.encrypt("hello world");
    expect(s.decryptText(ct)).toBe("hello world");
  });

  it("encrypt yields fresh ciphertext each call (random nonce)", () => {
    const k = deriveRoomKey("room", "pass", 1000);
    const s = sealerFromKey(k);
    expect(s.encrypt("x")).not.toBe(s.encrypt("x"));
  });

  it("decrypt with wrong key returns null", () => {
    const a = sealerFromKey(deriveRoomKey("room", "right", 1000));
    const b = sealerFromKey(deriveRoomKey("room", "wrong", 1000));
    const ct = a.encrypt("secret");
    expect(b.decryptText(ct)).toBeNull();
  });

  it("tampered ciphertext returns null (GCM auth tag rejects)", () => {
    const k = deriveRoomKey("room", "pass", 1000);
    const s = sealerFromKey(k);
    const ct = s.encrypt("secret");
    // Flip the last byte.
    const tampered = ct.slice(0, -2) + (ct.slice(-2) === "00" ? "ff" : "00");
    expect(s.decryptText(tampered)).toBeNull();
  });

  it("fingerprint is deterministic and 8 hex chars", () => {
    const a = sealerFromKey(deriveRoomKey("room", "pass", 1000));
    const b = sealerFromKey(deriveRoomKey("room", "pass", 1000));
    expect(a.fingerprint).toBe(b.fingerprint);
    expect(a.fingerprint).toMatch(/^[0-9a-f]{8}$/);
  });

  it("rejects empty roomId or passphrase", () => {
    expect(() => deriveRoomKey("", "pass")).toThrow();
    expect(() => deriveRoomKey("room", "")).toThrow();
  });
});
