// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

import { safeText } from "../src/security/safeText";
import { safeUrl } from "../src/security/safeUrl";
import { safeJson } from "../src/security/safeJson";
import { useRateLimit } from "../src/security/useRateLimit";
import { useEphemeralKey } from "../src/security/useEphemeralKey";
import { useStorageNamespace } from "../src/security/useStorageNamespace";
import { useOriginGuard } from "../src/security/useOriginGuard";
import { useYDocSizeGuard } from "../src/security/useYDocSizeGuard";
import { createMockRoom } from "../testing/createMockRoom";

const mem = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k: string, v: string) => mem.set(k, v),
  removeItem: (k: string) => mem.delete(k),
  clear: () => mem.clear(),
  key: (i: number) => Array.from(mem.keys())[i] ?? null,
  get length() {
    return mem.size;
  },
});
beforeEach(() => mem.clear());

describe("safeText", () => {
  it("strips bidi + zero-width chars and NFKC-normalizes", () => {
    const rtl = "‮abc"; // RTL override
    const zwj = "a​b"; // zero-width space
    expect(safeText(rtl)).toBe("abc");
    expect(safeText(zwj)).toBe("ab");
    // NFKC normalization: "ﬁ" (U+FB01) → "fi"
    expect(safeText("ﬁx")).toBe("fix");
  });
  it("trims + truncates", () => {
    expect(safeText("  hi  ")).toBe("hi");
    expect(safeText("abcdefghij", { maxLength: 5 })).toBe("abcd…");
  });
  it("never throws on null / undefined / number", () => {
    expect(safeText(null)).toBe("");
    expect(safeText(undefined)).toBe("");
    expect(safeText(42)).toBe("42");
  });
});

describe("safeUrl", () => {
  it("accepts http / https / mailto", () => {
    expect(safeUrl("https://example.com/")).toBe("https://example.com/");
    expect(safeUrl("mailto:foo@bar.com")).toBe("mailto:foo@bar.com");
  });
  it("rejects javascript:, data:, vbscript:", () => {
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("data:text/html,<script>")).toBeNull();
    expect(safeUrl("vbscript:msgbox")).toBeNull();
  });
  it("rejects oversized URLs", () => {
    const huge = "https://example.com/?" + "x".repeat(20_000);
    expect(safeUrl(huge)).toBeNull();
  });
});

describe("safeJson", () => {
  it("parses normal JSON", () => {
    const r = safeJson('{"a":1,"b":[1,2,3]}');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ a: 1, b: [1, 2, 3] });
  });
  it("rejects too-deep", () => {
    let s = "1";
    for (let i = 0; i < 50; i++) s = "[" + s + "]";
    const r = safeJson(s, { maxDepth: 10 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("too-deep");
  });
  it("rejects too-wide", () => {
    const arr = new Array(20_000).fill(1);
    const r = safeJson(JSON.stringify(arr), { maxWidth: 1000 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("too-wide");
  });
  it("rejects too-large", () => {
    const r = safeJson("x".repeat(10), { maxBytes: 5 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("too-large");
  });
  it("rejects malformed", () => {
    const r = safeJson("{not json");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("malformed");
  });
});

describe("useRateLimit", () => {
  it("denies after max takes within window", () => {
    const { result } = renderHook(() => useRateLimit({ max: 3, perMs: 60_000 }));
    expect(result.current.take()).toBe(true);
    expect(result.current.take()).toBe(true);
    expect(result.current.take()).toBe(true);
    expect(result.current.take()).toBe(false);
  });
  it("isolates buckets by key", () => {
    const { result } = renderHook(() => useRateLimit({ max: 1, perMs: 60_000 }));
    expect(result.current.take("a")).toBe(true);
    expect(result.current.take("a")).toBe(false);
    expect(result.current.take("b")).toBe(true);
  });
  it("reset(key) clears one bucket", () => {
    const { result } = renderHook(() => useRateLimit({ max: 1, perMs: 60_000 }));
    expect(result.current.take("x")).toBe(true);
    expect(result.current.take("x")).toBe(false);
    act(() => result.current.reset("x"));
    expect(result.current.take("x")).toBe(true);
  });
});

describe("useEphemeralKey", () => {
  it("two peers can encrypt + decrypt", () => {
    const a = renderHook(() => useEphemeralKey()).result.current;
    const b = renderHook(() => useEphemeralKey()).result.current;
    const ct = a.seal(b.pubkey, "secret message");
    const pt = b.openText(a.pubkey, ct);
    expect(pt).toBe("secret message");
  });
  it("third party cannot decrypt", () => {
    const a = renderHook(() => useEphemeralKey()).result.current;
    const b = renderHook(() => useEphemeralKey()).result.current;
    const c = renderHook(() => useEphemeralKey()).result.current;
    const ct = a.seal(b.pubkey, "hi");
    expect(c.openText(a.pubkey, ct)).toBeNull();
  });
  it("tampered ciphertext is rejected", () => {
    const a = renderHook(() => useEphemeralKey()).result.current;
    const b = renderHook(() => useEphemeralKey()).result.current;
    const ct = a.seal(b.pubkey, "hi");
    const tampered = ct.slice(0, -2) + "00";
    expect(b.openText(a.pubkey, tampered)).toBeNull();
  });
});

describe("useStorageNamespace", () => {
  it("prefixes keys and round-trips JSON", () => {
    const { result } = renderHook(() => useStorageNamespace("appA"));
    expect(result.current.set("k", { a: 1 })).toBe(true);
    expect(result.current.get("k")).toEqual({ a: 1 });
    expect(localStorage.getItem("appA:k")).toBe('{"a":1}');
  });
  it("rejects writes over per-key cap", () => {
    const { result } = renderHook(() => useStorageNamespace("appA", { maxBytesPerKey: 10 }));
    expect(result.current.set("k", "x".repeat(50))).toBe(false);
  });
  it("namespaces are isolated", () => {
    const a = renderHook(() => useStorageNamespace("appA"));
    const b = renderHook(() => useStorageNamespace("appB"));
    a.result.current.set("shared", 1);
    expect(b.result.current.get("shared")).toBeNull();
  });
});

describe("useOriginGuard", () => {
  it("flags unexpected origins", () => {
    Object.defineProperty(window, "location", {
      value: { origin: "https://evil.example" },
      writable: true,
    });
    const { result } = renderHook(() => useOriginGuard());
    expect(result.current.trusted).toBe(false);
    expect(result.current.warn).toBe(true);
  });
  it("trusts a github.io subdomain", () => {
    Object.defineProperty(window, "location", {
      value: { origin: "https://baditaflorin.github.io" },
      writable: true,
    });
    const { result } = renderHook(() => useOriginGuard());
    expect(result.current.trusted).toBe(true);
  });
});

describe("useYDocSizeGuard", () => {
  it("encodes doc size + computes fmt", () => {
    const room = createMockRoom();
    room.doc.getMap("test").set("k", "x".repeat(1000));
    const { result } = renderHook(() =>
      useYDocSizeGuard(room, { warnKB: 1, blockKB: 100, intervalMs: 10 }),
    );
    expect(result.current.bytes).toBeGreaterThan(0);
    expect(result.current.fmt).toMatch(/B|KB|MB/);
  });
});
