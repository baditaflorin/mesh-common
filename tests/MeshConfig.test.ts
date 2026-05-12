import { describe, expect, it } from "vitest";
import { createMeshConfig } from "../src/MeshConfig";

describe("createMeshConfig defaults", () => {
  it("uses self-hosted signaling + TURN by default", () => {
    const c = createMeshConfig({
      appName: "mesh-foo",
      description: "x",
      accentHex: "#abc",
      version: "0.1.0",
      commit: "abc",
    });
    expect(c.signalingUrl).toBe("wss://turn.0docker.com/ws");
    expect(c.turnTokenUrl).toBe("https://turn.0docker.com/credentials");
  });

  it("uses florinbadita PayPal by default", () => {
    const c = createMeshConfig({
      appName: "mesh-foo",
      description: "x",
      accentHex: "#abc",
      version: "0.1.0",
      commit: "abc",
    });
    expect(c.paypalUrl).toBe("https://www.paypal.com/paypalme/florinbadita");
  });
});

describe("createMeshConfig URL derivation", () => {
  it.each([
    ["mesh-foo", "https://github.com/baditaflorin/mesh-foo", "https://baditaflorin.github.io/mesh-foo/"],
    ["mesh-2fa-bridge", "https://github.com/baditaflorin/mesh-2fa-bridge", "https://baditaflorin.github.io/mesh-2fa-bridge/"],
    ["mesh-CASE-mix", "https://github.com/baditaflorin/mesh-CASE-mix", "https://baditaflorin.github.io/mesh-CASE-mix/"],
  ])("for appName %s", (appName, expectedRepo, expectedPages) => {
    const c = createMeshConfig({
      appName,
      description: "x",
      accentHex: "#abc",
      version: "0.1.0",
      commit: "deadbeef",
    });
    expect(c.repositoryUrl).toBe(expectedRepo);
    expect(c.pagesUrl).toBe(expectedPages);
    expect(c.storagePrefix).toBe(appName);
  });
});

describe("createMeshConfig overrides", () => {
  it("accepts explicit signaling override", () => {
    const c = createMeshConfig({
      appName: "mesh-foo",
      description: "x",
      accentHex: "#abc",
      version: "0.1.0",
      commit: "abc",
      signalingUrl: "wss://custom/ws",
    });
    expect(c.signalingUrl).toBe("wss://custom/ws");
  });

  it("accepts explicit TURN token override", () => {
    const c = createMeshConfig({
      appName: "mesh-foo",
      description: "x",
      accentHex: "#abc",
      version: "0.1.0",
      commit: "abc",
      turnTokenUrl: "https://custom/cred",
    });
    expect(c.turnTokenUrl).toBe("https://custom/cred");
  });

  it("accepts explicit PayPal override (forks)", () => {
    const c = createMeshConfig({
      appName: "mesh-foo",
      description: "x",
      accentHex: "#abc",
      version: "0.1.0",
      commit: "abc",
      paypalUrl: "https://www.paypal.com/paypalme/someoneelse",
    });
    expect(c.paypalUrl).toBe("https://www.paypal.com/paypalme/someoneelse");
  });
});
