/**
 * @vitest-environment jsdom
 *
 * Matrix tests for iceConfig — the localStorage-backed signaling / TURN
 * override layer that every mesh-* app depends on.
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_ICE_SERVERS,
  iceStorage,
  loadIceServers,
  loadSignalingUrl,
  loadTurnTokenUrl,
  resetIceServers,
  saveIceServers,
  saveSignalingUrl,
  saveTurnTokenUrl,
} from "../src/iceConfig";

const DEFAULTS = {
  signalingUrl: "wss://example.test/ws",
  turnTokenUrl: "https://example.test/credentials",
};

function makeStorage(prefix = "test-app") {
  return iceStorage(prefix, DEFAULTS);
}

beforeEach(() => {
  localStorage.clear();
});

describe("loadSignalingUrl", () => {
  it.each([
    ["unset → falls back to default", null, DEFAULTS.signalingUrl],
    ["empty string → falls back to default", "", DEFAULTS.signalingUrl],
    ["set → returned verbatim", "wss://my.custom/ws", "wss://my.custom/ws"],
    [
      "dead yjs.dev server → pruned and default returned",
      "wss://signaling.yjs.dev",
      DEFAULTS.signalingUrl,
    ],
    [
      "dead yjs.dev (ws://) → pruned and default returned",
      "ws://signaling.yjs.dev",
      DEFAULTS.signalingUrl,
    ],
  ])("%s", (_label, stored, expected) => {
    const s = makeStorage();
    if (stored !== null) localStorage.setItem(s.signalingKey, stored);
    expect(loadSignalingUrl(s)).toBe(expected);
  });

  it("dead server is removed from storage as a side effect", () => {
    const s = makeStorage();
    localStorage.setItem(s.signalingKey, "wss://signaling.yjs.dev");
    loadSignalingUrl(s);
    expect(localStorage.getItem(s.signalingKey)).toBeNull();
  });
});

describe("saveSignalingUrl", () => {
  it.each([
    ["non-empty url", "wss://example/ws", "wss://example/ws"],
    ["url with whitespace", "  wss://example/ws  ", "wss://example/ws"],
  ])("saves: %s", (_label, input, expected) => {
    const s = makeStorage();
    saveSignalingUrl(s, input);
    expect(localStorage.getItem(s.signalingKey)).toBe(expected);
  });

  it.each([
    ["empty string clears", ""],
    ["only whitespace clears", "   "],
  ])("%s", (_label, input) => {
    const s = makeStorage();
    localStorage.setItem(s.signalingKey, "previous");
    saveSignalingUrl(s, input);
    expect(localStorage.getItem(s.signalingKey)).toBeNull();
  });
});

describe("loadTurnTokenUrl / saveTurnTokenUrl mirror signaling behavior", () => {
  it("unset → default", () => {
    expect(loadTurnTokenUrl(makeStorage())).toBe(DEFAULTS.turnTokenUrl);
  });

  it("set → custom", () => {
    const s = makeStorage();
    saveTurnTokenUrl(s, "https://my.token/cred");
    expect(loadTurnTokenUrl(s)).toBe("https://my.token/cred");
  });

  it("empty clears back to default", () => {
    const s = makeStorage();
    saveTurnTokenUrl(s, "https://x");
    saveTurnTokenUrl(s, "");
    expect(loadTurnTokenUrl(s)).toBe(DEFAULTS.turnTokenUrl);
  });
});

describe("loadIceServers / saveIceServers", () => {
  it("returns DEFAULT_ICE_SERVERS when localStorage is empty", () => {
    expect(loadIceServers(makeStorage())).toEqual(DEFAULT_ICE_SERVERS);
  });

  it.each([
    ["empty array", "[]"],
    ["not an array", '{"urls":"stun:x"}'],
    ["invalid json", "{not-json"],
    ["null", "null"],
  ])("falls back to defaults on bad payload: %s", (_label, raw) => {
    const s = makeStorage();
    localStorage.setItem(s.iceKey, raw);
    expect(loadIceServers(s)).toEqual(DEFAULT_ICE_SERVERS);
  });

  it("round-trips a valid ICE server list", () => {
    const s = makeStorage();
    const servers = [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "turn:turn.example/3479", username: "u", credential: "p" },
    ];
    saveIceServers(s, servers);
    expect(loadIceServers(s)).toEqual(servers);
  });

  it("resetIceServers removes the key", () => {
    const s = makeStorage();
    saveIceServers(s, [{ urls: "stun:x" }]);
    resetIceServers(s);
    expect(localStorage.getItem(s.iceKey)).toBeNull();
    expect(loadIceServers(s)).toEqual(DEFAULT_ICE_SERVERS);
  });
});

describe("multi-prefix isolation (two apps sharing one origin)", () => {
  it("prefix A and prefix B store independently", () => {
    const a = makeStorage("mesh-when2meet");
    const b = makeStorage("mesh-potluck");
    saveSignalingUrl(a, "wss://a-only/ws");
    saveSignalingUrl(b, "wss://b-only/ws");
    expect(loadSignalingUrl(a)).toBe("wss://a-only/ws");
    expect(loadSignalingUrl(b)).toBe("wss://b-only/ws");
  });

  it.each(["mesh-firefly-walk", "mesh-2fa-bridge", "MESH-WEIRD-CASE"])(
    "key shape uses literal prefix: %s",
    (prefix) => {
      const s = makeStorage(prefix);
      expect(s.iceKey).toBe(`${prefix}:iceServers`);
      expect(s.signalingKey).toBe(`${prefix}:signalingUrl`);
      expect(s.tokenUrlKey).toBe(`${prefix}:turnTokenUrl`);
    },
  );
});
