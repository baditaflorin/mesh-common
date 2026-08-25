// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { useState } from "react";
import { MeshAsyncAction } from "../src/ui/MeshAsyncAction";
import { MeshThemeProvider, useMeshTheme } from "../src/ui/MeshThemeProvider";
import {
  MeshBottomBar,
  MeshCluster,
  MeshGrid,
  MeshPage,
  MeshStack,
} from "../src/ui/MeshLayout";
import {
  MeshField,
  MeshForm,
  MeshFormSubmit,
  MeshSelect,
  MeshTextArea,
} from "../src/ui/MeshForm";
import { MeshCommandList, MeshListbox } from "../src/ui/MeshListbox";

afterEach(cleanup);

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("MeshAsyncAction", () => {
  it("prevents a double submit and announces success", async () => {
    const work = deferred();
    const action = vi.fn(() => work.promise);
    render(
      <MeshAsyncAction
        label="Send"
        pendingLabel="Sending"
        successMessage="Sent to room"
        action={action}
      />,
    );

    const button = screen.getByRole("button", { name: "Send" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(action).toHaveBeenCalledOnce();
    expect(button.disabled).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");

    await act(async () => {
      work.resolve();
      await work.promise;
    });
    expect(screen.getByRole("status").textContent).toContain("Sent to room");
  });

  it("announces a rejected action as an alert", async () => {
    render(
      <MeshAsyncAction
        label="Save"
        action={() => Promise.reject(new Error("offline"))}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByRole("alert").textContent).toContain("offline");
  });
});

describe("MeshThemeProvider", () => {
  it("provides semantic tokens and toggles an uncontrolled theme", () => {
    function ThemeProbe() {
      const theme = useMeshTheme();
      return (
        <button onClick={theme.toggleTheme}>
          {theme.resolvedTheme}:{theme.tokens.accent}
        </button>
      );
    }
    render(
      <MeshThemeProvider
        defaultMode="dark"
        applyToDocument={false}
        tokens={{ accent: "#f00" }}
      >
        <ThemeProbe />
      </MeshThemeProvider>,
    );
    const themeRoot = document.querySelector(".mesh-theme") as HTMLDivElement;
    expect(themeRoot.dataset.meshTheme).toBe("dark");
    expect(themeRoot.style.getPropertyValue("--mesh-accent")).toBe("#f00");
    fireEvent.click(screen.getByRole("button", { name: /dark/ }));
    expect(screen.getByRole("button").textContent).toContain("light");
  });
});

describe("Mesh layout primitives", () => {
  it("renders semantic page regions and safe-area aware action bar", () => {
    render(
      <MeshPage aria-label="Room controls">
        <MeshStack gap={12}>
          <MeshCluster>
            <button>One</button>
            <button>Two</button>
          </MeshCluster>
          <MeshGrid minItemWidth={180}>
            <article>Card</article>
          </MeshGrid>
        </MeshStack>
        <MeshBottomBar as="nav" ariaLabel="Primary actions">
          <button>Send</button>
        </MeshBottomBar>
      </MeshPage>,
    );
    expect(screen.getByRole("main", { name: "Room controls" })).toBeTruthy();
    expect(
      screen.getByRole("navigation", { name: "Primary actions" }),
    ).toBeTruthy();
    expect(screen.getByRole("navigation").className).toContain(
      "mesh-bottom-bar--sticky",
    );
    expect(
      document.querySelector(".mesh-grid")?.getAttribute("style"),
    ).toContain("grid");
  });
});

describe("Mesh form primitives", () => {
  it("wires a named field to validation errors and an accessible summary", async () => {
    const submit = vi.fn();
    render(
      <MeshForm
        validate={() => ({ nickname: "Name is required" })}
        onSubmit={submit}
      >
        <MeshField label="Nickname" name="nickname" hint="Shown to the room">
          <input />
        </MeshField>
        <MeshFormSubmit>Save</MeshFormSubmit>
      </MeshForm>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await act(async () => {
      await Promise.resolve();
    });
    const input = screen.getByRole("textbox", { name: /Nickname/ });
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const summary = screen.getByRole("alert");
    expect(summary.textContent).toContain("Name is required");
    expect(summary.querySelector('a[href="#nickname"]')).toBeTruthy();
    expect(submit).not.toHaveBeenCalled();
  });

  it("keeps native select and textarea controls controlled", () => {
    function FormControls() {
      const [choice, setChoice] = useState("one");
      const [note, setNote] = useState("");
      return (
        <>
          <MeshSelect
            label="Choice"
            value={choice}
            onValueChange={setChoice}
            options={[
              { value: "one", label: "One" },
              { value: "two", label: "Two" },
            ]}
          />
          <MeshTextArea label="Note" value={note} onValueChange={setNote} />
        </>
      );
    }
    render(<FormControls />);
    fireEvent.change(screen.getByRole("combobox", { name: "Choice" }), {
      target: { value: "two" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Note" }), {
      target: { value: "hello" },
    });
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe(
      "two",
    );
    expect(
      (screen.getByRole("textbox", { name: "Note" }) as HTMLTextAreaElement)
        .value,
    ).toBe("hello");
  });
});

describe("MeshListbox and MeshCommandList", () => {
  const options = [
    { id: "alpha", label: "Alpha", keywords: ["first"] },
    { id: "bravo", label: "Bravo" },
    { id: "charlie", label: "Charlie", disabled: true },
  ];

  it("supports roving keyboard focus, selection, filtering, and disabled choices", () => {
    const onChange = vi.fn();
    render(
      <MeshListbox
        label="People"
        options={options}
        value={null}
        onValueChange={onChange}
        searchable
      />,
    );
    const alpha = screen.getByRole("option", { name: "Alpha" });
    const bravo = screen.getByRole("option", { name: "Bravo" });
    expect(alpha.getAttribute("tabindex")).toBe("0");
    fireEvent.keyDown(alpha, { key: "ArrowDown" });
    expect(bravo.getAttribute("tabindex")).toBe("0");
    fireEvent.keyDown(bravo, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("bravo");
    fireEvent.click(screen.getByRole("option", { name: "Charlie" }));
    expect(onChange).toHaveBeenCalledOnce();
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "first" },
    });
    expect(screen.getByRole("option", { name: "Alpha" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Bravo" })).toBeNull();
  });

  it("runs enabled commands and exposes their shortcuts", () => {
    const onCommand = vi.fn();
    render(
      <MeshCommandList
        commands={[
          { id: "copy", label: "Copy invite", shortcut: "⌘C" },
          { id: "locked", label: "Locked", disabled: true },
        ]}
        onCommand={onCommand}
      />,
    );
    expect(screen.getByText("⌘C")).toBeTruthy();
    fireEvent.click(screen.getByRole("option", { name: /Copy invite/ }));
    expect(onCommand).toHaveBeenCalledWith(
      expect.objectContaining({ id: "copy" }),
    );
    fireEvent.click(screen.getByRole("option", { name: "Locked" }));
    expect(onCommand).toHaveBeenCalledOnce();
  });
});
