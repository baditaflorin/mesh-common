import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { createMockRoom } from "@baditaflorin/mesh-common/testing";
import { Feature } from "../../src/Feature";
import { config } from "../../src/config";

describe("Feature (component)", () => {
  it("renders a purposeful shared-space surface when connected", () => {
    const room = createMockRoom();
    render(<Feature room={room} config={config} />);
    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading).toBeInTheDocument();
    expect(screen.getByText("Live session")).toBeInTheDocument();
  });

  it("keeps the product surface visible while the room is connecting", () => {
    render(<Feature room={null} config={config} />);
    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading).toBeInTheDocument();
    expect(screen.getByText("Preparing session")).toBeInTheDocument();
  });
});
