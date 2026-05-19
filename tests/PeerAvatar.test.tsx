// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { PeerAvatar } from "../src/PeerAvatar";

function srcOf(seed: string, variant: "beam" | "grid" = "beam"): string {
  const { container } = render(<PeerAvatar seed={seed} variant={variant} />);
  const img = container.querySelector("img");
  return img?.getAttribute("src") ?? "";
}

describe("PeerAvatar", () => {
  it("renders an inline-SVG data URI", () => {
    const src = srcOf("alice");
    expect(src).toMatch(/^data:image\/svg\+xml;utf8,/);
    expect(decodeURIComponent(src)).toContain("<svg");
  });

  it("is deterministic — same seed yields the same SVG", () => {
    expect(srcOf("alice")).toBe(srcOf("alice"));
    expect(srcOf("alice", "grid")).toBe(srcOf("alice", "grid"));
  });

  it("different seeds produce different SVGs", () => {
    expect(srcOf("alice")).not.toBe(srcOf("bob"));
  });

  it("beam vs grid produce different SVGs for the same seed", () => {
    expect(srcOf("alice", "beam")).not.toBe(srcOf("alice", "grid"));
  });

  it("grid is horizontally symmetric (mirror across center column)", () => {
    const { container } = render(<PeerAvatar seed="symmetry-check" variant="grid" />);
    const svg = decodeURIComponent(container.querySelector("img")!.getAttribute("src")!);
    // For every rect at x=0 we expect a rect at x=80; at x=20 → x=60.
    const rectX = (x: number) => (svg.match(new RegExp(`x="${x}" y="\\d+"`, "g")) ?? []).length;
    expect(rectX(0)).toBe(rectX(80));
    expect(rectX(20)).toBe(rectX(60));
  });

  it("uses the provided label for accessibility", () => {
    const { getByAltText } = render(<PeerAvatar seed="x" label="Alice's avatar" />);
    expect(getByAltText("Alice's avatar")).toBeTruthy();
  });

  it("falls back to a peerId-prefix mnemonic when no label is given", () => {
    const seed = "abcdef1234567890";
    const { getByAltText } = render(<PeerAvatar seed={seed} />);
    expect(getByAltText(`peer ${seed.slice(0, 6)}`)).toBeTruthy();
  });

  it("respects size prop", () => {
    const { container } = render(<PeerAvatar seed="x" size={64} />);
    const img = container.querySelector("img")!;
    expect(img.getAttribute("width")).toBe("64");
    expect(img.getAttribute("height")).toBe("64");
  });
});
