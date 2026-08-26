// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MeshAppFrame } from "../src/MeshAppFrame";
import { createMeshConfig } from "../src/MeshConfig";
import { MeshShell } from "../src/MeshShell";
import { MeshBreadcrumbs } from "../src/ui/MeshBreadcrumbs";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("MeshBreadcrumbs", () => {
  it("uses links and buttons for prior locations and exposes the final location as current", () => {
    const returnToLobby = vi.fn();
    render(
      <MeshBreadcrumbs
        ariaLabel="Workspace breadcrumb"
        items={[
          { id: "home", label: "Home", href: "./" },
          { id: "lobby", label: "Lobby", onClick: returnToLobby },
          { id: "review", label: "Review" },
        ]}
      />,
    );

    expect(
      screen.getByRole("navigation", { name: "Workspace breadcrumb" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Home" }).getAttribute("href"),
    ).toBe("./");
    fireEvent.click(screen.getByRole("button", { name: "Lobby" }));
    expect(returnToLobby).toHaveBeenCalledOnce();
    expect(screen.getByText("Review").getAttribute("aria-current")).toBe(
      "page",
    );
  });

  it("does not render an empty navigation landmark", () => {
    const { container } = render(<MeshBreadcrumbs items={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders config trails in modern shell chrome and keeps disabled trails out", () => {
    localStorage.setItem("__mesh_beacon_optout", "1");
    const config = createMeshConfig({
      appName: "mesh-breadcrumb-shell",
      displayName: "Breadcrumb Shell",
      shellLayout: "inset",
      breadcrumbs: {
        items: [{ label: "Workspace", href: "./" }, { label: "Queue" }],
      },
      description: "test",
      accentHex: "#123456",
      version: "1.0.0",
      commit: "test",
    });
    const { rerender } = render(
      <MeshShell
        config={config}
        fleetIdentityServiceUrl={null}
        onRoomChange={() => {}}
        roomId="test-room"
      >
        <p>Feature</p>
      </MeshShell>,
    );

    expect(
      screen.getByRole("navigation", { name: "Breadcrumb Shell location" }),
    ).toBeTruthy();
    expect(screen.getByText("Queue").getAttribute("aria-current")).toBe("page");
    expect(
      document
        .querySelector("[data-mesh-app-shell]")
        ?.getAttribute("data-mesh-breadcrumbs"),
    ).toBe("enabled");

    rerender(
      <MeshShell
        config={{ ...config, breadcrumbs: false }}
        fleetIdentityServiceUrl={null}
        onRoomChange={() => {}}
        roomId="test-room"
      >
        <p>Feature</p>
      </MeshShell>,
    );
    expect(
      screen.queryByRole("navigation", {
        name: "Breadcrumb Shell location",
      }),
    ).toBeNull();
  });

  it("lets a MeshAppFrame display a feature-specific trail", () => {
    render(
      <MeshAppFrame
        breadcrumbs={[
          { label: "Plan", href: "#plan" },
          { label: "Milestones" },
        ]}
        connection={false}
        title="Milestones"
      >
        <p>Feature content</p>
      </MeshAppFrame>,
    );

    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeTruthy();
    expect(
      screen
        .getByRole("navigation", { name: "Breadcrumb" })
        .querySelector('[aria-current="page"]')?.textContent,
    ).toBe("Milestones");
  });
});
