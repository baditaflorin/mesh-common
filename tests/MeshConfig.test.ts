import { describe, expect, it } from "vitest";
import {
  createMeshConfig,
  humanizeMeshAppName,
  meshAccentText,
} from "../src/MeshConfig";

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

  it("derives a human product name and calm visual profile from the stable id", () => {
    const c = createMeshConfig({
      appName: "mesh-2fa-bridge",
      description: "x",
      accentHex: "#abc",
      version: "0.1.0",
      commit: "abc",
    });
    expect(c.appName).toBe("mesh-2fa-bridge");
    expect(c.displayName).toBe("2FA Bridge");
    expect(c.visualProfile).toBe("utility");
    expect(c.shellLayout).toBeUndefined();
  });
});

describe("humanizeMeshAppName", () => {
  it.each([
    ["mesh-crowd-map", "Crowd Map"],
    ["mesh-qr-snake", "QR Snake"],
    ["mesh-API_lab", "API Lab"],
    ["mesh", "Mesh"],
  ])("renders %s as a user-facing name", (value, expected) => {
    expect(humanizeMeshAppName(value)).toBe(expected);
  });
});

describe("meshAccentText", () => {
  it("chooses an accessible foreground for light and dark hex accents", () => {
    expect(meshAccentText("#f5b942")).toBe("#000000");
    expect(meshAccentText("#8046a5")).toBe("#ffffff");
    expect(meshAccentText("#abc")).toBe("#000000");
  });

  it("retains a caller fallback for non-hex CSS colors", () => {
    expect(meshAccentText("hsl(200 80% 50%)", "#f1f5f9")).toBe("#f1f5f9");
  });
});

describe("createMeshConfig URL derivation", () => {
  it.each([
    [
      "mesh-foo",
      "https://github.com/baditaflorin/mesh-foo",
      "https://baditaflorin.github.io/mesh-foo/",
    ],
    [
      "mesh-2fa-bridge",
      "https://github.com/baditaflorin/mesh-2fa-bridge",
      "https://baditaflorin.github.io/mesh-2fa-bridge/",
    ],
    [
      "mesh-CASE-mix",
      "https://github.com/baditaflorin/mesh-CASE-mix",
      "https://baditaflorin.github.io/mesh-CASE-mix/",
    ],
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

  it("honours a product title and visual direction without changing the stable id", () => {
    const c = createMeshConfig({
      appName: "mesh-five-second-rule",
      displayName: "Five Second Rule",
      visualProfile: "play",
      shellLayout: "inset",
      description: "x",
      accentHex: "#abc",
      version: "0.1.0",
      commit: "abc",
    });
    expect(c.appName).toBe("mesh-five-second-rule");
    expect(c.displayName).toBe("Five Second Rule");
    expect(c.visualProfile).toBe("play");
    expect(c.shellLayout).toBe("inset");
  });
});
