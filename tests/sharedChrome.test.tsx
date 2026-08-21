// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createMeshConfig } from "../src/MeshConfig";
import { InviteShareButton } from "../src/InviteShareButton";
import { SettingsDrawer } from "../src/SettingsDrawer";

afterEach(cleanup);

const config = createMeshConfig({
  appName: "mesh-chrome-test",
  description: "test app",
  accentHex: "#abcdef",
  version: "1.0.0",
  commit: "test",
});

describe("shared app chrome", () => {
  it("opens the settings drawer as an accessible dialog and closes it with Escape", () => {
    const onClose = vi.fn();
    render(
      <SettingsDrawer
        config={config}
        open
        onClose={onClose}
        roomId="test-room"
        onRoomChange={() => {}}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Settings" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Room ID" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Signaling URL" })).toHaveProperty(
      "type",
      "url",
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("uses a real keyboard-operable button for the invite link", () => {
    render(<InviteShareButton appName="mesh-test" roomId="room-1" />);
    fireEvent.click(screen.getByRole("button", { name: /invite via qr/i }));

    expect(screen.getByRole("dialog", { name: "invite to mesh-test" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^https?:\/\// })).toBeTruthy();
  });
});
