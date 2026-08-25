// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MeshButton } from "../src/ui/MeshButton";
import { MeshPresence } from "../src/ui/MeshPresence";
import { MeshStatusPill } from "../src/ui/MeshStatusPill";
import { MeshSurface } from "../src/ui/MeshSurface";

afterEach(cleanup);

describe("MeshSurface", () => {
  it("keeps a semantic element and exposes visual hooks", () => {
    render(
      <MeshSurface
        as="section"
        aria-label="Shared board"
        tone="raised"
        padding="lg"
        bleedOnMobile
      >
        board content
      </MeshSurface>,
    );

    const surface = screen.getByRole("region", { name: "Shared board" });
    expect(surface.tagName).toBe("SECTION");
    expect(surface.getAttribute("data-tone")).toBe("raised");
    expect(surface.getAttribute("data-padding")).toBe("lg");
    expect(surface.className).toContain("mesh-surface-bleed-mobile");
  });
});

describe("MeshButton", () => {
  it("uses a native button, defaults to type=button, and blocks a loading action", () => {
    const onClick = vi.fn();
    render(
      <MeshButton
        variant="danger"
        size="lg"
        fullWidth
        loading
        onClick={onClick}
      >
        Remove entry
      </MeshButton>,
    );

    const button = screen.getByRole("button", { name: "Remove entry" });
    expect(button.getAttribute("type")).toBe("button");
    expect(button.getAttribute("data-variant")).toBe("danger");
    expect(button.getAttribute("data-size")).toBe("lg");
    expect(button.getAttribute("data-layout")).toBe("full-width");
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("MeshStatusPill", () => {
  it("keeps a decorative indicator out of the accessible name and can announce status", () => {
    render(
      <MeshStatusPill tone="live" dot announce="polite">
        Live now
      </MeshStatusPill>,
    );

    const status = screen.getByRole("status");
    expect(status.textContent).toBe("Live now");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.getAttribute("data-tone")).toBe("live");
    expect(
      status
        .querySelector(".mesh-status-pill-dot")
        ?.getAttribute("aria-hidden"),
    ).toBe("true");
  });
});

describe("MeshPresence", () => {
  it("normalizes an invalid count and exposes an accessible room status", () => {
    render(
      <MeshPresence
        count={-3}
        label="devices synced"
        state="connecting"
        announce="polite"
      />,
    );

    const presence = screen.getByRole("status");
    expect(presence.textContent).toBe("0 devices synced");
    expect(presence.getAttribute("aria-label")).toBe("0 devices synced");
    expect(presence.getAttribute("data-state")).toBe("connecting");
  });
});
