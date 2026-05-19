// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createMeshConfig } from "../src/MeshConfig";

const PREFIX = "mesh-test-bridge";
const FLEET_KEY = "mesh-fleet:v1:fleet";

function wipe() {
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState(null, "", "/");
}

beforeEach(wipe);
afterEach(wipe);

function makeConfig() {
  return createMeshConfig({
    appName: PREFIX,
    description: "",
    accentHex: "#000",
    version: "0",
    commit: "0",
  });
}

describe("createMeshConfig fleetPersona bridge", () => {
  it("hydrates all three per-app name keys from fleet on first load", () => {
    localStorage.setItem(
      FLEET_KEY,
      JSON.stringify({ nickname: "florin", name: "", avatarSeed: "", avatarVariant: "beam" }),
    );
    for (const k of ["displayName", "name", "myName"]) {
      expect(localStorage.getItem(`${PREFIX}:${k}`)).toBe(null);
    }

    makeConfig();

    // The bridge ran synchronously — each app's App.tsx useState will see "florin"
    // regardless of which key convention it uses.
    expect(localStorage.getItem(`${PREFIX}:displayName`)).toBe("florin");
    expect(localStorage.getItem(`${PREFIX}:name`)).toBe("florin");
    expect(localStorage.getItem(`${PREFIX}:myName`)).toBe("florin");
  });

  it("does NOT overwrite an existing per-app key (any convention)", () => {
    localStorage.setItem(`${PREFIX}:name`, "alice"); // mesh-mafia convention
    localStorage.setItem(
      FLEET_KEY,
      JSON.stringify({ nickname: "florin", name: "", avatarSeed: "", avatarVariant: "beam" }),
    );

    makeConfig();

    expect(localStorage.getItem(`${PREFIX}:name`)).toBe("alice");
  });

  it("publishes from `:name` (mesh-mafia convention) to fleet", () => {
    localStorage.setItem(`${PREFIX}:name`, "alice");
    makeConfig();
    const fleet = JSON.parse(localStorage.getItem(FLEET_KEY) ?? "null");
    expect(fleet?.nickname).toBe("alice");
  });

  it("publishes from `:displayName` (useNamedPeer convention) to fleet", () => {
    localStorage.setItem(`${PREFIX}:displayName`, "alice");
    makeConfig();
    const fleet = JSON.parse(localStorage.getItem(FLEET_KEY) ?? "null");
    expect(fleet?.nickname).toBe("alice");
  });

  it("publishes from `:myName` (mesh-applause convention) to fleet", () => {
    localStorage.setItem(`${PREFIX}:myName`, "alice");
    makeConfig();
    const fleet = JSON.parse(localStorage.getItem(FLEET_KEY) ?? "null");
    expect(fleet?.nickname).toBe("alice");
  });

  it("publish mirrors the value into the other per-app keys (same-tab same-app sync)", () => {
    localStorage.setItem(`${PREFIX}:name`, "alice");
    makeConfig();
    expect(localStorage.getItem(`${PREFIX}:displayName`)).toBe("alice");
    expect(localStorage.getItem(`${PREFIX}:myName`)).toBe("alice");
  });

  it("refuses to publish names that violate the strict-ASCII allowlist", () => {
    localStorage.setItem(`${PREFIX}:name`, "florín");
    makeConfig();
    expect(localStorage.getItem(FLEET_KEY)).toBe(null);

    localStorage.clear();
    localStorage.setItem(`${PREFIX}:name`, "alice🦊");
    makeConfig();
    expect(localStorage.getItem(FLEET_KEY)).toBe(null);

    localStorage.clear();
    localStorage.setItem(`${PREFIX}:name`, "a".repeat(33));
    makeConfig();
    expect(localStorage.getItem(FLEET_KEY)).toBe(null);
  });

  it("ignores a corrupt fleet entry (does not throw, does not hydrate)", () => {
    localStorage.setItem(FLEET_KEY, "not-json");
    expect(() => makeConfig()).not.toThrow();
    expect(localStorage.getItem(`${PREFIX}:displayName`)).toBe(null);
    expect(localStorage.getItem(`${PREFIX}:name`)).toBe(null);
    expect(localStorage.getItem(`${PREFIX}:myName`)).toBe(null);
  });

  it("uses fleet `name` as the fallback when `nickname` is empty", () => {
    localStorage.setItem(
      FLEET_KEY,
      JSON.stringify({ nickname: "", name: "Florin", avatarSeed: "", avatarVariant: "beam" }),
    );
    makeConfig();
    expect(localStorage.getItem(`${PREFIX}:displayName`)).toBe("Florin");
  });
});
