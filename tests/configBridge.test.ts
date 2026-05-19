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
  it("hydrates per-app myName from fleet on first load", () => {
    // Another app already published a fleet nickname.
    localStorage.setItem(
      FLEET_KEY,
      JSON.stringify({ nickname: "florin", name: "", avatarSeed: "", avatarVariant: "beam" }),
    );
    expect(localStorage.getItem(`${PREFIX}:myName`)).toBe(null);

    makeConfig();

    // The bridge ran synchronously — App.tsx's useState will see "florin".
    expect(localStorage.getItem(`${PREFIX}:myName`)).toBe("florin");
  });

  it("does NOT overwrite an existing per-app myName", () => {
    localStorage.setItem(`${PREFIX}:myName`, "alice");
    localStorage.setItem(
      FLEET_KEY,
      JSON.stringify({ nickname: "florin", name: "", avatarSeed: "", avatarVariant: "beam" }),
    );

    makeConfig();

    expect(localStorage.getItem(`${PREFIX}:myName`)).toBe("alice"); // L0 wins
  });

  it("publishes existing per-app myName to fleet when fleet is empty", () => {
    localStorage.setItem(`${PREFIX}:myName`, "alice");
    expect(localStorage.getItem(FLEET_KEY)).toBe(null);

    makeConfig();

    const fleet = JSON.parse(localStorage.getItem(FLEET_KEY) ?? "null");
    expect(fleet?.nickname).toBe("alice");
  });

  it("refuses to publish names that violate the strict-ASCII allowlist", () => {
    localStorage.setItem(`${PREFIX}:myName`, "florín"); // non-ASCII
    makeConfig();
    expect(localStorage.getItem(FLEET_KEY)).toBe(null);

    localStorage.setItem(`${PREFIX}:myName`, "alice🦊"); // emoji
    makeConfig();
    expect(localStorage.getItem(FLEET_KEY)).toBe(null);

    localStorage.setItem(`${PREFIX}:myName`, "a".repeat(33)); // too long
    makeConfig();
    expect(localStorage.getItem(FLEET_KEY)).toBe(null);
  });

  it("ignores a corrupt fleet entry (does not throw, does not hydrate)", () => {
    localStorage.setItem(FLEET_KEY, "not-json");
    expect(() => makeConfig()).not.toThrow();
    expect(localStorage.getItem(`${PREFIX}:myName`)).toBe(null);
  });

  it("uses fleet `name` as the fallback when `nickname` is empty", () => {
    localStorage.setItem(
      FLEET_KEY,
      JSON.stringify({ nickname: "", name: "Florin", avatarSeed: "", avatarVariant: "beam" }),
    );
    makeConfig();
    expect(localStorage.getItem(`${PREFIX}:myName`)).toBe("Florin");
  });
});
