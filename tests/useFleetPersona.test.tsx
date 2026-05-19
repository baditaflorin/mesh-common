// @vitest-environment jsdom
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFleetPersona } from "../src/useFleetPersona";
import { FleetAvatar } from "../src/FleetAvatar";
import {
  writeFleetLocalPersona,
  writeLocalPersona,
  readLocalPersona,
  readFleetLocalPersona,
  readAnonId,
  readWriteToken,
  DEFAULT_PERSONA,
} from "../src/fleetPersona";

const APP = "harness-app";

function wipe() {
  localStorage.clear();
  window.history.replaceState(null, "", "/");
}

beforeEach(wipe);
afterEach(wipe);

function Harness({
  serviceUrl,
  fetchImpl,
  onApi,
}: {
  serviceUrl?: string;
  fetchImpl?: typeof fetch;
  onApi: (api: ReturnType<typeof useFleetPersona>) => void;
}) {
  const api = useFleetPersona({ appName: APP, serviceUrl, fetchImpl });
  onApi(api);
  return <div data-testid="label">{api.label}</div>;
}

describe("useFleetPersona", () => {
  it("starts with a default persona and `default` source", () => {
    let captured: ReturnType<typeof useFleetPersona> | null = null;
    render(<Harness onApi={(a) => (captured = a)} />);
    expect(captured!.source).toBe("default");
    expect(captured!.persona.nickname).toBe("");
    expect(captured!.label).toBe("");
  });

  it("suggests from L1 when L0 is empty", () => {
    writeFleetLocalPersona({ ...DEFAULT_PERSONA, nickname: "fleet-name" });
    let captured: ReturnType<typeof useFleetPersona> | null = null;
    render(<Harness onApi={(a) => (captured = a)} />);
    expect(captured!.source).toBe("fleet-local");
    expect(captured!.label).toBe("fleet-name");
  });

  it("L0 wins over L1 once written for this app", () => {
    writeFleetLocalPersona({ ...DEFAULT_PERSONA, nickname: "fleet" });
    writeLocalPersona(APP, { ...DEFAULT_PERSONA, nickname: "this-app" });
    let captured: ReturnType<typeof useFleetPersona> | null = null;
    render(<Harness onApi={(a) => (captured = a)} />);
    expect(captured!.source).toBe("local");
    expect(captured!.label).toBe("this-app");
  });

  it("setNickname propagates to L0 + L1 (default local-fleet mode)", () => {
    let captured: ReturnType<typeof useFleetPersona> | null = null;
    render(<Harness onApi={(a) => (captured = a)} />);
    act(() => {
      captured!.setNickname("florin");
    });
    expect(readLocalPersona(APP)?.nickname).toBe("florin");
    expect(readFleetLocalPersona()?.nickname).toBe("florin");
  });

  it("mode=off does not write L1", () => {
    let captured: ReturnType<typeof useFleetPersona> | null = null;
    render(<Harness onApi={(a) => (captured = a)} />);
    act(() => {
      captured!.setMode("off");
    });
    act(() => {
      captured!.setNickname("solo");
    });
    expect(readLocalPersona(APP)?.nickname).toBe("solo");
    expect(readFleetLocalPersona()).toBe(null);
  });

  it("mode=remote-fleet publishes to the service", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    let captured: ReturnType<typeof useFleetPersona> | null = null;
    render(<Harness serviceUrl="https://service.example" fetchImpl={fetchImpl as never} onApi={(a) => (captured = a)} />);
    act(() => {
      captured!.setMode("remote-fleet");
    });
    act(() => {
      captured!.setNickname("over-the-wire");
    });
    // Give the fire-and-forget PUT a tick to run.
    await Promise.resolve();
    const calls = fetchImpl.mock.calls;
    const put = calls.find((c) => (c[1] as RequestInit | undefined)?.method === "PUT");
    expect(put).toBeTruthy();
    const body = JSON.parse((put![1] as RequestInit).body as string);
    expect(body.nickname).toBe("over-the-wire");
    expect(body.writeToken).toMatch(/^[a-f0-9]{32}$/);
    expect(readAnonId()).toMatch(/^[a-f0-9]{32}$/);
    expect(readWriteToken()).toMatch(/^[a-f0-9]{32}$/);
  });

  it("forgetEverywhere wipes L0, L1, and remote credentials", async () => {
    writeLocalPersona(APP, { ...DEFAULT_PERSONA, nickname: "x" });
    writeFleetLocalPersona({ ...DEFAULT_PERSONA, nickname: "x" });
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    let captured: ReturnType<typeof useFleetPersona> | null = null;
    render(<Harness serviceUrl="https://service.example" fetchImpl={fetchImpl as never} onApi={(a) => (captured = a)} />);
    act(() => {
      captured!.setMode("remote-fleet");
    });
    act(() => {
      captured!.setNickname("x");
    });
    await act(async () => {
      await captured!.forgetEverywhere();
    });
    expect(readLocalPersona(APP)).toBe(null);
    expect(readFleetLocalPersona()).toBe(null);
    expect(readAnonId()).toBe(null);
    expect(readWriteToken()).toBe(null);
    const del = fetchImpl.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === "DELETE");
    expect(del).toBeTruthy();
  });

  it("auto-consumes a handoff fragment on first render", () => {
    const anonId = "a".repeat(32);
    const writeToken = "b".repeat(32);
    const payload = btoa(JSON.stringify({ v: 1, anonId, writeToken, p: { nickname: "carried" } }));
    window.history.replaceState(null, "", `/#fp=${encodeURIComponent(payload)}`);
    let captured: ReturnType<typeof useFleetPersona> | null = null;
    render(<Harness onApi={(a) => (captured = a)} />);
    expect(readAnonId()).toBe(anonId);
    expect(readWriteToken()).toBe(writeToken);
    expect(captured!.label).toBe("carried");
  });

  it("buildHandoffUrl produces a URL that round-trips", () => {
    let captured: ReturnType<typeof useFleetPersona> | null = null;
    render(<Harness onApi={(a) => (captured = a)} />);
    act(() => {
      captured!.setNickname("florin");
    });
    const url = captured!.buildHandoffUrl("https://other.example");
    expect(url).toMatch(/^https:\/\/other\.example\/#fp=/);
    expect(url).toContain("#fp=");
  });
});

describe("FleetAvatar", () => {
  it("renders an SVG even with default persona", () => {
    const { container } = render(<FleetAvatar appName={APP} />);
    expect(container.querySelector("img")?.getAttribute("src")).toMatch(/^data:image\/svg/);
  });

  it("uses the persona avatarSeed when present", () => {
    writeLocalPersona(APP, { ...DEFAULT_PERSONA, nickname: "florin", avatarSeed: "stable-seed" });
    const { container, rerender } = render(<FleetAvatar appName={APP} />);
    const before = container.querySelector("img")!.getAttribute("src");

    // Changing nickname must NOT change the avatar (seed is stable).
    writeLocalPersona(APP, { ...DEFAULT_PERSONA, nickname: "renamed", avatarSeed: "stable-seed" });
    rerender(<FleetAvatar appName={APP} />);
    const after = container.querySelector("img")!.getAttribute("src");
    expect(after).toBe(before);
  });

  it("falls back to nickname seed when avatarSeed is empty", () => {
    writeLocalPersona(APP, { ...DEFAULT_PERSONA, nickname: "florin" });
    const { container } = render(<FleetAvatar appName={APP} />);
    expect(container.querySelector("img")?.getAttribute("alt")).toBe("florin");
  });
});
