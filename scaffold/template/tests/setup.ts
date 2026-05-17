import "@testing-library/jest-dom/vitest";

// Vite injects these at build time; provide test-time defaults so files that
// import config.ts work in unit tests.
(globalThis as Record<string, unknown>).__APP_VERSION__ ??= "0.0.0-test";
(globalThis as Record<string, unknown>).__GIT_COMMIT__ ??= "test";

// jsdom polyfills required by Radix UI primitives (Slider, Switch, etc.)
if (typeof globalThis.ResizeObserver === "undefined") {
  class StubRO {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver =
    StubRO as unknown as typeof ResizeObserver;
}
if (typeof (globalThis as { DOMRect?: typeof DOMRect }).DOMRect === "undefined") {
  (globalThis as { DOMRect?: typeof DOMRect }).DOMRect = class {
    static fromRect = () => new (this as new () => unknown)();
    x = 0;
    y = 0;
    width = 0;
    height = 0;
    top = 0;
    left = 0;
    right = 0;
    bottom = 0;
    toJSON() {
      return this;
    }
  } as unknown as typeof DOMRect;
}
if (typeof (globalThis as { Element?: typeof Element }).Element !== "undefined") {
  const ElP = (globalThis as { Element: { prototype: Element } }).Element
    .prototype as unknown as Record<string, unknown>;
  ElP.hasPointerCapture ??= () => false;
  ElP.releasePointerCapture ??= () => {};
  ElP.setPointerCapture ??= () => {};
  ElP.scrollIntoView ??= () => {};
}
