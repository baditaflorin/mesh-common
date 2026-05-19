// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_PERSONA,
  FleetPersonaStorageKeys,
  buildHandoffUrl,
  clearFleetLocalPersona,
  clearLocalPersona,
  clearRemoteCredentials,
  consumeHandoffFromHash,
  deleteRemotePersona,
  ensureAnonId,
  ensureWriteToken,
  fetchRemotePersona,
  isPersonaEmpty,
  isValidAvatarSeed,
  isValidPersonaField,
  publishRemotePersona,
  readAnonId,
  readFleetLocalPersona,
  readLocalPersona,
  readMode,
  readWriteToken,
  resolvePersonaSync,
  sanitizePersona,
  setRemoteCredentials,
  writeFleetLocalPersona,
  writeLocalPersona,
  writeMode,
} from "../src/fleetPersona";

const APP = "test-app";
const APP2 = "another-app";

function wipe() {
  localStorage.clear();
  window.history.replaceState(null, "", window.location.pathname);
}

beforeEach(wipe);
afterEach(wipe);

describe("validation", () => {
  it("accepts strict-ASCII fields up to 32 chars", () => {
    expect(isValidPersonaField("")).toBe(true);
    expect(isValidPersonaField("florin")).toBe(true);
    expect(isValidPersonaField("florin badita")).toBe(true);
    expect(isValidPersonaField("a-b_c.d")).toBe(true);
    expect(isValidPersonaField("a".repeat(32))).toBe(true);
  });

  it("rejects too-long / unsafe / non-ASCII", () => {
    expect(isValidPersonaField("a".repeat(33))).toBe(false);
    expect(isValidPersonaField("<script>")).toBe(false);
    expect(isValidPersonaField("flor!n")).toBe(false);
    expect(isValidPersonaField("florín")).toBe(false);
    expect(isValidPersonaField("emoji 🦊")).toBe(false);
  });

  it("avatar seed allows letters/digits/_/- up to 64", () => {
    expect(isValidAvatarSeed("")).toBe(true);
    expect(isValidAvatarSeed("a-b_c123")).toBe(true);
    expect(isValidAvatarSeed("seed with space")).toBe(false);
    expect(isValidAvatarSeed("a".repeat(65))).toBe(false);
  });

  it("sanitizePersona drops invalid fields silently", () => {
    const out = sanitizePersona({
      nickname: "ok",
      name: "<bad>",
      avatarSeed: "fine_seed",
      avatarVariant: "unknown" as never,
      paletteIndex: -1,
    });
    expect(out).toEqual({
      nickname: "ok",
      name: "",
      avatarSeed: "fine_seed",
      avatarVariant: "beam",
      paletteIndex: undefined,
    });
  });

  it("isPersonaEmpty handles default", () => {
    expect(isPersonaEmpty(DEFAULT_PERSONA)).toBe(true);
    expect(isPersonaEmpty({ ...DEFAULT_PERSONA, nickname: "x" })).toBe(false);
  });
});

describe("L0 + L1 storage", () => {
  it("L0 round-trips per app, isolated from other apps", () => {
    writeLocalPersona(APP, { ...DEFAULT_PERSONA, nickname: "a" });
    writeLocalPersona(APP2, { ...DEFAULT_PERSONA, nickname: "b" });
    expect(readLocalPersona(APP)?.nickname).toBe("a");
    expect(readLocalPersona(APP2)?.nickname).toBe("b");
    clearLocalPersona(APP);
    expect(readLocalPersona(APP)).toBe(null);
    expect(readLocalPersona(APP2)?.nickname).toBe("b");
  });

  it("L1 is shared across apps on the same origin", () => {
    writeFleetLocalPersona({ ...DEFAULT_PERSONA, nickname: "fleet-name" });
    expect(readFleetLocalPersona()?.nickname).toBe("fleet-name");
    clearFleetLocalPersona();
    expect(readFleetLocalPersona()).toBe(null);
  });

  it("invalid input is sanitized on the way in (defence in depth)", () => {
    writeLocalPersona(APP, { ...DEFAULT_PERSONA, nickname: "<bad>" as never });
    expect(readLocalPersona(APP)?.nickname).toBe("");
  });
});

describe("mode storage", () => {
  it("returns default fallback on first read", () => {
    expect(readMode(APP, "local-fleet")).toBe("local-fleet");
    expect(readMode(APP, "off")).toBe("off");
  });

  it("round-trips a known mode", () => {
    writeMode(APP, "remote-fleet");
    expect(readMode(APP)).toBe("remote-fleet");
  });

  it("ignores junk values", () => {
    localStorage.setItem(FleetPersonaStorageKeys.modeKey(APP), JSON.stringify("garbage"));
    expect(readMode(APP, "off")).toBe("off");
  });
});

describe("resolvePersonaSync", () => {
  it("L0 wins over L1", () => {
    writeFleetLocalPersona({ ...DEFAULT_PERSONA, nickname: "fleet" });
    writeLocalPersona(APP, { ...DEFAULT_PERSONA, nickname: "local" });
    const r = resolvePersonaSync(APP, "local-fleet");
    expect(r.source).toBe("local");
    expect(r.persona.nickname).toBe("local");
  });

  it("falls back to L1 when L0 is empty", () => {
    writeFleetLocalPersona({ ...DEFAULT_PERSONA, nickname: "fleet" });
    const r = resolvePersonaSync(APP, "local-fleet");
    expect(r.source).toBe("fleet-local");
    expect(r.persona.nickname).toBe("fleet");
  });

  it("mode=off never reads L1", () => {
    writeFleetLocalPersona({ ...DEFAULT_PERSONA, nickname: "fleet" });
    const r = resolvePersonaSync(APP, "off");
    expect(r.source).toBe("default");
  });

  it("default-source persona is empty", () => {
    const r = resolvePersonaSync(APP, "local-fleet");
    expect(r.source).toBe("default");
    expect(isPersonaEmpty(r.persona)).toBe(true);
  });
});

describe("anon id + write token", () => {
  it("creates and reuses both", () => {
    const a = ensureAnonId();
    expect(a).toMatch(/^[a-f0-9]{32}$/);
    expect(ensureAnonId()).toBe(a);

    const t = ensureWriteToken();
    expect(t).toMatch(/^[a-f0-9]{32}$/);
    expect(t).not.toBe(a); // independent randomness
    expect(ensureWriteToken()).toBe(t);

    clearRemoteCredentials();
    expect(readAnonId()).toBe(null);
    expect(readWriteToken()).toBe(null);
  });

  it("setRemoteCredentials rejects non-hex values", () => {
    setRemoteCredentials("nope", "alsonope");
    expect(readAnonId()).toBe(null);
  });

  it("setRemoteCredentials accepts valid hex", () => {
    const a = "a".repeat(32);
    const b = "b".repeat(32);
    setRemoteCredentials(a, b);
    expect(readAnonId()).toBe(a);
    expect(readWriteToken()).toBe(b);
  });
});

describe("handoff URL", () => {
  it("round-trips through the URL fragment", () => {
    const anonId = "1".repeat(32);
    const writeToken = "2".repeat(32);
    const persona = sanitizePersona({ nickname: "florin", name: "Florin Badita", avatarVariant: "grid" });
    const url = buildHandoffUrl("https://other.example", anonId, writeToken, persona);
    expect(url).toMatch(/^https:\/\/other\.example\/#fp=/);

    // Simulate landing on the other origin: load the hash, then consume.
    const fragment = new URL(url).hash;
    window.history.replaceState(null, "", "/landed" + fragment);
    const out = consumeHandoffFromHash();
    expect(out?.anonId).toBe(anonId);
    expect(out?.writeToken).toBe(writeToken);
    expect(out?.persona.nickname).toBe("florin");
    expect(out?.persona.avatarVariant).toBe("grid");

    // Hash should be wiped after consumption.
    expect(window.location.hash).toBe("");

    // Second call returns null.
    expect(consumeHandoffFromHash()).toBe(null);
  });

  it("ignores malformed payloads", () => {
    window.history.replaceState(null, "", "/#fp=not-base64");
    expect(consumeHandoffFromHash()).toBe(null);
  });

  it("rejects non-hex anonId / writeToken from a tampered fragment", () => {
    const payload = btoa(JSON.stringify({ v: 1, anonId: "x", writeToken: "y", p: {} }));
    window.history.replaceState(null, "", `/#fp=${encodeURIComponent(payload)}`);
    expect(consumeHandoffFromHash()).toBe(null);
  });
});

describe("service client (mock fetch)", () => {
  it("fetch returns a sanitized persona on 200", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ nickname: "remote", name: "evil<script>", avatarVariant: "grid" }),
    });
    const p = await fetchRemotePersona({ serviceUrl: "https://x", fetchImpl: fetchImpl as never }, "a".repeat(32));
    expect(p?.nickname).toBe("remote");
    // server-side junk is sanitized client-side too (belt + braces)
    expect(p?.name).toBe("");
    expect(p?.avatarVariant).toBe("grid");
  });

  it("fetch swallows network errors (returns null)", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("boom"));
    const p = await fetchRemotePersona({ serviceUrl: "https://x", fetchImpl: fetchImpl as never }, "a".repeat(32));
    expect(p).toBe(null);
  });

  it("fetch swallows non-2xx (returns null)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    const p = await fetchRemotePersona({ serviceUrl: "https://x", fetchImpl: fetchImpl as never }, "a".repeat(32));
    expect(p).toBe(null);
  });

  it("fetch times out without throwing", async () => {
    const slow = new Promise(() => {
      /* never resolves */
    });
    const fetchImpl = vi.fn().mockReturnValue(slow);
    const p = await fetchRemotePersona(
      { serviceUrl: "https://x", fetchTimeoutMs: 10, fetchImpl: fetchImpl as never },
      "a".repeat(32),
    );
    expect(p).toBe(null);
  });

  it("publish sends the write token in the body", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    await publishRemotePersona(
      { serviceUrl: "https://x", fetchImpl: fetchImpl as never },
      "a".repeat(32),
      "b".repeat(32),
      { ...DEFAULT_PERSONA, nickname: "florin" },
    );
    const call = fetchImpl.mock.calls[0]!;
    expect(call[0]).toBe("https://x/v1/persona/" + "a".repeat(32));
    expect(call[1].method).toBe("PUT");
    const body = JSON.parse(call[1].body as string);
    expect(body.nickname).toBe("florin");
    expect(body.writeToken).toBe("b".repeat(32));
  });

  it("delete sends the write token in the body", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    await deleteRemotePersona(
      { serviceUrl: "https://x", fetchImpl: fetchImpl as never },
      "a".repeat(32),
      "b".repeat(32),
    );
    const call = fetchImpl.mock.calls[0]!;
    expect(call[1].method).toBe("DELETE");
    const body = JSON.parse(call[1].body as string);
    expect(body.writeToken).toBe("b".repeat(32));
  });
});
