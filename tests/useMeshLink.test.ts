// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { createMeshConfig } from "../src/MeshConfig";
import {
  makeMeshLinkFragment,
  parseMeshLink,
  useMeshLink,
} from "../src/useMeshLink";

const cfg = createMeshConfig({
  appName: "mesh-x",
  description: "",
  accentHex: "#000",
  version: "0.0.0",
  commit: "abc",
});

describe("makeMeshLinkFragment", () => {
  it("emits the canonical #r=…&p=…&x=… shape", () => {
    expect(makeMeshLinkFragment({ roomId: "alpha", peerId: "alice", extra: "hi" })).toBe(
      "#r=alpha&p=alice&x=hi",
    );
  });

  it("URL-encodes special characters in every field", () => {
    const frag = makeMeshLinkFragment({
      roomId: "spaces and/slashes",
      peerId: "a+b",
      extra: "x&y=z",
    });
    expect(frag).toBe("#r=spaces%20and%2Fslashes&p=a%2Bb&x=x%26y%3Dz");
  });

  it("JSON-stringifies non-string extra", () => {
    const frag = makeMeshLinkFragment({ roomId: "r", extra: { vote: "yes" } });
    expect(frag).toContain("x=%7B%22vote%22%3A%22yes%22%7D");
  });

  it("omits optional fields when absent", () => {
    expect(makeMeshLinkFragment({ roomId: "r" })).toBe("#r=r");
  });

  it("includes v= only when version differs from the default", () => {
    expect(makeMeshLinkFragment({ roomId: "r", version: "1" })).toBe("#r=r");
    expect(makeMeshLinkFragment({ roomId: "r", version: "2" })).toBe("#r=r&v=2");
  });
});

describe("parseMeshLink", () => {
  it("parses a full URL with the fragment shape", () => {
    const parsed = parseMeshLink("https://example.com/mesh-x/#r=alpha&p=alice&x=hi");
    expect(parsed).toEqual({ roomId: "alpha", peerId: "alice", extra: "hi", version: "1" });
  });

  it("parses a bare fragment", () => {
    expect(parseMeshLink("#r=alpha&p=alice")).toEqual({
      roomId: "alpha",
      peerId: "alice",
      extra: null,
      version: "1",
    });
  });

  it("decodes percent-encoded values", () => {
    const parsed = parseMeshLink("#r=spaces%20and%2Fslashes&p=a%2Bb&x=x%26y%3Dz");
    expect(parsed?.roomId).toBe("spaces and/slashes");
    expect(parsed?.peerId).toBe("a+b");
    expect(parsed?.extra).toBe("x&y=z");
  });

  it("JSON-parses extra when it looks like JSON", () => {
    const parsed = parseMeshLink<{ vote: string }>("#r=r&x=%7B%22vote%22%3A%22yes%22%7D");
    expect(parsed?.extra).toEqual({ vote: "yes" });
  });

  it("returns the raw string when extra is not JSON", () => {
    expect(parseMeshLink("#r=r&x=plain")?.extra).toBe("plain");
  });

  it("returns null when roomId is absent", () => {
    expect(parseMeshLink("#p=alice")).toBeNull();
    expect(parseMeshLink("")).toBeNull();
  });

  it("round-trips: make → parse yields the original payload", () => {
    const payload = { roomId: "α/β", peerId: "p+1", extra: { round: 3, vote: "no" } };
    const frag = makeMeshLinkFragment(payload);
    const parsed = parseMeshLink<typeof payload.extra>(frag);
    expect(parsed?.roomId).toBe(payload.roomId);
    expect(parsed?.peerId).toBe(payload.peerId);
    expect(parsed?.extra).toEqual(payload.extra);
  });
});

describe("useMeshLink", () => {
  it("make() prepends the current location to the fragment", () => {
    const { result } = renderHook(() => useMeshLink(cfg));
    const url = result.current.make({ roomId: "r", peerId: "p" });
    expect(url).toMatch(/#r=r&p=p$/);
  });

  it("parseCurrent reads from window.location.hash", () => {
    window.history.replaceState(null, "", "/#r=current&p=me");
    const { result } = renderHook(() => useMeshLink(cfg));
    expect(result.current.parseCurrent()?.roomId).toBe("current");
    expect(result.current.parseCurrent()?.peerId).toBe("me");
  });
});
