// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MeshLaunch } from "../src/ui/MeshLaunch";
import { MeshPresence } from "../src/ui/MeshPresence";

afterEach(cleanup);

describe("MeshLaunch", () => {
  it("renders the complete launch entry and both native actions", () => {
    const start = vi.fn();
    const learnMore = vi.fn();

    render(
      <MeshLaunch
        eyebrow="Shared room"
        heading="Start together"
        promise="One room for everyone in front of the screen."
        presence="4 people are ready"
        preview={<div>Live room preview</div>}
        connectionHint="Room is ready to join"
        primaryAction={{ label: "Start now", onClick: start }}
        secondaryAction={{ label: "How it works", onClick: learnMore }}
      />,
    );

    expect(screen.getByRole("region", { name: "Start together" })).toBeTruthy();
    expect(
      screen.getByRole("heading", { level: 1, name: "Start together" }),
    ).toBeTruthy();
    expect(screen.getByText("Shared room")).toBeTruthy();
    expect(
      screen.getByText("One room for everyone in front of the screen."),
    ).toBeTruthy();
    expect(
      screen.getByText("4 people are ready").closest('[role="status"]'),
    ).toBeTruthy();
    expect(screen.getByText("Live room preview")).toBeTruthy();
    expect(screen.getByRole("group", { name: "Launch actions" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Start now" }));
    fireEvent.click(screen.getByRole("button", { name: "How it works" }));
    expect(start).toHaveBeenCalledOnce();
    expect(learnMore).toHaveBeenCalledOnce();
  });

  it("keeps the entry visible and supplies a status while connecting", () => {
    render(
      <MeshLaunch
        heading="Join the room"
        promise="Your shared space is being prepared."
        primaryAction={{ label: "Join" }}
        loading
      />,
    );

    const entry = screen.getByRole("region", { name: "Join the room" });
    expect(entry.getAttribute("aria-busy")).toBe("true");
    expect(screen.getByRole("heading", { name: "Join the room" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Join" })).toBeTruthy();
    expect(
      screen
        .getByText("Preparing your shared space…")
        .closest('[role="status"]'),
    ).toBeTruthy();
    expect(
      document.querySelector(".mesh-launch-connection-indicator"),
    ).toBeTruthy();
  });

  it("accepts block-level presence primitives without invalid paragraph nesting", () => {
    render(
      <MeshLaunch
        heading="Join the room"
        promise="Your shared space is ready."
        presence={<MeshPresence count={3} />}
        primaryAction={{ label: "Join" }}
      />,
    );

    const presence = document.querySelector(".mesh-launch-presence");
    expect(presence?.tagName).toBe("DIV");
    expect(presence?.querySelector(".mesh-presence")?.tagName).toBe("DIV");
  });
});
