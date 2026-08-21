// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { useCrdtUndo } from "../src/useCrdtUndo";

describe("useCrdtUndo", () => {
  it("undoes and redoes local changes while reporting history availability", () => {
    const doc = new Y.Doc();
    const notes = doc.getText("notes");
    const { result } = renderHook(() => useCrdtUndo(notes, { captureTimeout: 0 }));

    expect(result.current.canUndo).toBe(false);
    act(() => notes.insert(0, "first"));
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);

    act(() => expect(result.current.undo()).toBe(true));
    expect(notes.toString()).toBe("");
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);

    act(() => expect(result.current.redo()).toBe(true));
    expect(notes.toString()).toBe("first");
    expect(result.current.canUndo).toBe(true);
  });

  it("does not undo mutations outside its selected Yjs type", () => {
    const doc = new Y.Doc();
    const scoped = doc.getArray<string>("scoped");
    const unrelated = doc.getArray<string>("unrelated");
    const { result } = renderHook(() => useCrdtUndo(scoped));

    act(() => {
      scoped.push(["keep scoped"]);
      result.current.stopCapturing();
      unrelated.push(["leave this"]);
    });
    act(() => result.current.undo());

    expect(scoped.toArray()).toEqual([]);
    expect(unrelated.toArray()).toEqual(["leave this"]);
  });

  it("can clear history without changing shared state", () => {
    const doc = new Y.Doc();
    const items = doc.getArray<string>("items");
    const { result } = renderHook(() => useCrdtUndo(items));

    act(() => items.push(["persist"]));
    act(() => result.current.clear());

    expect(items.toArray()).toEqual(["persist"]);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
    expect(result.current.undo()).toBe(false);
  });
});
