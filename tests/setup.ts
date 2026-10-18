import { afterEach } from "vitest";

// Vitest globals are off, so React Testing Library cannot register its own
// automatic cleanup. Without it, components rendered by one test stay mounted;
// their timers and effects then fire after the jsdom environment is torn down
// and surface as "window is not defined" unhandled errors.
afterEach(async () => {
  if (typeof document === "undefined") return;
  const { cleanup } = await import("@testing-library/react");
  cleanup();
});
