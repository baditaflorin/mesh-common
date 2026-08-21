// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { MeshLiveRegion } from "../src/MeshLiveRegion";
import { MeshQrDialog } from "../src/MeshQrDialog";
import { useCrdtSnapshot } from "../src/useCrdtSnapshot";
import { renderHook } from "@testing-library/react";
describe("third primitive wave", () => {
  it("restores an encoded CRDT snapshot", () => { const doc = new Y.Doc(); doc.getMap<string>("x").set("a", "one"); const source = renderHook(() => useCrdtSnapshot(doc)); const bytes = source.result.current.exportJson(); const target = new Y.Doc(); const restored = renderHook(() => useCrdtSnapshot(target)); expect(restored.result.current.restore(bytes!)).toBe(true); expect(target.getMap<string>("x").get("a")).toBe("one"); });
  it("renders live and QR primitives", () => { render(<><MeshLiveRegion message="saved" delayMs={0} /><MeshQrDialog open onOpenChange={() => {}} payload="https://example.test" /></>); expect(screen.getByRole("dialog")).toBeTruthy(); expect(screen.getByRole("img", { name: "Share QR code" })).toBeTruthy(); });
});
