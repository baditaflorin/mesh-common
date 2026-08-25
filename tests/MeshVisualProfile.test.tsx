// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { CSSProperties } from "react";
import {
  MESH_VISUAL_PROFILES,
  MeshVisualProfileProvider,
  getMeshVisualProfileTokens,
  isMeshVisualProfile,
  meshVisualProfileVariables,
} from "../src/ui/MeshVisualProfile";

afterEach(cleanup);

describe("MeshVisualProfile", () => {
  it("exposes the stable profile set and rejects unknown profile names", () => {
    expect(MESH_VISUAL_PROFILES).toEqual([
      "utility",
      "play",
      "studio",
      "gather",
      "field",
    ]);
    expect(isMeshVisualProfile("studio")).toBe(true);
    expect(isMeshVisualProfile("unknown")).toBe(false);
    expect(isMeshVisualProfile(null)).toBe(false);
  });

  it("maps every profile to complete semantic tokens and scoped variables", () => {
    for (const profile of MESH_VISUAL_PROFILES) {
      const tokens = getMeshVisualProfileTokens(profile);
      const variables = meshVisualProfileVariables(profile) as Record<
        string,
        string
      >;

      expect(tokens.canvas).toMatch(/^#/);
      expect(tokens.surface).toMatch(/^#/);
      expect(tokens.accent).toMatch(/^#/);
      expect(tokens.fontSans).toContain("system-ui");
      expect(variables["--mesh-canvas"]).toBe(tokens.canvas);
      expect(variables["--mesh-surface-raised"]).toBe(tokens.surfaceRaised);
      expect(variables["--mesh-accent"]).toBe(tokens.accent);
      expect(variables["--mesh-focus-ring"]).toBe(tokens.focusRing);
    }

    expect(getMeshVisualProfileTokens("play").canvas).not.toBe(
      getMeshVisualProfileTokens("utility").canvas,
    );
  });

  it("scopes profile variables without adding interactive or visual UI", () => {
    render(
      <MeshVisualProfileProvider
        profile="gather"
        data-testid="profile"
        aria-label="Shared room"
      >
        <button type="button">Start</button>
      </MeshVisualProfileProvider>,
    );

    const profile = screen.getByTestId("profile");
    expect(profile.tagName).toBe("DIV");
    expect(profile.getAttribute("data-mesh-visual-profile")).toBe("gather");
    expect(profile.getAttribute("role")).toBeNull();
    expect(profile.style.getPropertyValue("--mesh-canvas")).toBe(
      getMeshVisualProfileTokens("gather").canvas,
    );
    expect(screen.getByRole("button", { name: "Start" })).toBeTruthy();
  });

  it("allows an explicit host token override for controlled integration", () => {
    render(
      <MeshVisualProfileProvider
        profile="field"
        data-testid="profile"
        style={{ "--mesh-accent": "#123456" } as CSSProperties}
      >
        content
      </MeshVisualProfileProvider>,
    );

    expect(
      screen.getByTestId("profile").style.getPropertyValue("--mesh-accent"),
    ).toBe("#123456");
  });
});
