// @vitest-environment jsdom
/**
 * Integration shape tests for the 12 UI primitives. Radix is well-tested
 * upstream — we focus on:
 *   - the component renders the expected DOM
 *   - the props pipe through
 *   - controlled state + callbacks work
 *
 * Uses vanilla vitest matchers (no jest-dom) — testing-library queries
 * throw when an element is missing, so `getByText(...)` is itself the
 * presence assertion.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { useState } from "react";

afterEach(cleanup);

// Polyfill ResizeObserver — Radix Slider observes its track size, and jsdom
// does not implement this API.
beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    class StubRO {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    globalThis.ResizeObserver = StubRO as unknown as typeof ResizeObserver;
  }
});

import { MeshSheet } from "../src/ui/MeshSheet";
import { MeshConfirm } from "../src/ui/MeshConfirm";
import { MeshTabs } from "../src/ui/MeshTabs";
import { MeshSlider } from "../src/ui/MeshSlider";
import { MeshSegmented } from "../src/ui/MeshSegmented";
import { MeshPopover } from "../src/ui/MeshPopover";
import { MeshSwitch } from "../src/ui/MeshSwitch";
import { MeshNameInput } from "../src/ui/MeshNameInput";
import { MeshEmpty } from "../src/ui/MeshEmpty";
import { MeshProgressBar } from "../src/ui/MeshProgressBar";
import { MeshDatePicker } from "../src/ui/MeshDatePicker";

describe("MeshSheet", () => {
  it("renders title + children when open", () => {
    render(
      <MeshSheet open onOpenChange={() => {}} title="sheet title">
        <p>body content</p>
      </MeshSheet>,
    );
    expect(screen.getByText("sheet title")).toBeTruthy();
    expect(screen.getByText("body content")).toBeTruthy();
  });

  it("does NOT render content when closed", () => {
    render(
      <MeshSheet open={false} onOpenChange={() => {}} title="hidden">
        <p>nope</p>
      </MeshSheet>,
    );
    expect(screen.queryByText("nope")).toBeNull();
  });
});

describe("MeshConfirm", () => {
  it("renders trigger and fires onConfirm on confirm click", async () => {
    const onConfirm = vi.fn();
    render(
      <MeshConfirm
        trigger={<button>open</button>}
        title="really?"
        confirmLabel="yes"
        cancelLabel="no"
        onConfirm={onConfirm}
      />,
    );
    fireEvent.click(screen.getByText("open"));
    expect(await screen.findByText("really?")).toBeTruthy();
    fireEvent.click(screen.getByText("yes"));
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});

describe("MeshTabs", () => {
  it("renders all triggers + the active content", () => {
    render(
      <MeshTabs
        tabs={[
          { value: "a", label: "A", content: <p>content-a</p> },
          { value: "b", label: "B", content: <p>content-b</p> },
        ]}
        value="a"
        onValueChange={() => {}}
      />,
    );
    expect(screen.getByText("A")).toBeTruthy();
    expect(screen.getByText("B")).toBeTruthy();
    expect(screen.getByText("content-a")).toBeTruthy();
  });

  it("calls onValueChange when a different tab is clicked", () => {
    const onChange = vi.fn();
    render(
      <MeshTabs
        tabs={[
          { value: "a", label: "A", content: <p>a</p> },
          { value: "b", label: "B", content: <p>b</p> },
        ]}
        value="a"
        onValueChange={onChange}
      />,
    );
    // Radix Tabs activates on pointerDown, not click — so use the tab role
    // and fire mouseDown which Radix listens to in jsdom.
    const tabB = screen.getByRole("tab", { name: "B" });
    fireEvent.mouseDown(tabB);
    fireEvent.click(tabB);
    expect(onChange).toHaveBeenCalledWith("b");
  });
});

describe("MeshSlider", () => {
  it("renders label + value when showValue", () => {
    render(
      <MeshSlider
        value={[50]}
        onValueChange={() => {}}
        min={0}
        max={100}
        label="vol"
        showValue
        formatValue={(n) => `${n}%`}
      />,
    );
    expect(screen.getByText("vol")).toBeTruthy();
    expect(screen.getByText("50%")).toBeTruthy();
  });
});

describe("MeshSegmented", () => {
  it("renders each option and marks the selected one with data-state=on", () => {
    render(
      <MeshSegmented
        value="b"
        onValueChange={() => {}}
        options={[
          { value: "a", label: "A" },
          { value: "b", label: "B" },
          { value: "c", label: "C" },
        ]}
      />,
    );
    const b = screen.getByText("B").closest("button");
    expect(b?.getAttribute("data-state")).toBe("on");
  });

  it("does not call onValueChange to empty unless allowDeselect", () => {
    const onChange = vi.fn();
    render(
      <MeshSegmented
        value="a"
        onValueChange={onChange}
        options={[
          { value: "a", label: "A" },
          { value: "b", label: "B" },
        ]}
      />,
    );
    // Radix ToggleGroup type=single ALREADY blocks toggling-off by default;
    // we still pass allowDeselect: false as a defensive layer — this asserts
    // the contract holds end-to-end.
    fireEvent.click(screen.getByText("A"));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("MeshPopover", () => {
  it("renders trigger; portal content appears after click", async () => {
    render(
      <MeshPopover trigger={<button>more</button>}>
        <p>popover-content</p>
      </MeshPopover>,
    );
    expect(screen.getByText("more")).toBeTruthy();
    fireEvent.click(screen.getByText("more"));
    expect(await screen.findByText("popover-content")).toBeTruthy();
  });
});

describe("MeshSwitch", () => {
  it("renders label + invokes onCheckedChange", () => {
    const onChange = vi.fn();
    render(
      <MeshSwitch checked={false} onCheckedChange={onChange} label="haptic" />,
    );
    expect(screen.getByText("haptic")).toBeTruthy();
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe("MeshNameInput", () => {
  it("renders label + counter when showCounter", () => {
    function Harness() {
      const [v, setV] = useState("alice");
      return <MeshNameInput value={v} onChange={setV} label="name" showCounter maxLength={48} />;
    }
    render(<Harness />);
    expect(screen.getByText("name")).toBeTruthy();
    expect(screen.getByText("5/48")).toBeTruthy();
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("alice");
  });

  it("clamps to maxLength", () => {
    const onChange = vi.fn();
    render(<MeshNameInput value="" onChange={onChange} maxLength={5} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "abcdefghi" } });
    expect(onChange).toHaveBeenCalledWith("abcde");
  });
});

describe("MeshEmpty", () => {
  it("renders title + message + action", () => {
    render(
      <MeshEmpty
        icon="🌱"
        title="nothing here"
        message="try again later"
        action={<button>retry</button>}
      />,
    );
    expect(screen.getByText("nothing here")).toBeTruthy();
    expect(screen.getByText("try again later")).toBeTruthy();
    expect(screen.getByText("retry")).toBeTruthy();
  });
});

describe("MeshProgressBar", () => {
  it("renders label + fraction + clamps value", () => {
    render(<MeshProgressBar value={0.42} label="progress" showFraction />);
    expect(screen.getByText("progress")).toBeTruthy();
    expect(screen.getByText("42%")).toBeTruthy();
    const pb = screen.getByRole("progressbar");
    expect(pb.getAttribute("aria-valuenow")).toBe("42");
  });

  it("clamps high values to 100%", () => {
    render(<MeshProgressBar value={2} label="x" showFraction />);
    expect(screen.getByText("100%")).toBeTruthy();
  });

  it("indeterminate hides aria-valuenow", () => {
    render(<MeshProgressBar value={0} indeterminate />);
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBeNull();
  });
});

describe("MeshDatePicker", () => {
  it("renders placeholder when no value", () => {
    render(
      <MeshDatePicker value={null} onValueChange={() => {}} placeholder="pick a day" />,
    );
    expect(screen.getByText("pick a day")).toBeTruthy();
  });

  it("renders ISO-like date when value provided", () => {
    render(
      <MeshDatePicker
        value={new Date("2026-05-17T12:00:00Z")}
        onValueChange={() => {}}
      />,
    );
    // The picker trigger is the only button whose text matches a date.
    const allButtons = screen.getAllByRole("button");
    const trigger = allButtons.find((b) => /202\d-\d{2}-\d{2}/.test(b.textContent ?? ""));
    expect(trigger).toBeTruthy();
    expect(trigger?.textContent).toMatch(/202\d-\d{2}-\d{2}/);
  });
});

describe("pushUiToast", () => {
  it("can be called without a mounted Toaster (no-throw)", async () => {
    const { pushUiToast } = await import("../src/ui/MeshUiToaster");
    expect(() => pushUiToast.success("ok")).not.toThrow();
    expect(() => pushUiToast.error("nope")).not.toThrow();
    expect(() => pushUiToast.dismiss()).not.toThrow();
  });
});
