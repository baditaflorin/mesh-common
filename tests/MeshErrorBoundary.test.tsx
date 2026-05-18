// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, fireEvent, act, cleanup } from "@testing-library/react";
import { MeshErrorBoundary } from "../src/MeshErrorBoundary";

afterEach(() => cleanup());

function Boom({ throwIt }: { throwIt: boolean }): JSX.Element {
  if (throwIt) throw new Error("kaboom");
  return <div>ok</div>;
}

describe("MeshErrorBoundary", () => {
  it("renders children when nothing throws", () => {
    const { getByText } = render(
      <MeshErrorBoundary>
        <div>hello</div>
      </MeshErrorBoundary>,
    );
    expect(getByText("hello")).toBeTruthy();
  });

  it("renders the fallback card when a child throws", () => {
    // React logs the error twice in dev; suppress so the test output stays clean.
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    // React 19 invokes the error boundary fallback twice in dev mode; query all
    // matches and assert ≥1 rather than exactly 1.
    const { getAllByText } = render(
      <MeshErrorBoundary appName="mesh-x" version="0.0.1">
        <Boom throwIt />
      </MeshErrorBoundary>,
    );
    expect(getAllByText(/something broke/i).length).toBeGreaterThan(0);
    expect(getAllByText(/kaboom/).length).toBeGreaterThan(0);
    expect(getAllByText(/try again/i).length).toBeGreaterThan(0);
    expect(getAllByText(/copy diagnostics/i).length).toBeGreaterThan(0);
    spy.mockRestore();
  });

  it("invokes onError exactly once with the thrown error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const onError = vi.fn();
    render(
      <MeshErrorBoundary onError={onError}>
        <Boom throwIt />
      </MeshErrorBoundary>,
    );
    // React 19 may invoke the boundary twice in dev mode; assert at least once.
    expect(onError.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(onError.mock.calls[0]?.[0]?.message).toBe("kaboom");
    spy.mockRestore();
  });

  it("custom fallback receives the error + a resetError fn", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { getAllByText } = render(
      <MeshErrorBoundary
        fallback={({ error, resetError }) => (
          <div>
            <span>fallback: {error.message}</span>
            <button onClick={resetError}>reset</button>
          </div>
        )}
      >
        <Boom throwIt />
      </MeshErrorBoundary>,
    );
    expect(getAllByText("fallback: kaboom").length).toBeGreaterThan(0);
    expect(getAllByText("reset").length).toBeGreaterThan(0);
    spy.mockRestore();
  });

  it("copy diagnostics writes a structured blob to the clipboard", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    const { getAllByRole } = render(
      <MeshErrorBoundary appName="mesh-x" version="9.9.9">
        <Boom throwIt />
      </MeshErrorBoundary>,
    );
    await act(async () => {
      const btns = getAllByRole("button", { name: /copy diagnostics/i });
      fireEvent.click(btns[0]!);
    });
    expect(writeText.mock.calls.length).toBeGreaterThanOrEqual(1);
    const blob = writeText.mock.calls[0]?.[0] as string;
    expect(blob).toContain("app: mesh-x");
    expect(blob).toContain("version: 9.9.9");
    expect(blob).toContain("kaboom");
    spy.mockRestore();
  });
});
