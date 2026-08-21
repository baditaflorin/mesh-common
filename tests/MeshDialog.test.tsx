// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MeshDialog } from "../src/ui/MeshDialog";

afterEach(cleanup);

describe("MeshDialog", () => {
  it("renders an accessible centered dialog with its description and footer", () => {
    render(
      <MeshDialog
        open
        onOpenChange={() => {}}
        title="Share room"
        description="Anyone with this link can join."
        footer={<button type="button">Copy link</button>}
      >
        <p>Invite URL</p>
      </MeshDialog>,
    );

    expect(screen.getByRole("dialog", { name: "Share room" })).toBeTruthy();
    expect(screen.getByText("Anyone with this link can join.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy link" })).toBeTruthy();
  });

  it("delegates Escape closing to the controlled state handler", () => {
    const onOpenChange = vi.fn();
    render(
      <MeshDialog open onOpenChange={onOpenChange} title="Share room">
        <p>Invite URL</p>
      </MeshDialog>,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
